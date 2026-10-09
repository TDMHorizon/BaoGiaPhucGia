import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import { createPermissionSchema } from "../server/db";
import { normalizeRangeRef } from "../server/permission-ranges";

type CliOptions =
  | { mode: "dry-run"; databasePath: string; backupPath: string }
  | { mode: "apply"; databasePath: string; backupPath: string };

type Project = {
  id: string;
  sheets: string;
  editable_ranges: string;
};

type PermissionGrant = {
  projectId: string;
  userId: string;
  sheetName: string;
  rangeRef: string;
  canRead: 0 | 1;
  canEdit: 0 | 1;
};

type MigrationSummary = {
  projectCount: number;
  sheetCount: number;
  employeeCount: number;
  readGrantCount: number;
  editGrantCount: number;
  missingEditSheetCount: number;
  emptyEditRangeCount: number;
};

class DryRunRollback extends Error {
  constructor(readonly summary: MigrationSummary) {
    super("Dry run completed; transaction rolled back.");
  }
}

function parseOptions(argv: string[]): CliOptions {
  const rawMode = argv[0];
  const isDryRun = rawMode === "--dry-run";
  const databasePath = isDryRun
    ? argv[1]
    : path.join(process.cwd(), "data", "baogia.db");
  const backupPath = isDryRun ? argv[2] : argv[1];

  if ((rawMode !== "--dry-run" && rawMode !== "--apply") || !databasePath || !backupPath) {
    throw new Error(
      "Usage: tsx scripts/migrate-permissions.ts --dry-run <database-copy> <backup> | --apply <backup>",
    );
  }

  return {
    mode: isDryRun ? "dry-run" : "apply",
    databasePath: path.resolve(databasePath),
    backupPath: path.resolve(backupPath),
  };
}

function assertHealthy(database: Database.Database, label: string) {
  const integrity = database.pragma("integrity_check") as { integrity_check: string }[];
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
    throw new Error(`${label} failed SQLite integrity_check.`);
  }

  const violations = database.pragma("foreign_key_check") as unknown[];
  if (violations.length > 0) {
    throw new Error(`${label} has foreign-key violations.`);
  }
}

function snapshotSourceRows(database: Database.Database) {
  return {
    projects: database.prepare(
      "SELECT id, sheets, editable_ranges, nguoi_phu_trach_id FROM projects ORDER BY id",
    ).all(),
    users: database.prepare(
      "SELECT id, role, active FROM users ORDER BY id",
    ).all(),
    members: database.prepare(
      "SELECT project_id, user_id FROM project_members ORDER BY project_id, user_id",
    ).all(),
  };
}

function parseJson<T>(json: string, label: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${String(error)}`);
  }
}

async function getProjectSheetNames(projectId: string): Promise<string[]> {
  const filePath = path.join(process.cwd(), "data", "files", `${projectId}.xlsx`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Workbook is missing for project ${projectId}.`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook.worksheets.map((worksheet) => worksheet.name);
}

async function buildGrants(
  database: Database.Database,
): Promise<{ grants: PermissionGrant[]; summary: MigrationSummary }> {
  const projects = database.prepare(
    "SELECT id, sheets, editable_ranges FROM projects ORDER BY id",
  ).all() as Project[];
  const activeEmployees = database.prepare(
    "SELECT id FROM users WHERE role = 'user' AND active = 1 ORDER BY id",
  ).all() as { id: string }[];
  const grants: PermissionGrant[] = [];
  const projectEmployeeIds = new Set<string>();
  let sheetCount = 0;
  let missingEditSheetCount = 0;
  let emptyEditRangeCount = 0;

  for (const project of projects) {
    const declaredSheets = parseJson<unknown>(project.sheets || "[]", `Project ${project.id} sheets`);
    if (!Array.isArray(declaredSheets) || declaredSheets.some((name) => typeof name !== "string")) {
      throw new Error(`Project ${project.id} has invalid sheet-name metadata.`);
    }

    const workbookSheets = await getProjectSheetNames(project.id);
    const declaredSet = new Set(declaredSheets);
    const workbookSet = new Set(workbookSheets);
    if (
      declaredSet.size !== workbookSet.size ||
      [...declaredSet].some((name) => !workbookSet.has(name))
    ) {
      throw new Error(`Project ${project.id} sheet metadata does not match its workbook.`);
    }
    sheetCount += workbookSheets.length;

    const legacyRanges = parseJson<unknown>(project.editable_ranges || "{}", `Project ${project.id} editable_ranges`);
    if (!legacyRanges || typeof legacyRanges !== "object" || Array.isArray(legacyRanges)) {
      throw new Error(`Project ${project.id} has invalid editable_ranges metadata.`);
    }

    const rangeMap = legacyRanges as Record<string, unknown>;
    for (const sheetName of Object.keys(rangeMap)) {
      if (!workbookSet.has(sheetName)) {
        throw new Error(`Project ${project.id} has an editable_ranges key that does not map to a workbook sheet.`);
      }
    }

    const memberIds = database.prepare(
      "SELECT user_id FROM project_members WHERE project_id = ?",
    ).all(project.id) as { user_id: string }[];
    const candidateUserIds = new Set(memberIds.map(({ user_id }) => user_id));
    const owner = database.prepare(
      "SELECT nguoi_phu_trach_id FROM projects WHERE id = ?",
    ).get(project.id) as { nguoi_phu_trach_id: string | null };
    if (owner.nguoi_phu_trach_id) candidateUserIds.add(owner.nguoi_phu_trach_id);

    const activeEmployeeIds = new Set(activeEmployees.map(({ id }) => id));
    const projectEmployees = [...candidateUserIds].filter((userId) => activeEmployeeIds.has(userId));
    for (const userId of projectEmployees) projectEmployeeIds.add(userId);

    for (const sheetName of workbookSheets) {
      const rawRanges = rangeMap[sheetName];
      const normalizedRanges = new Set<string>();

      if (rawRanges === undefined || rawRanges === null || rawRanges === "") {
        missingEditSheetCount += 1;
      } else if (typeof rawRanges !== "string") {
        throw new Error(`Project ${project.id} has a non-string range for a workbook sheet.`);
      } else {
        const entries = rawRanges.split(",").map((entry) => entry.trim()).filter(Boolean);
        if (entries.length === 0) {
          missingEditSheetCount += 1;
          emptyEditRangeCount += 1;
        }
        for (const entry of entries) normalizedRanges.add(normalizeRangeRef(entry));
      }

      for (const userId of projectEmployees) {
        const perRange = new Map<string, { canRead: 0 | 1; canEdit: 0 | 1 }>();
        perRange.set("*", { canRead: 1, canEdit: 0 });
        for (const rangeRef of normalizedRanges) {
          perRange.set(rangeRef, { canRead: 1, canEdit: 1 });
        }
        for (const [rangeRef, flags] of perRange) {
          grants.push({
            projectId: project.id,
            userId,
            sheetName,
            rangeRef,
            ...flags,
          });
        }
      }
    }
  }

  const summary: MigrationSummary = {
    projectCount: projects.length,
    sheetCount,
    employeeCount: projectEmployeeIds.size,
    readGrantCount: grants.length,
    editGrantCount: grants.filter((grant) => grant.canEdit === 1).length,
    missingEditSheetCount,
    emptyEditRangeCount,
  };

  return { grants, summary };
}

async function runMigration(options: CliOptions) {
  if (!fs.existsSync(options.backupPath)) {
    throw new Error(`Required pre-migration backup does not exist: ${options.backupPath}`);
  }

  if (options.mode === "apply") {
    const expectedDatabase = path.resolve(process.cwd(), "data", "baogia.db");
    if (options.databasePath !== expectedDatabase) {
      throw new Error("Apply mode is restricted to the application's configured database.");
    }
  }

  const backup = new Database(options.backupPath, { readonly: true, fileMustExist: true });
  assertHealthy(backup, "Pre-migration backup");
  const expectedSourceRows = snapshotSourceRows(backup);
  backup.close();

  const database = new Database(options.databasePath, { fileMustExist: true });
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  try {
    assertHealthy(database, "Migration target");
    if (JSON.stringify(snapshotSourceRows(database)) !== JSON.stringify(expectedSourceRows)) {
      throw new Error("Migration target no longer matches the verified backup; refusing to proceed.");
    }
    if (database.pragma("foreign_keys", { simple: true }) !== 1) {
      throw new Error("SQLite foreign-key enforcement is disabled.");
    }

    const permissionTable = database.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'project_range_permissions'",
    ).get();
    if (permissionTable) {
      const existingCount = database.prepare(
        "SELECT COUNT(*) AS count FROM project_range_permissions",
      ).get() as { count: number };
      if (existingCount.count > 0) {
        throw new Error("Permission grants already exist; refusing to migrate a second time.");
      }
    }

    const { grants, summary } = await buildGrants(database);
    const migrate = database.transaction(() => {
      if (JSON.stringify(snapshotSourceRows(database)) !== JSON.stringify(expectedSourceRows)) {
        throw new Error("Database rows changed during preflight; refusing to apply the migration.");
      }
      createPermissionSchema(database);
      const insert = database.prepare(`
        INSERT INTO project_range_permissions
          (id, project_id, user_id, sheet_name, range_ref, can_read, can_edit, granted_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      `);
      const now = new Date().toISOString();

      for (const grant of grants) {
        insert.run(
          randomUUID(),
          grant.projectId,
          grant.userId,
          grant.sheetName,
          grant.rangeRef,
          grant.canRead,
          grant.canEdit,
          now,
          now,
        );
      }

      if (options.mode === "dry-run") {
        throw new DryRunRollback(summary);
      }
      return summary;
    });

    let result: MigrationSummary;
    try {
      result = migrate.immediate();
    } catch (error) {
      if (options.mode === "dry-run" && error instanceof DryRunRollback) {
        result = error.summary;
        const tableAfterRollback = database.prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'project_range_permissions'",
        ).get();
        if (!permissionTable && tableAfterRollback) {
          throw new Error("Dry run rollback left the permission table behind.");
        }
        console.log(JSON.stringify({ mode: options.mode, rolledBack: true, ...result }, null, 2));
        return;
      }
      throw error;
    }

    assertHealthy(database, "Post-migration database");
    const finalGrantCount = database.prepare(
      "SELECT COUNT(*) AS count FROM project_range_permissions",
    ).get() as { count: number };
    if (finalGrantCount.count !== result.readGrantCount) {
      throw new Error("Post-migration grant count does not match the migration plan.");
    }
    console.log(JSON.stringify({ mode: options.mode, committed: true, ...result }, null, 2));
  } finally {
    database.close();
  }
}

const options = parseOptions(process.argv.slice(2));
runMigration(options).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

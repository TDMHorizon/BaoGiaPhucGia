import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { z } from "zod";
import {
  isCellWithinRange,
  isRangeWithinRange,
  normalizeRangeRef,
  transformRangeForStructureChange,
  type StructureChange,
} from "./permission-ranges";

const grantSchema = z.object({
  sheetName: z.string().trim().min(1),
  rangeRef: z.string().trim().min(1),
  canRead: z.boolean(),
  canEdit: z.boolean(),
}).strict().refine(
  (grant) => grant.canRead || !grant.canEdit,
  { message: "Edit permission requires read permission." },
).refine(
  (grant) => grant.canRead || grant.canEdit,
  { message: "A permission grant must allow reading or editing." },
);

const grantListSchema = z.array(grantSchema).max(1000);

export type ProjectPermissionGrant = {
  sheetName: string;
  rangeRef: string;
  canRead: boolean;
  canEdit: boolean;
};

export type ProjectHiddenRange = {
  id: string;
  projectId: string;
  sheetName: string;
  rangeRef: string;
  hiddenByUserId: string;
  hiddenByRole: "admin" | "manager";
  hiddenForUserId: string | null;
  createdAt: string;
};

export class PermissionInputError extends Error {}

export function parseProjectPermissionGrants(input: unknown): ProjectPermissionGrant[] {
  const parsed = grantListSchema.safeParse(input);
  if (!parsed.success) {
    throw new PermissionInputError(parsed.error.issues.map((issue) => issue.message).join(" "));
  }

  const keys = new Set<string>();
  return parsed.data.map((grant) => {
    let rangeRef: string;
    try {
      rangeRef = normalizeRangeRef(grant.rangeRef);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new PermissionInputError(error.message);
      }
      throw error;
    }

    const key = `${grant.sheetName}\u0000${rangeRef}`;
    if (keys.has(key)) {
      throw new PermissionInputError(
        `Duplicate permission range after normalization: ${grant.sheetName}!${rangeRef}`,
      );
    }
    keys.add(key);

    return { ...grant, rangeRef };
  });
}

export function userCanEditCell(
  database: Database.Database,
  userId: string,
  projectId: string,
  sheetName: string,
  cellRef: string,
): boolean {
  const grants = database.prepare(`
    SELECT range_ref
    FROM project_range_permissions
    WHERE project_id = ? AND user_id = ? AND sheet_name = ? AND can_edit = 1
  `).all(projectId, userId, sheetName) as { range_ref: string }[];

  return grants.some(({ range_ref }) => isCellWithinRange(cellRef, range_ref));
}

export function userCanEditRange(
  database: Database.Database,
  userId: string,
  projectId: string,
  sheetName: string,
  rangeRef: string,
): boolean {
  const grants = database.prepare(`
    SELECT range_ref
    FROM project_range_permissions
    WHERE project_id = ? AND user_id = ? AND sheet_name = ? AND can_edit = 1
  `).all(projectId, userId, sheetName) as { range_ref: string }[];
  return grants.some(({ range_ref: permittedRange }) => isRangeWithinRange(rangeRef, permittedRange));
}

export function userCanReadCell(
  database: Database.Database,
  userId: string,
  projectId: string,
  sheetName: string,
  cellRef: string,
): boolean {
  const grants = database.prepare(`
    SELECT range_ref
    FROM project_range_permissions
    WHERE project_id = ? AND user_id = ? AND sheet_name = ? AND can_read = 1
  `).all(projectId, userId, sheetName) as { range_ref: string }[];
  return grants.some(({ range_ref }) => isCellWithinRange(cellRef, range_ref));
}

export function userCanReadRange(
  database: Database.Database,
  userId: string,
  projectId: string,
  sheetName: string,
  rangeRef: string,
): boolean {
  const grants = database.prepare(`
    SELECT range_ref
    FROM project_range_permissions
    WHERE project_id = ? AND user_id = ? AND sheet_name = ? AND can_read = 1
  `).all(projectId, userId, sheetName) as { range_ref: string }[];
  return grants.some(({ range_ref }) => isRangeWithinRange(rangeRef, range_ref));
}

export function userCanSeeCell(
  database: Database.Database,
  user: { id: string; role: "admin" | "manager" | "user" },
  projectId: string,
  sheetName: string,
  cellRef: string,
): boolean {
  if (user.role !== "admin" && user.role !== "manager"
    && !userCanReadCell(database, user.id, projectId, sheetName, cellRef)) return false;
  return !getHiddenRangesForUser(database, projectId, user)
    .some((hidden) => hidden.sheetName === sheetName && isCellWithinRange(cellRef, hidden.rangeRef));
}

export function getUserProjectPermissions(
  database: Database.Database,
  projectId: string,
  userId: string,
): ProjectPermissionGrant[] {
  const rows = database.prepare(`
    SELECT sheet_name AS sheetName, range_ref AS rangeRef, can_read AS canRead, can_edit AS canEdit
    FROM project_range_permissions
    WHERE project_id = ? AND user_id = ?
    ORDER BY sheet_name, range_ref
  `).all(projectId, userId) as Array<{
    sheetName: string;
    rangeRef: string;
    canRead: number;
    canEdit: number;
  }>;

  return rows.map((row) => ({
    sheetName: row.sheetName,
    rangeRef: row.rangeRef,
    canRead: row.canRead === 1,
    canEdit: row.canEdit === 1,
  }));
}

export function getHiddenRangesForUser(
  database: Database.Database,
  projectId: string,
  user: { id: string; role: "admin" | "manager" | "user" },
): Array<{ sheetName: string; rangeRef: string }> {
  const rows = database.prepare(`
    SELECT sheet_name AS sheetName, range_ref AS rangeRef
    FROM project_hidden_ranges
    WHERE project_id = ?
      AND (
        hidden_for_user_id = ?
        OR (
          hidden_for_user_id IS NULL
          AND (
            (hidden_by_role = 'admin' AND ? IN ('manager', 'user'))
            OR (hidden_by_role = 'manager' AND ? = 'user')
          )
        )
      )
    ORDER BY sheet_name, range_ref
  `).all(projectId, user.id, user.role, user.role) as Array<{ sheetName: string; rangeRef: string }>;
  return rows;
}

export function createProjectHiddenRange(
  database: Database.Database,
  input: {
    projectId: string;
    sheetName: string;
    rangeRef: string;
    hiddenByUserId: string;
    hiddenByRole: "admin" | "manager";
    hiddenForUserId: string | null;
    createdAt: string;
  },
): string {
  const id = randomUUID();
  database.prepare(`
    INSERT INTO project_hidden_ranges
      (id, project_id, sheet_name, range_ref, hidden_by_user_id, hidden_by_role, hidden_for_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.projectId,
    input.sheetName,
    normalizeRangeRef(input.rangeRef),
    input.hiddenByUserId,
    input.hiddenByRole,
    input.hiddenForUserId,
    input.createdAt,
  );
  return id;
}

export function replaceUserProjectPermissions(
  database: Database.Database,
  input: {
    projectId: string;
    userId: string;
    grantedBy: string;
    grants: ProjectPermissionGrant[];
  },
): number {
  const now = new Date().toISOString();
  const replace = database.transaction(() => {
    database.prepare(
      "DELETE FROM project_range_permissions WHERE project_id = ? AND user_id = ?",
    ).run(input.projectId, input.userId);

    const insert = database.prepare(`
      INSERT INTO project_range_permissions
        (id, project_id, user_id, sheet_name, range_ref, can_read, can_edit, granted_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const grant of input.grants) {
      insert.run(
        randomUUID(),
        input.projectId,
        input.userId,
        grant.sheetName,
        grant.rangeRef,
        Number(grant.canRead),
        Number(grant.canEdit),
        input.grantedBy,
        now,
        now,
      );
    }
    return input.grants.length;
  });

  return replace.immediate();
}

export function renameProjectSheetPermissions(
  database: Database.Database,
  projectId: string,
  oldSheetName: string,
  newSheetName: string,
  updatedAt: string,
) {
  const rows = database.prepare(`
    SELECT user_id, sheet_name, range_ref, can_read, can_edit, granted_by, created_at
    FROM project_range_permissions
    WHERE project_id = ? AND sheet_name IN (?, ?)
  `).all(projectId, oldSheetName, newSheetName) as Array<{
    user_id: string;
    sheet_name: string;
    range_ref: string;
    can_read: number;
    can_edit: number;
    granted_by: string | null;
    created_at: string;
  }>;
  const merged = new Map<string, typeof rows[number] & { can_read: number; can_edit: number }>();

  for (const row of rows) {
    const key = `${row.user_id}\u0000${row.range_ref}`;
    const existing = merged.get(key);
    if (existing) {
      existing.can_read = Number(existing.can_read === 1 || row.can_read === 1);
      existing.can_edit = Number(existing.can_edit === 1 || row.can_edit === 1);
      if (row.created_at < existing.created_at) existing.created_at = row.created_at;
      if (row.sheet_name === newSheetName) existing.granted_by = row.granted_by;
    } else {
      merged.set(key, {
        ...row,
        sheet_name: newSheetName,
        can_read: row.can_read,
        can_edit: row.can_edit,
      });
    }
  }

  database.prepare(
    "DELETE FROM project_range_permissions WHERE project_id = ? AND sheet_name IN (?, ?)",
  ).run(projectId, oldSheetName, newSheetName);

  const insert = database.prepare(`
    INSERT INTO project_range_permissions
      (id, project_id, user_id, sheet_name, range_ref, can_read, can_edit, granted_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of merged.values()) {
    insert.run(
      randomUUID(),
      projectId,
      row.user_id,
      newSheetName,
      row.range_ref,
      row.can_read,
      row.can_edit,
      row.granted_by,
      row.created_at,
      updatedAt,
    );
  }

  database.prepare(`
    DELETE FROM project_hidden_ranges AS old
    WHERE old.project_id = ? AND old.sheet_name = ?
      AND EXISTS (
        SELECT 1 FROM project_hidden_ranges AS current
        WHERE current.project_id = old.project_id
          AND current.sheet_name = ?
          AND current.range_ref = old.range_ref
          AND current.hidden_by_user_id = old.hidden_by_user_id
          AND current.hidden_for_user_id IS old.hidden_for_user_id
      )
  `).run(projectId, oldSheetName, newSheetName);
  database.prepare(
    "UPDATE project_hidden_ranges SET sheet_name = ? WHERE project_id = ? AND sheet_name = ?",
  ).run(newSheetName, projectId, oldSheetName);

  const project = database.prepare("SELECT editable_ranges FROM projects WHERE id = ?").get(projectId) as
    { editable_ranges: string } | undefined;
  if (project) {
    const legacyRanges = JSON.parse(project.editable_ranges || "{}") as Record<string, string>;
    if (Object.prototype.hasOwnProperty.call(legacyRanges, oldSheetName)) {
      const oldValue = legacyRanges[oldSheetName] || "";
      const newValue = legacyRanges[newSheetName] || "";
      legacyRanges[newSheetName] = [newValue, oldValue].filter(Boolean).join(",");
      delete legacyRanges[oldSheetName];
      database.prepare("UPDATE projects SET editable_ranges = ? WHERE id = ?")
        .run(JSON.stringify(legacyRanges), projectId);
    }
  }
}

export function shiftProjectSheetPermissions(
  database: Database.Database,
  projectId: string,
  sheetName: string,
  change: StructureChange,
  updatedAt: string,
) {
  const rows = database.prepare(`
    SELECT user_id, range_ref, can_read, can_edit, granted_by, created_at
    FROM project_range_permissions
    WHERE project_id = ? AND sheet_name = ?
  `).all(projectId, sheetName) as Array<{
    user_id: string;
    range_ref: string;
    can_read: number;
    can_edit: number;
    granted_by: string | null;
    created_at: string;
  }>;

  const transformed = new Map<string, typeof rows[number] & { range_ref: string }>();
  for (const row of rows) {
    const rangeRef = transformRangeForStructureChange(row.range_ref, change);
    if (rangeRef === null) continue;
    const key = `${row.user_id}\u0000${rangeRef}`;
    const existing = transformed.get(key);
    if (existing) {
      existing.can_read = Number(existing.can_read === 1 || row.can_read === 1);
      existing.can_edit = Number(existing.can_edit === 1 || row.can_edit === 1);
      if (row.created_at < existing.created_at) existing.created_at = row.created_at;
    } else {
      transformed.set(key, { ...row, range_ref: rangeRef });
    }
  }

  database.prepare(
    "DELETE FROM project_range_permissions WHERE project_id = ? AND sheet_name = ?",
  ).run(projectId, sheetName);
  const insert = database.prepare(`
    INSERT INTO project_range_permissions
      (id, project_id, user_id, sheet_name, range_ref, can_read, can_edit, granted_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of transformed.values()) {
    insert.run(
      randomUUID(),
      projectId,
      row.user_id,
      sheetName,
      row.range_ref,
      row.can_read,
      row.can_edit,
      row.granted_by,
      row.created_at,
      updatedAt,
    );
  }

  const hiddenRows = database.prepare(`
    SELECT hidden_by_user_id, hidden_by_role, hidden_for_user_id, range_ref, created_at
    FROM project_hidden_ranges
    WHERE project_id = ? AND sheet_name = ?
  `).all(projectId, sheetName) as Array<{
    hidden_by_user_id: string;
    hidden_by_role: "admin" | "manager";
    hidden_for_user_id: string | null;
    range_ref: string;
    created_at: string;
  }>;
  const transformedHidden = new Map<string, typeof hiddenRows[number] & { range_ref: string }>();
  for (const row of hiddenRows) {
    const rangeRef = transformRangeForStructureChange(row.range_ref, change);
    if (rangeRef === null) continue;
    const key = `${row.hidden_by_user_id}\u0000${row.hidden_for_user_id ?? ""}\u0000${rangeRef}`;
    transformedHidden.set(key, { ...row, range_ref: rangeRef });
  }
  database.prepare(
    "DELETE FROM project_hidden_ranges WHERE project_id = ? AND sheet_name = ?",
  ).run(projectId, sheetName);
  const insertHidden = database.prepare(`
    INSERT INTO project_hidden_ranges
      (id, project_id, sheet_name, range_ref, hidden_by_user_id, hidden_by_role, hidden_for_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of transformedHidden.values()) {
    insertHidden.run(
      randomUUID(),
      projectId,
      sheetName,
      row.range_ref,
      row.hidden_by_user_id,
      row.hidden_by_role,
      row.hidden_for_user_id,
      row.created_at,
    );
  }

  const project = database.prepare("SELECT editable_ranges FROM projects WHERE id = ?").get(projectId) as
    { editable_ranges: string } | undefined;
  if (project) {
    const legacyRanges = JSON.parse(project.editable_ranges || "{}") as Record<string, string>;
    if (typeof legacyRanges[sheetName] === "string") {
      const updatedRanges = legacyRanges[sheetName]
        .split(",")
        .map((range) => range.trim())
        .filter(Boolean)
        .map((range) => transformRangeForStructureChange(range, change))
        .filter((range): range is string => range !== null);
      legacyRanges[sheetName] = updatedRanges.join(",");
      database.prepare("UPDATE projects SET editable_ranges = ? WHERE id = ?")
        .run(JSON.stringify(legacyRanges), projectId);
    }
  }
}

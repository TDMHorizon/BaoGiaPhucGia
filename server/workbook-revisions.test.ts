import ExcelJS from "exceljs";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureEditRevisionColumns, createPermissionSchema } from "./db";
import { withStagedFileReplacement } from "./files";
import { applyCellEditToWorkbookBuffer, getCellEditAffectedRange } from "./workbook-edits";
import {
  commitCellEditRevision,
  ProjectCellEditForbidden,
  ProjectRevisionConflict,
} from "./workbook-revisions";

const databases: Database.Database[] = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createRevisionDatabase() {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      trang_thai TEXT NOT NULL,
      nguoi_phu_trach_id TEXT,
      deleted_at TEXT,
      updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE project_members (project_id TEXT NOT NULL, user_id TEXT NOT NULL);
    CREATE TABLE edits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      cell TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      timestamp TEXT NOT NULL
    );
    INSERT INTO users (id) VALUES ('employee-1'), ('admin-1');
    INSERT INTO projects (id, version, trang_thai) VALUES ('project-1', 1, 'dang_lam');
    INSERT INTO project_members (project_id, user_id) VALUES ('project-1', 'employee-1');
  `);
  createPermissionSchema(database);
  ensureEditRevisionColumns(database);
  database.prepare(`
    INSERT INTO project_range_permissions
      (id, project_id, user_id, sheet_name, range_ref, can_read, can_edit, granted_by, created_at, updated_at)
    VALUES ('grant-1', 'project-1', 'employee-1', 'Sheet1', 'A1:B2', 1, 1, 'admin-1', ?, ?)
  `).run("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
  databases.push(database);
  return database;
}

const employee = { id: "employee-1", username: "employee", role: "user" as const };

function createEditInput(overrides: Partial<{
  cell: string;
  affectedRange: string;
  baseRevision: number;
  newValue: string;
}> = {}) {
  return {
    projectId: "project-1",
    user: employee,
    sheetName: "Sheet1",
    cell: overrides.cell ?? "A1",
    affectedRange: overrides.affectedRange ?? overrides.cell ?? "A1",
    oldValue: "old",
    newValue: overrides.newValue ?? "new",
    baseRevision: overrides.baseRevision ?? 1,
    timestamp: "2026-01-01T00:00:00.000Z",
  };
}

describe("workbook revision commits", () => {
  it("increments the project revision and records the edit revision atomically", () => {
    const database = createRevisionDatabase();
    let promotions = 0;

    const saved = commitCellEditRevision(
      database,
      createEditInput(),
      () => { promotions += 1; },
      () => { throw new Error("Unexpected workbook rollback"); },
    );

    expect(saved.baseRevision).toBe(1);
    expect(saved.revision).toBe(2);
    expect(database.prepare("SELECT version FROM projects WHERE id = 'project-1'").get())
      .toEqual({ version: 2 });
    expect(database.prepare("SELECT base_revision, revision FROM edits WHERE id = ?").get(saved.id))
      .toEqual({ base_revision: 1, revision: 2 });
    expect(promotions).toBe(1);
  });

  it("rejects a stale revision without promoting the workbook or writing an edit", () => {
    const database = createRevisionDatabase();
    database.prepare("UPDATE projects SET version = 2 WHERE id = 'project-1'").run();
    let promotions = 0;

    expect(() => commitCellEditRevision(
      database,
      createEditInput(),
      () => { promotions += 1; },
      () => undefined,
    )).toThrow(ProjectRevisionConflict);

    expect(promotions).toBe(0);
    expect(database.prepare("SELECT COUNT(*) AS count FROM edits").get())
      .toEqual({ count: 0 });
    expect(database.prepare("SELECT version FROM projects WHERE id = 'project-1'").get())
      .toEqual({ version: 2 });
  });

  it("rejects edits outside the employee grant before workbook promotion", () => {
    const database = createRevisionDatabase();
    let promotions = 0;

    expect(() => commitCellEditRevision(
      database,
      createEditInput({ cell: "C1" }),
      () => { promotions += 1; },
      () => undefined,
    )).toThrow(ProjectCellEditForbidden);

    expect(promotions).toBe(0);
    expect(database.prepare("SELECT COUNT(*) AS count FROM edits").get())
      .toEqual({ count: 0 });
    expect(database.prepare("SELECT version FROM projects WHERE id = 'project-1'").get())
      .toEqual({ version: 1 });
  });

  it("rejects a merged-cell edit unless the entire merged range is granted", () => {
    const database = createRevisionDatabase();
    let promotions = 0;

    expect(() => commitCellEditRevision(
      database,
      createEditInput({ cell: "B2", affectedRange: "B2:C3" }),
      () => { promotions += 1; },
      () => undefined,
    )).toThrow(ProjectCellEditForbidden);

    expect(promotions).toBe(0);
    expect(database.prepare("SELECT COUNT(*) AS count FROM edits").get()).toEqual({ count: 0 });
  });

  it("restores the workbook and rolls back revision and audit rows when the audit insert fails", () => {
    const database = createRevisionDatabase();
    database.exec(`
      CREATE TRIGGER reject_edit_audit BEFORE INSERT ON edits
      BEGIN
        SELECT RAISE(ABORT, 'audit unavailable');
      END;
    `);
    let promoted = false;
    let restored = false;

    expect(() => commitCellEditRevision(
      database,
      createEditInput(),
      () => { promoted = true; },
      () => { restored = true; promoted = false; },
    )).toThrow("audit unavailable");

    expect(promoted).toBe(false);
    expect(restored).toBe(true);
    expect(database.prepare("SELECT COUNT(*) AS count FROM edits").get())
      .toEqual({ count: 0 });
    expect(database.prepare("SELECT version FROM projects WHERE id = 'project-1'").get())
      .toEqual({ version: 1 });
  });

  it("adds revision columns idempotently without changing legacy edit history", () => {
    const database = new Database(":memory:");
    database.exec(`
      CREATE TABLE edits (id TEXT PRIMARY KEY, timestamp TEXT NOT NULL);
      INSERT INTO edits (id, timestamp) VALUES ('legacy-1', '2025-01-01T00:00:00.000Z');
    `);
    databases.push(database);

    ensureEditRevisionColumns(database);
    ensureEditRevisionColumns(database);

    expect(database.prepare("SELECT id, timestamp, base_revision, revision FROM edits").get())
      .toEqual({
        id: "legacy-1",
        timestamp: "2025-01-01T00:00:00.000Z",
        base_revision: null,
        revision: null,
      });
  });
});

describe("ExcelJS edit persistence", () => {
  it("changes one cell while preserving formulas and merged-cell structure", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");
    worksheet.getCell("A1").value = 2;
    worksheet.getCell("B1").value = { formula: "A1*2", result: 4 };
    worksheet.mergeCells("D1:E1");
    worksheet.getCell("D1").value = "Merged";
    const original = Buffer.from(await workbook.xlsx.writeBuffer());

    const { buffer, oldValue } = await applyCellEditToWorkbookBuffer(original, "Sheet1", "C1", "7");
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer);
    const savedSheet = reloaded.getWorksheet("Sheet1")!;

    expect(oldValue).toBe("");
    expect(savedSheet.getCell("C1").value).toBe(7);
    expect(savedSheet.getCell("B1").value).toEqual({ formula: "A1*2", result: 4 });
    expect(savedSheet.getCell("E1").isMerged).toBe(true);
    expect(savedSheet.getCell("E1").master.address).toBe("D1");
  });

  it("persists entered formulas as formulas instead of literal text", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");
    worksheet.getCell("A1").value = 2;
    worksheet.getCell("A2").value = 3;
    const original = Buffer.from(await workbook.xlsx.writeBuffer());

    const { buffer } = await applyCellEditToWorkbookBuffer(original, "Sheet1", "B1", "=SUM(A1:A2)");
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer);

    expect(reloaded.getWorksheet("Sheet1")!.getCell("B1").value).toEqual({
      formula: "SUM(A1:A2)",
      result: undefined,
    });
  });

  it("reports the full merged range as the edit impact", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");
    worksheet.mergeCells("B2:C3");
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(getCellEditAffectedRange(buffer, "Sheet1", "C3")).resolves.toBe("B2:C3");
    await expect(getCellEditAffectedRange(buffer, "Sheet1", "D3")).resolves.toBe("D3");
  });
});

describe("staged workbook file replacement", () => {
  it("restores the original workbook when the database transaction fails", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-revision-test-"));
    temporaryDirectories.push(directory);
    const targetPath = path.join(directory, "project.xlsx");
    fs.writeFileSync(targetPath, "original");

    await expect(withStagedFileReplacement(
      targetPath,
      Buffer.from("replacement"),
      (promote) => {
        promote();
        throw new Error("database transaction failed");
      },
    )).rejects.toThrow("database transaction failed");

    expect(fs.readFileSync(targetPath, "utf8")).toBe("original");
    expect(fs.readdirSync(directory)).toEqual(["project.xlsx"]);
  });

  it("can promote a workbook when the project did not have a file yet", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-revision-test-"));
    temporaryDirectories.push(directory);
    const targetPath = path.join(directory, "new-project.xlsx");

    await withStagedFileReplacement(targetPath, Buffer.from("new workbook"), (promote) => {
      promote();
      return "committed";
    });

    expect(fs.readFileSync(targetPath, "utf8")).toBe("new workbook");
    expect(fs.readdirSync(directory)).toEqual(["new-project.xlsx"]);
  });
});

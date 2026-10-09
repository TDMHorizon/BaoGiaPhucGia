import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { isCellInRange } from "../src/lib/utils-excel";
import { createPermissionSchema } from "./db";
import {
  isCellWithinRange,
  isValidCellRef,
  normalizeRangeRef,
  transformRangeForStructureChange,
} from "./permission-ranges";
import {
  getUserProjectPermissions,
  getHiddenRangesForUser,
  parseProjectPermissionGrants,
  PermissionInputError,
  createProjectHiddenRange,
  renameProjectSheetPermissions,
  replaceUserProjectPermissions,
  shiftProjectSheetPermissions,
  userCanEditCell,
  userCanSeeCell,
} from "./permissions";

describe("normalizeRangeRef", () => {
  it.each([
    ["a1", "A1"],
    ["$b$7", "B7"],
    ["$b$7:$A$1", "A1:B7"],
    ["A1:A1", "A1"],
    ["c", "C:C"],
    ["c:a", "A:C"],
    ["$3:$1", "1:3"],
    [" * ", "*"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeRangeRef(input)).toBe(expected);
  });

  it.each([
    "",
    "A0",
    "XFE1",
    "A1048577",
    "A1:B",
    "A1,B2",
    "Sheet1!A1",
    "NamedRange",
  ])("rejects invalid range %s", (input) => {
    expect(() => normalizeRangeRef(input)).toThrow(RangeError);
  });
});

describe("cell range checks", () => {
  it.each([
    ["A1", "A1:B2", true],
    ["B2", "A1:B2", true],
    ["C2", "A1:B2", false],
    ["C10", "A:C", true],
    ["D10", "A:C", false],
    ["XFD1048576", "*", true],
    ["C5", "1:5", true],
    ["C6", "1:5", false],
    ["bad", "*", false],
    ["XFE1", "*", false],
  ])("checks cell %s against %s", (cell, range, expected) => {
    expect(isCellWithinRange(cell, range)).toBe(expected);
  });

  it.each(["", " ", ",", " , , "])("fails closed for empty client range %s", (range) => {
    expect(isCellInRange("A1", range)).toBe(false);
  });

  it.each([
    ["A1", "*", true],
    ["C5", "1:5", true],
    ["C6", "1:5", false],
  ])("checks client cell %s against %s", (cell, range, expected) => {
    expect(isCellInRange(cell, range)).toBe(expected);
  });

  it("validates cell references before they are used for authorization", () => {
    expect(isValidCellRef("$b$7")).toBe(true);
    expect(isValidCellRef("A0")).toBe(false);
    expect(isValidCellRef("Sheet1!A1")).toBe(false);
  });
});

describe("permission range transforms", () => {
  it.each([
    ["A1:B3", { axis: "row", action: "insert", index: 2 }, "A1:B4"],
    ["A3:B5", { axis: "row", action: "insert", index: 2 }, "A4:B6"],
    ["A1:C3", { axis: "column", action: "insert", index: 2 }, "A1:D3"],
    ["A1:C3", { axis: "column", action: "delete", index: 2 }, "A1:B3"],
    ["2:4", { axis: "row", action: "delete", index: 2 }, "2:3"],
    ["2:2", { axis: "row", action: "delete", index: 2 }, null],
    ["*", { axis: "row", action: "insert", index: 1 }, "*"],
  ] as const)("transforms %s for %o to %s", (range, change, expected) => {
    expect(transformRangeForStructureChange(range, change)).toBe(expected);
  });
});

describe("project_range_permissions schema", () => {
  let database: Database.Database | undefined;

  afterEach(() => {
    database?.close();
    database = undefined;
  });

  function createTestDatabase() {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    database.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE projects (id INT PRIMARY KEY, editable_ranges TEXT NOT NULL DEFAULT '{}');
      INSERT INTO users (id) VALUES ('staff-1'), ('staff-2'), ('manager-1'), ('admin-1');
      INSERT INTO projects (id, editable_ranges) VALUES ('project-1', '{"Sheet1":"A1:B2"}');
    `);
    createPermissionSchema(database);
    return database;
  }

  function insertPermission(
    db: Database.Database,
    overrides: Partial<{
      projectId: string;
      userId: string;
      sheetName: string;
      rangeRef: string;
      canRead: number;
      canEdit: number;
      grantedBy: string | null;
    }> = {},
  ) {
    const values = {
      projectId: "project-1",
      userId: "staff-1",
      sheetName: "Sheet1",
      rangeRef: "A1:B2",
      canRead: 1,
      canEdit: 1,
      grantedBy: "manager-1",
      ...overrides,
    };
    return db
      .prepare(
        `INSERT INTO project_range_permissions
          (id, project_id, user_id, sheet_name, range_ref, can_read, can_edit, granted_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        crypto.randomUUID(),
        values.projectId,
        values.userId,
        values.sheetName,
        values.rangeRef,
        values.canRead,
        values.canEdit,
        values.grantedBy,
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );
  }

  it("enables SQLite foreign-key enforcement and rejects unknown references", () => {
    const db = createTestDatabase();
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);

    expect(() => insertPermission(db, { projectId: "missing-project" })).toThrow(
      /FOREIGN KEY constraint failed/,
    );
    expect(() => insertPermission(db, { userId: "missing-user" })).toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });

  it("requires read permission whenever edit permission is granted", () => {
    const db = createTestDatabase();
    expect(() => insertPermission(db, { canRead: 0, canEdit: 1 })).toThrow(
      /CHECK constraint failed/,
    );
  });

  it("does not migrate legacy editable_ranges when creating the schema", () => {
    const db = createTestDatabase();
    const legacyRange = db
      .prepare("SELECT editable_ranges FROM projects WHERE id = 'project-1'")
      .get() as { editable_ranges: string };
    const grantCount = db
      .prepare("SELECT COUNT(*) AS count FROM project_range_permissions")
      .get() as { count: number };

    expect(legacyRange.editable_ranges).toBe('{"Sheet1":"A1:B2"}');
    expect(grantCount.count).toBe(0);
  });

  it("keeps read-only grants distinct from edit grants", () => {
    const db = createTestDatabase();
    insertPermission(db, { rangeRef: "A1", canRead: 1, canEdit: 0 });

    const stored = db
      .prepare("SELECT can_read, can_edit FROM project_range_permissions WHERE range_ref = 'A1'")
      .get() as { can_read: number; can_edit: number };
    expect(stored).toEqual({ can_read: 1, can_edit: 0 });
  });

  it("rejects duplicate grants for the same project, user, sheet, and range", () => {
    const db = createTestDatabase();
    insertPermission(db);

    expect(() => insertPermission(db)).toThrow(/UNIQUE constraint failed/);
  });

  it("requires an explicit matching edit grant for a cell", () => {
    const db = createTestDatabase();
    expect(userCanEditCell(db, "staff-1", "project-1", "Sheet1", "A1")).toBe(false);

    insertPermission(db, { rangeRef: "A1:B2", canRead: 1, canEdit: 0 });
    expect(userCanEditCell(db, "staff-1", "project-1", "Sheet1", "A1")).toBe(false);

    insertPermission(db, { rangeRef: "C1:C3", canRead: 1, canEdit: 1 });
    expect(userCanEditCell(db, "staff-1", "project-1", "Sheet1", "C2")).toBe(true);
    expect(userCanEditCell(db, "staff-1", "project-1", "Sheet1", "D2")).toBe(false);
  });

  it("applies hidden ranges by hierarchy and keeps user-specific rules targeted", () => {
    const db = createTestDatabase();
    insertPermission(db, { rangeRef: "A1:C3", canRead: 1, canEdit: 0 });
    insertPermission(db, { userId: "staff-2", rangeRef: "A1:C3", canRead: 1, canEdit: 0 });

    const addHiddenRange = (
      hiddenByUserId: string,
      hiddenByRole: "admin" | "manager",
      hiddenForUserId: string | null,
      rangeRef: string,
    ) => createProjectHiddenRange(db, {
      projectId: "project-1",
      sheetName: "Sheet1",
      rangeRef,
      hiddenByUserId,
      hiddenByRole,
      hiddenForUserId,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    addHiddenRange("admin-1", "admin", null, "A1");
    addHiddenRange("manager-1", "manager", null, "B1");
    addHiddenRange("manager-1", "manager", "staff-1", "C1");

    const admin = { id: "admin-1", role: "admin" as const };
    const manager = { id: "manager-1", role: "manager" as const };
    const firstEmployee = { id: "staff-1", role: "user" as const };
    const secondEmployee = { id: "staff-2", role: "user" as const };

    expect(getHiddenRangesForUser(db, "project-1", admin)).toEqual([]);
    expect(getHiddenRangesForUser(db, "project-1", manager)).toEqual([
      { sheetName: "Sheet1", rangeRef: "A1" },
    ]);
    expect(getHiddenRangesForUser(db, "project-1", firstEmployee)).toEqual([
      { sheetName: "Sheet1", rangeRef: "A1" },
      { sheetName: "Sheet1", rangeRef: "B1" },
      { sheetName: "Sheet1", rangeRef: "C1" },
    ]);
    expect(getHiddenRangesForUser(db, "project-1", secondEmployee)).toEqual([
      { sheetName: "Sheet1", rangeRef: "A1" },
      { sheetName: "Sheet1", rangeRef: "B1" },
    ]);

    expect(userCanSeeCell(db, admin, "project-1", "Sheet1", "A1")).toBe(true);
    expect(userCanSeeCell(db, manager, "project-1", "Sheet1", "A1")).toBe(false);
    expect(userCanSeeCell(db, manager, "project-1", "Sheet1", "B1")).toBe(true);
    expect(userCanSeeCell(db, firstEmployee, "project-1", "Sheet1", "C1")).toBe(false);
    expect(userCanSeeCell(db, secondEmployee, "project-1", "Sheet1", "C1")).toBe(true);
    expect(userCanEditCell(db, "staff-1", "project-1", "OtherSheet", "C2")).toBe(false);
  });

  it("normalizes and replaces user grants as one transaction", () => {
    const db = createTestDatabase();
    const grants = parseProjectPermissionGrants([
      { sheetName: "Sheet1", rangeRef: "$a$1:$b$2", canRead: true, canEdit: true },
      { sheetName: "Sheet1", rangeRef: "C:C", canRead: true, canEdit: false },
    ]);

    expect(replaceUserProjectPermissions(db, {
      projectId: "project-1",
      userId: "staff-1",
      grantedBy: "manager-1",
      grants,
    })).toBe(2);
    expect(getUserProjectPermissions(db, "project-1", "staff-1")).toEqual([
      { sheetName: "Sheet1", rangeRef: "A1:B2", canRead: true, canEdit: true },
      { sheetName: "Sheet1", rangeRef: "C:C", canRead: true, canEdit: false },
    ]);
    expect(userCanEditCell(db, "staff-1", "project-1", "Sheet1", "B2")).toBe(true);
    expect(userCanEditCell(db, "staff-1", "project-1", "Sheet1", "C2")).toBe(false);
  });

  it("rolls back grant replacement if any new row violates a database constraint", () => {
    const db = createTestDatabase();
    insertPermission(db, { rangeRef: "A1", canRead: 1, canEdit: 1 });

    expect(() => replaceUserProjectPermissions(db, {
      projectId: "project-1",
      userId: "staff-1",
      grantedBy: "missing-manager",
      grants: [{
        sheetName: "Sheet1",
        rangeRef: "B1",
        canRead: true,
        canEdit: true,
      }],
    })).toThrow(/FOREIGN KEY constraint failed/);

    expect(userCanEditCell(db, "staff-1", "project-1", "Sheet1", "A1")).toBe(true);
    expect(userCanEditCell(db, "staff-1", "project-1", "Sheet1", "B1")).toBe(false);
  });

  it("renames the sheet in ACL and legacy range metadata", () => {
    const db = createTestDatabase();
    insertPermission(db, { rangeRef: "A1:B2" });
    createProjectHiddenRange(db, {
      projectId: "project-1",
      sheetName: "Sheet1",
      rangeRef: "C1:C2",
      hiddenByUserId: "manager-1",
      hiddenByRole: "manager",
      hiddenForUserId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    renameProjectSheetPermissions(db, "project-1", "Sheet1", "Renamed", "2026-02-01T00:00:00.000Z");

    expect(getUserProjectPermissions(db, "project-1", "staff-1")).toEqual([
      { sheetName: "Renamed", rangeRef: "A1:B2", canRead: true, canEdit: true },
    ]);
    const project = db.prepare("SELECT editable_ranges FROM projects WHERE id = 'project-1'").get() as {
      editable_ranges: string;
    };
    expect(JSON.parse(project.editable_ranges)).toEqual({ Renamed: "A1:B2" });
    expect(getHiddenRangesForUser(db, "project-1", { id: "staff-1", role: "user" })).toEqual([
      { sheetName: "Renamed", rangeRef: "C1:C2" },
    ]);
  });

  it("shifts employee grants when rows or columns change", () => {
    const db = createTestDatabase();
    insertPermission(db, { rangeRef: "A1:B3" });

    shiftProjectSheetPermissions(
      db,
      "project-1",
      "Sheet1",
      { axis: "row", action: "insert", index: 2 },
      "2026-02-01T00:00:00.000Z",
    );
    expect(getUserProjectPermissions(db, "project-1", "staff-1")[0].rangeRef).toBe("A1:B4");

    shiftProjectSheetPermissions(
      db,
      "project-1",
      "Sheet1",
      { axis: "column", action: "delete", index: 2 },
      "2026-02-01T00:00:00.000Z",
    );
    expect(getUserProjectPermissions(db, "project-1", "staff-1")[0].rangeRef).toBe("A1:A4");
  });

  it("shifts hidden ranges with the same structural changes as permission ranges", () => {
    const db = createTestDatabase();
    createProjectHiddenRange(db, {
      projectId: "project-1",
      sheetName: "Sheet1",
      rangeRef: "B2:C4",
      hiddenByUserId: "manager-1",
      hiddenByRole: "manager",
      hiddenForUserId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    shiftProjectSheetPermissions(
      db,
      "project-1",
      "Sheet1",
      { axis: "row", action: "insert", index: 3 },
      "2026-02-01T00:00:00.000Z",
    );
    expect(getHiddenRangesForUser(db, "project-1", { id: "staff-1", role: "user" })).toEqual([
      { sheetName: "Sheet1", rangeRef: "B2:C5" },
    ]);

    shiftProjectSheetPermissions(
      db,
      "project-1",
      "Sheet1",
      { axis: "column", action: "delete", index: 2 },
      "2026-02-02T00:00:00.000Z",
    );
    expect(getHiddenRangesForUser(db, "project-1", { id: "staff-1", role: "user" })).toEqual([
      { sheetName: "Sheet1", rangeRef: "B2:B5" },
    ]);
  });

  it("resolves hidden ranges for explicit employees and lower ranks only", () => {
    const db = createTestDatabase();
    db.prepare(`
      INSERT INTO project_hidden_ranges
        (id, project_id, sheet_name, range_ref, hidden_by_user_id, hidden_by_role, hidden_for_user_id, created_at)
      VALUES
        ('admin-hidden', 'project-1', 'Sheet1', 'A1', 'manager-1', 'admin', NULL, '2026-01-01'),
        ('manager-hidden', 'project-1', 'Sheet1', 'B1', 'manager-1', 'manager', NULL, '2026-01-01'),
        ('specific-hidden', 'project-1', 'Sheet1', 'C1', 'manager-1', 'manager', 'staff-1', '2026-01-01')
    `).run();

    expect(getHiddenRangesForUser(db, "project-1", { id: "staff-1", role: "user" }).map((row) => row.rangeRef))
      .toEqual(["A1", "B1", "C1"]);
    expect(getHiddenRangesForUser(db, "project-1", { id: "manager-1", role: "manager" }).map((row) => row.rangeRef))
      .toEqual(["A1"]);
    expect(getHiddenRangesForUser(db, "project-1", { id: "admin", role: "admin" })).toEqual([]);
  });

  it("rejects edit-without-read and duplicate ranges after normalization", () => {
    expect(() => parseProjectPermissionGrants([
      { sheetName: "Sheet1", rangeRef: "A1", canRead: false, canEdit: true },
    ])).toThrow(PermissionInputError);
    expect(() => parseProjectPermissionGrants([
      { sheetName: "Sheet1", rangeRef: "A1", canRead: true, canEdit: true },
      { sheetName: "Sheet1", rangeRef: "$a$1", canRead: true, canEdit: false },
    ])).toThrow(PermissionInputError);
  });
});

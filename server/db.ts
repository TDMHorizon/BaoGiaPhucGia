import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";
import { ensureDataDirs } from "./files";

export type TrangThai = "nhap" | "dang_lam" | "da_gui" | "cho_duyet" | "da_duyet";

export type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "manager" | "user";

  active: number;
  created_at: string;
};

export type ProjectRow = {
  id: string;
  name: string;
  sheets: string;
  editable_ranges: string;
  so_bao_gia: string;
  ten_khach_hang: string;
  nguoi_phu_trach_id: string | null;
  trang_thai: TrangThai;
  ghi_chu: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type EditRow = {
  id: string;
  project_id: string;
  user_id: string;
  username: string;
  sheet_name: string;
  cell: string;
  old_value: string;
  new_value: string;
  base_revision: number | null;
  revision: number | null;
  timestamp: string;
};

export type VersionRow = {
  id: string;
  project_id: string;
  version: number;
  note: string;
  created_by: string;
  created_at: string;
};

export type TemplateRow = {
  id: string;
  name: string;
  sheets: string;
  editable_ranges: string;
  created_at: string;
};

let db: Database.Database;

export function createPermissionSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS project_range_permissions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      sheet_name TEXT NOT NULL CHECK (length(trim(sheet_name)) > 0),
      range_ref TEXT NOT NULL CHECK (length(trim(range_ref)) > 0),
      can_read INTEGER NOT NULL CHECK (can_read IN (0, 1)),
      can_edit INTEGER NOT NULL CHECK (can_edit IN (0, 1)),
      granted_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (can_edit = 0 OR can_read = 1),
      UNIQUE (project_id, user_id, sheet_name, range_ref),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_project_range_permissions_project_user
      ON project_range_permissions(project_id, user_id);

    CREATE INDEX IF NOT EXISTS idx_project_range_permissions_project_user_sheet
      ON project_range_permissions(project_id, user_id, sheet_name);

    CREATE TABLE IF NOT EXISTS project_hidden_ranges (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      sheet_name TEXT NOT NULL CHECK (length(trim(sheet_name)) > 0),
      range_ref TEXT NOT NULL CHECK (length(trim(range_ref)) > 0),
      hidden_by_user_id TEXT NOT NULL,
      hidden_by_role TEXT NOT NULL CHECK (hidden_by_role IN ('admin', 'manager')),
      hidden_for_user_id TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (project_id, hidden_by_user_id, sheet_name, range_ref, hidden_for_user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (hidden_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (hidden_for_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_project_hidden_ranges_project_target
      ON project_hidden_ranges(project_id, hidden_for_user_id, hidden_by_role);

    -- BẢNG PHÂN QUYỀN ẨN/HIỆN & QUYỀN TRUY CẬP DỰ ÁN CẤP ROLE / USER
    CREATE TABLE IF NOT EXISTS project_role_visibility (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'user')),
      user_id TEXT,
      is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
      can_view INTEGER NOT NULL DEFAULT 1 CHECK (can_view IN (0, 1)),
      can_edit INTEGER NOT NULL DEFAULT 0 CHECK (can_edit IN (0, 1)),
      hidden_by TEXT NOT NULL,
      hidden_at TEXT NOT NULL,
      UNIQUE (project_id, role, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (hidden_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_project_role_visibility_project_role
      ON project_role_visibility(project_id, role, user_id);

    -- BẢNG SNAPSHOT UNIVER WORKBOOK PHỤC VỤ RUNTIME SSOT & PHỤC HỒI
    CREATE TABLE IF NOT EXISTS workbook_snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_workbook_snapshots_project_ver
      ON workbook_snapshots(project_id, version);

    -- BẢNG REVISION COMMAND LOG HỖ TRỢ TRUY VẾT & UNDO/REDO THEO PHIÊN BẢN
    CREATE TABLE IF NOT EXISTS workbook_commands (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      sheet_name TEXT NOT NULL,
      range_ref TEXT NOT NULL,
      command_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_workbook_commands_project_ver
      ON workbook_commands(project_id, version);

    -- BẢNG PHÂN QUYỀN ĐỌC & SỬA ĐA SHEET CHUẨN HÓA (PROJECT PERMISSIONS)
    CREATE TABLE IF NOT EXISTS project_permissions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      access_type TEXT NOT NULL CHECK(access_type IN ('read', 'edit')),
      range_ref TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_proj_perm_lookup 
      ON project_permissions(project_id, user_id, sheet_name, access_type);

    -- BẢNG LƯU VẾT AUDIT LOG PHÂN QUYỀN (PERMISSION AUDIT LOGS)
    CREATE TABLE IF NOT EXISTS project_permission_audit_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      action TEXT NOT NULL,
      old_grants TEXT,
      new_grants TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export function ensureEditRevisionColumns(database: Database.Database) {
  const columns = database.prepare("PRAGMA table_info(edits)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "base_revision")) {
    database.exec("ALTER TABLE edits ADD COLUMN base_revision INTEGER");
  }
  if (!columns.some((column) => column.name === "revision")) {
    database.exec("ALTER TABLE edits ADD COLUMN revision INTEGER");
  }
}

export function getDb() {
  if (!db) {
    initDb();
  }
  return db;
}

export function initDb() {
  ensureDataDirs();
  const dbPath = path.join(process.cwd(), "data", "baogia.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const hasUsers = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (hasUsers) {
    db.exec(`
      PRAGMA foreign_keys=off;
      BEGIN TRANSACTION;
      CREATE TABLE IF NOT EXISTS new_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','manager','user')),
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO new_users SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE new_users RENAME TO users;
      COMMIT;
      PRAGMA foreign_keys=on;
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','manager','user')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INT PRIMARY KEY,
      name TEXT NOT NULL,
      sheets TEXT NOT NULL DEFAULT '[]',
      editable_ranges TEXT NOT NULL DEFAULT '{}',
      so_bao_gia TEXT NOT NULL DEFAULT '',
      ten_khach_hang TEXT NOT NULL DEFAULT '',
      nguoi_phu_trach_id TEXT,
      trang_thai TEXT NOT NULL DEFAULT 'nhap',
      ghi_chu TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (nguoi_phu_trach_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS edits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      cell TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sheets TEXT NOT NULL DEFAULT '[]',
      editable_ranges TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `);

  db.pragma("foreign_keys = ON");
  createPermissionSchema(db);
  ensureEditRevisionColumns(db);

  const projectColumns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!projectColumns.some((column) => column.name === "deleted_at")) {
    db.exec("ALTER TABLE projects ADD COLUMN deleted_at TEXT");
  }

  seedUsers();
  return db;
}

function seedUsers() {
  const now = new Date().toISOString();
  const defaultPassHash = bcrypt.hashSync("password", 10);

  const adminRow = db.prepare("SELECT * FROM users WHERE LOWER(username) = 'admin'").get() as UserRow | undefined;
  if (!adminRow) {
    db.prepare(
      "INSERT INTO users (id, username, password_hash, role, active, created_at) VALUES (?, 'admin', ?, 'admin', 1, ?)"
    ).run("admin1", defaultPassHash, now);
  } else if (!adminRow.active) {
    db.prepare("UPDATE users SET active = 1 WHERE id = ?").run(adminRow.id);
  }

  const userRow = db.prepare("SELECT * FROM users WHERE LOWER(username) = 'user'").get() as UserRow | undefined;
  if (!userRow) {
    db.prepare(
      "INSERT INTO users (id, username, password_hash, role, active, created_at) VALUES (?, 'user', ?, 'user', 1, ?)"
    ).run("user1", defaultPassHash, now);
  } else if (!userRow.active) {
    db.prepare("UPDATE users SET active = 1 WHERE id = ?").run(userRow.id);
  }
}

export function publicUser(u: UserRow) {
  return { id: u.id, username: u.username, role: u.role as "admin" | "manager" | "user", active: !!u.active };
}

export function projectToJson(p: ProjectRow, memberIds: string[] = []) {
  return {
    id: p.id,
    name: p.name,
    sheets: p.sheets ? JSON.parse(p.sheets) : [],
    editableRanges: p.editable_ranges ? JSON.parse(p.editable_ranges) : {},
    soBaoGia: p.so_bao_gia,
    tenKhachHang: p.ten_khach_hang,
    nguoiPhuTrachId: p.nguoi_phu_trach_id,
    memberIds,
    trangThai: p.trang_thai,
    ghiChu: p.ghi_chu,
    version: p.version,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    deletedAt: p.deleted_at,
  };
}

export function getProjectMembers(projectId: string): string[] {
  const rows = db
    .prepare("SELECT user_id FROM project_members WHERE project_id = ?")
    .all(projectId) as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

export function setProjectMembers(projectId: string, memberIds: string[]) {
  const setMembersTx = db.transaction((pId: string, mIds: string[]) => {
    db.prepare("DELETE FROM project_members WHERE project_id = ?").run(pId);
    const insert = db.prepare("INSERT INTO project_members (project_id, user_id) VALUES (?, ?)");
    for (const uid of mIds) {
      insert.run(pId, uid);
    }
  });
  setMembersTx(projectId, memberIds);
}

export function userCanAccessProject(user: { id: string; role: string }, project: ProjectRow): boolean {
  if (user.role === "admin" || user.role === "manager") return true;
  if (project.nguoi_phu_trach_id === user.id) return true;
  const members = getProjectMembers(project.id);
  return members.includes(user.id);
}

export const LOCKED_STATUSES: TrangThai[] = ["da_gui", "da_duyet"];

export function isProjectLocked(trangThai: TrangThai | string): boolean {
  return LOCKED_STATUSES.includes(trangThai as TrangThai);
}

export type ProjectRoleVisibilityRow = {
  id: string;
  project_id: string;
  role: "admin" | "manager" | "user";
  user_id: string | null;
  is_hidden: number;
  can_view: number;
  can_edit: number;
  hidden_by: string;
  hidden_at: string;
};

export function getProjectRoleVisibilities(projectId: string): ProjectRoleVisibilityRow[] {
  return getDb()
    .prepare("SELECT * FROM project_role_visibility WHERE project_id = ?")
    .all(projectId) as ProjectRoleVisibilityRow[];
}

export function setProjectRoleVisibility(
  projectId: string,
  role: "admin" | "manager" | "user",
  params: {
    userId?: string | null;
    isHidden: boolean;
    canView?: boolean;
    canEdit?: boolean;
    hiddenBy: string;
  }
) {
  const id = `${projectId}_${role}_${params.userId || "all"}`;
  const now = new Date().toISOString();
  const canView = params.canView !== undefined ? (params.canView ? 1 : 0) : params.isHidden ? 0 : 1;
  const canEdit = params.canEdit ? 1 : 0;
  const isHidden = params.isHidden ? 1 : 0;

  getDb().prepare(`
    INSERT INTO project_role_visibility (id, project_id, role, user_id, is_hidden, can_view, can_edit, hidden_by, hidden_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      is_hidden = excluded.is_hidden,
      can_view = excluded.can_view,
      can_edit = excluded.can_edit,
      hidden_by = excluded.hidden_by,
      hidden_at = excluded.hidden_at
  `).run(
    id,
    projectId,
    role,
    params.userId || null,
    isHidden,
    canView,
    canEdit,
    params.hiddenBy,
    now
  );
}

export function isProjectHiddenForUser(
  projectId: string,
  user: { id: string; role: string }
): boolean {
  // Admin sees all files unless explicitly filtered
  if (user.role === "admin") return false;

  // Check specific user override
  const userOverride = getDb()
    .prepare(
      "SELECT is_hidden, can_view FROM project_role_visibility WHERE project_id = ? AND user_id = ?"
    )
    .get(projectId, user.id) as { is_hidden: number; can_view: number } | undefined;

  if (userOverride) {
    return userOverride.is_hidden === 1 || userOverride.can_view === 0;
  }

  // Check role level
  const roleOverride = getDb()
    .prepare(
      "SELECT is_hidden, can_view FROM project_role_visibility WHERE project_id = ? AND role = ? AND user_id IS NULL"
    )
    .get(projectId, user.role) as { is_hidden: number; can_view: number } | undefined;

  if (roleOverride) {
    return roleOverride.is_hidden === 1 || roleOverride.can_view === 0;
  }

  return false;
}

export function saveWorkbookSnapshot(
  projectId: string,
  version: number,
  snapshotJson: string,
  createdBy: string
) {
  const id = `${projectId}_v${version}_${Date.now()}`;
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO workbook_snapshots (id, project_id, version, snapshot_json, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, projectId, version, snapshotJson, createdBy, now);
}

export function getLatestWorkbookSnapshot(projectId: string): string | null {
  const row = getDb()
    .prepare(
      "SELECT snapshot_json FROM workbook_snapshots WHERE project_id = ? ORDER BY version DESC LIMIT 1"
    )
    .get(projectId) as { snapshot_json: string } | undefined;
  return row ? row.snapshot_json : null;
}

export function recordWorkbookCommand(
  projectId: string,
  version: number,
  sheetName: string,
  rangeRef: string,
  commandType: string,
  payload: any,
  userId: string
) {
  const id = `${projectId}_cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO workbook_commands (id, project_id, version, sheet_name, range_ref, command_type, payload_json, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    projectId,
    version,
    sheetName,
    rangeRef,
    commandType,
    typeof payload === "string" ? payload : JSON.stringify(payload),
    userId,
    now
  );
}

export interface ProjectPermissionRecord {
  id: string;
  project_id: string;
  user_id: string;
  sheet_name: string;
  access_type: 'read' | 'edit';
  range_ref: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface PermissionGrantInput {
  sheetName: string;
  accessType: 'read' | 'edit';
  rangeRef: string;
}

export function replaceProjectPermissions(
  projectId: string,
  userId: string,
  grants: PermissionGrantInput[],
  adminId: string
) {
  const database = getDb();
  const now = new Date().toISOString();

  const transaction = database.transaction(() => {
    // 1. Fetch old grants for audit log
    const oldGrants = database
      .prepare("SELECT * FROM project_permissions WHERE project_id = ? AND user_id = ?")
      .all(projectId, userId);

    // 2. Delete existing grants
    database
      .prepare("DELETE FROM project_permissions WHERE project_id = ? AND user_id = ?")
      .run(projectId, userId);

    // 3. Insert new grants
    const insertStmt = database.prepare(`
      INSERT INTO project_permissions (id, project_id, user_id, sheet_name, access_type, range_ref, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const g of grants) {
      if (!g.sheetName || !g.rangeRef) continue;
      const permId = `${projectId}_${userId}_${g.sheetName}_${g.accessType}_${g.rangeRef}`;
      insertStmt.run(permId, projectId, userId, g.sheetName, g.accessType, g.rangeRef, now, now, adminId);
    }

    // 4. Record audit log
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    database.prepare(`
      INSERT INTO project_permission_audit_logs (id, project_id, user_id, changed_by, action, old_grants, new_grants, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditId,
      projectId,
      userId,
      adminId,
      'REPLACE_ALL',
      JSON.stringify(oldGrants),
      JSON.stringify(grants),
      now
    );
  });

  transaction();
}

export function getProjectPermissions(projectId: string, userId: string): ProjectPermissionRecord[] {
  return getDb()
    .prepare("SELECT * FROM project_permissions WHERE project_id = ? AND user_id = ?")
    .all(projectId, userId) as ProjectPermissionRecord[];
}

export function getProjectPermissionsMap(projectId: string, userId: string): Record<string, { read: string[]; edit: string[] }> {
  const rows = getProjectPermissions(projectId, userId);
  const map: Record<string, { read: string[]; edit: string[] }> = {};

  for (const row of rows) {
    if (!map[row.sheet_name]) {
      map[row.sheet_name] = { read: [], edit: [] };
    }
    if (row.access_type === 'edit') {
      map[row.sheet_name].edit.push(row.range_ref);
    } else if (row.access_type === 'read') {
      map[row.sheet_name].read.push(row.range_ref);
    }
  }

  return map;
}



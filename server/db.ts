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

export function getDb() {
  if (!db) throw new Error("Database not initialized");
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
<<<<<<< HEAD
      id INT PRIMARY KEY,
=======
      id TEXT PRIMARY KEY,
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
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
<<<<<<< HEAD
      deleted_at TEXT,
=======
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
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

<<<<<<< HEAD
  const projectColumns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!projectColumns.some((column) => column.name === "deleted_at")) {
    db.exec("ALTER TABLE projects ADD COLUMN deleted_at TEXT");
  }

=======
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
  seedUsers();
  return db;
}

function seedUsers() {
  const count = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (count.c > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(
    "INSERT INTO users (id, username, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  );
  insert.run("admin1", "admin", bcrypt.hashSync("password", 10), "admin", now);
  insert.run("user1", "user", bcrypt.hashSync("password", 10), "user", now);
}

export function publicUser(u: UserRow) {
  return { id: u.id, username: u.username, role: u.role as "admin" | "manager" | "user", active: !!u.active };
}

export function projectToJson(p: ProjectRow, memberIds: string[] = []) {
  return {
    id: p.id,
    name: p.name,
<<<<<<< HEAD
    sheets: p.sheets ? JSON.parse(p.sheets) : [],
    editableRanges: p.editable_ranges ? JSON.parse(p.editable_ranges) : {},
=======
    sheets: JSON.parse(p.sheets || "[]") as string[],
    editableRanges: JSON.parse(p.editable_ranges || "{}") as Record<string, string>,
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
    soBaoGia: p.so_bao_gia,
    tenKhachHang: p.ten_khach_hang,
    nguoiPhuTrachId: p.nguoi_phu_trach_id,
    memberIds,
    trangThai: p.trang_thai,
    ghiChu: p.ghi_chu,
    version: p.version,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
<<<<<<< HEAD
    deletedAt: p.deleted_at,
=======
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
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

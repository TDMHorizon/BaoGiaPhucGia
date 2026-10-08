import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";
import { ensureDataDirs } from "./files";
import { dataDir, isProduction } from "./config";
import { isLockedStatus, normalizeTrangThai, type TrangThai } from "../src/lib/constants";
import { canReadProject } from "../src/lib/permissions";

export type { TrangThai };

export type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "manager" | "user";
  token_version: number;
  full_name?: string | null;
  email?: string | null;
  active: number;
  created_at: string;
};

export type CellValueRow = {
  project_id: string;
  sheet_name: string;
  cell: string;
  value: string;
  revision: number;
  updated_by: string;
  updated_at: string;
};

export type ProjectMemberPermissionRow = {
  project_id: string;
  user_id: string;
  sheet_name: string;
  editable_ranges: string;
};

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  detail: string;
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
  /** Không còn dùng. Giữ lại cho tương thích dữ liệu cũ. Xem project_revision và versions.version. */
  version: number;
  /** Tăng mỗi khi dữ liệu làm việc thay đổi (edit, cấu trúc, trạng thái) - dùng cho optimistic concurrency. */
  project_revision: number;
  /** Snapshot (versions.id) đang được chốt để gửi khách. */
  finalized_snapshot_id: string | null;
  archived_at: string | null;
  archived_by: string | null;
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
  /** Thứ tự chấp nhận trong phạm vi project, do backend cấp trong transaction. */
  sequence: number;
  /** Dữ liệu cũ không đủ thông tin chắc chắn về thứ tự => cần rà soát thủ công. */
  needs_review: number;
  timestamp: string;
};

export type VersionRow = {
  id: string;
  project_id: string;
  version: number;
  note: string;
  created_by: string;
  created_at: string;
  source_revision: number;
  checksum: string;
  file_size: number;
  sent_by: string | null;
  sent_at: string | null;
};

export type TemplateRow = {
  id: string;
  name: string;
  sheets: string;
  editable_ranges: string;
  created_at: string;
};

export type EventRow = {
  id: string;
  project_id: string;
  type: string;
  actor_id: string | null;
  actor_name: string | null;
  detail: string;
  created_at: string;
};

let db: Database.Database;

export function getDb() {
  if (!db) throw new Error("Database not initialized");
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined as unknown as Database.Database;
  }
}

export function initDb() {
  ensureDataDirs();
  const dbPath = path.join(dataDir(), "baogia.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  fixLegacyUsersTable();
  createBaseTables();
  runMigrations();
  seedUsers();
  return db;
}

/** DB đời cũ có bảng users chưa cho phép role 'manager'. Chỉ tạo lại bảng khi thật sự cần (không chạy mỗi lần khởi động). */
function fixLegacyUsersTable() {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get() as { sql: string } | undefined;
  if (!row || row.sql.includes("'manager'")) return;

  db.exec(`
    PRAGMA foreign_keys=off;
    BEGIN TRANSACTION;
    CREATE TABLE new_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','manager','user')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    INSERT OR IGNORE INTO new_users SELECT id, username, password_hash, role, active, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE new_users RENAME TO users;
    COMMIT;
    PRAGMA foreign_keys=on;
  `);
  console.log("[db] Đã nâng cấp bảng users (cho phép role 'manager').");
}

/** Cấu trúc gốc (đời đầu). Các cột/bảng mới được thêm bằng migration bên dưới để cùng một đường chạy cho DB mới và DB cũ. */
function createBaseTables() {
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

  const projectColumns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!projectColumns.some((column) => column.name === "deleted_at")) {
    db.exec("ALTER TABLE projects ADD COLUMN deleted_at TEXT");
  }

  seedUsers();
  return db;
}

/* ------------------------------ Migrations ------------------------------ */

function hasColumn(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function addColumnIfMissing(table: string, column: string, ddl: string) {
  if (!hasColumn(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

type Migration = { id: number; name: string; up: () => void };

/**
 * Gán sequence cho các edit cũ mà KHÔNG xóa dữ liệu (mục 4.5).
 * Thứ tự dựa vào rowid (thứ tự INSERT thực tế = thứ tự server chấp nhận).
 * Edit bị đánh dấu needs_review khi dữ liệu không đủ chắc chắn về thứ tự:
 *  - timestamp lùi so với edit đứng trước (rowid đảo ngược timestamp), hoặc
 *  - nhiều edit cùng ô trùng timestamp nên không phân biệt được trước/sau.
 */
export function backfillEditSequences(database: Database.Database = db): { updated: number; flagged: number } {
  const projectIds = database
    .prepare("SELECT DISTINCT project_id FROM edits WHERE sequence IS NULL")
    .all() as { project_id: string }[];

  const selectRows = database.prepare(
    "SELECT rowid AS rid, id, sheet_name, cell, timestamp FROM edits WHERE project_id = ? AND sequence IS NULL ORDER BY rowid ASC"
  );
  const maxSeq = database.prepare("SELECT COALESCE(MAX(sequence), 0) AS m FROM edits WHERE project_id = ?");
  const setSeq = database.prepare("UPDATE edits SET sequence = ?, needs_review = ? WHERE id = ?");

  let updated = 0;
  let flagged = 0;

  for (const { project_id } of projectIds) {
    const rows = selectRows.all(project_id) as {
      rid: number;
      id: string;
      sheet_name: string;
      cell: string;
      timestamp: string;
    }[];

    const sameKey = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.sheet_name}\u0000${r.cell}\u0000${r.timestamp}`;
      sameKey.set(k, (sameKey.get(k) || 0) + 1);
    }

    let seq = (maxSeq.get(project_id) as { m: number }).m;
    let latestTs = "";
    for (const r of rows) {
      seq++;
      const ambiguous = (sameKey.get(`${r.sheet_name}\u0000${r.cell}\u0000${r.timestamp}`) || 0) > 1;
      const regressed = latestTs !== "" && r.timestamp < latestTs;
      const needsReview = ambiguous || regressed ? 1 : 0;
      if (r.timestamp > latestTs) latestTs = r.timestamp;
      setSeq.run(seq, needsReview, r.id);
      updated++;
      flagged += needsReview;
    }
  }
  return { updated, flagged };
}

const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "edits.sequence + needs_review",
    up: () => {
      addColumnIfMissing("edits", "sequence", "INTEGER");
      addColumnIfMissing("edits", "needs_review", "INTEGER NOT NULL DEFAULT 0");
      const r = backfillEditSequences();
      if (r.updated) {
        console.log(`[db] Đã gán sequence cho ${r.updated} edit cũ, ${r.flagged} edit đánh dấu cần rà soát.`);
      }
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_edits_project_seq ON edits(project_id, sequence);
        CREATE INDEX IF NOT EXISTS idx_edits_project_cell ON edits(project_id, sheet_name, cell);
      `);
    },
  },
  {
    id: 2,
    name: "projects.project_revision + finalized_snapshot_id + archive; chuẩn hoá trạng thái cũ",
    up: () => {
      addColumnIfMissing("projects", "project_revision", "INTEGER NOT NULL DEFAULT 0");
      addColumnIfMissing("projects", "finalized_snapshot_id", "TEXT");
      addColumnIfMissing("projects", "archived_at", "TEXT");
      addColumnIfMissing("projects", "archived_by", "TEXT");
      db.exec(`
        UPDATE projects SET project_revision = (SELECT COUNT(*) FROM edits e WHERE e.project_id = projects.id);
        UPDATE projects SET trang_thai = 'dang_lam' WHERE trang_thai = 'cho_duyet';
        UPDATE projects SET trang_thai = 'da_gui' WHERE trang_thai = 'da_duyet';
      `);
    },
  },
  {
    id: 3,
    name: "versions: source_revision, checksum, file_size, sent_by, sent_at + unique(project_id, version)",
    up: () => {
      addColumnIfMissing("versions", "source_revision", "INTEGER NOT NULL DEFAULT 0");
      addColumnIfMissing("versions", "checksum", "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing("versions", "file_size", "INTEGER NOT NULL DEFAULT 0");
      addColumnIfMissing("versions", "sent_by", "TEXT");
      addColumnIfMissing("versions", "sent_at", "TEXT");
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_project_version ON versions(project_id, version);`);
    },
  },
  {
    id: 4,
    name: "project_events (audit sự kiện quản lý)",
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_events (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          type TEXT NOT NULL,
          actor_id TEXT,
          actor_name TEXT,
          detail TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_project_events_project ON project_events(project_id, created_at);
      `);
    },
  },
  {
    id: 5,
    name: "rbac_concurrency_audit: token_version, full_name, email, project_cell_values, project_member_permissions, audit_logs",
    up: () => {
      addColumnIfMissing("users", "token_version", "INTEGER NOT NULL DEFAULT 1");
      addColumnIfMissing("users", "full_name", "TEXT");
      addColumnIfMissing("users", "email", "TEXT");

      db.exec(`
        CREATE TABLE IF NOT EXISTS project_cell_values (
          project_id TEXT NOT NULL,
          sheet_name TEXT NOT NULL,
          cell TEXT NOT NULL,
          value TEXT,
          revision INTEGER NOT NULL DEFAULT 0,
          updated_by TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (project_id, sheet_name, cell),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_cell_values_proj ON project_cell_values(project_id, sheet_name);

        CREATE TABLE IF NOT EXISTS project_member_permissions (
          project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          sheet_name TEXT NOT NULL,
          editable_ranges TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (project_id, user_id, sheet_name),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          username TEXT,
          action TEXT NOT NULL,
          resource TEXT NOT NULL,
          resource_id TEXT,
          ip_address TEXT,
          user_agent TEXT,
          detail TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
      `);

      // Khởi tạo project_cell_values từ các edit hiện có
      try {
        const allEdits = db.prepare(`SELECT * FROM edits ORDER BY project_id, sequence ASC, timestamp ASC, rowid ASC`).all() as any[];
        const upsertCell = db.prepare(`
          INSERT INTO project_cell_values (project_id, sheet_name, cell, value, revision, updated_by, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(project_id, sheet_name, cell) DO UPDATE SET
            value = excluded.value,
            revision = project_cell_values.revision + 1,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `);
        for (const ed of allEdits) {
          upsertCell.run(ed.project_id, ed.sheet_name, ed.cell, ed.new_value ?? "", ed.username || "system", ed.timestamp);
        }
      } catch (err) {
        console.warn("[db] Backfill project_cell_values skipped:", err);
      }
    },
  },
  {
    id: 6,
    name: "indexes_optimization: edits timestamp/user, cell_values project",
    up: () => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_edits_project_timestamp ON edits(project_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_edits_project_user ON edits(project_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_cell_values_project ON project_cell_values(project_id);
      `);
    },
  },
];

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    (db.prepare("SELECT id FROM schema_migrations").all() as { id: number }[]).map((r) => r.id)
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    db.transaction(() => {
      m.up();
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)").run(
        m.id,
        m.name,
        new Date().toISOString()
      );
    })();
    console.log(`[db] Migration #${m.id} đã áp dụng: ${m.name}`);
  }
}

/* --------------------------------- Seed --------------------------------- */

function seedUsers() {
  const count = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (count.c > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(
    "INSERT INTO users (id, username, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  );

  if (isProduction()) {
    // Production: KHÔNG seed tài khoản mật khẩu mặc định.
    const pwd = process.env.ADMIN_INITIAL_PASSWORD || "";
    const username = (process.env.ADMIN_INITIAL_USERNAME || "admin").trim();
    if (pwd.length < 10) {
      console.warn(
        "[security] Chưa có tài khoản nào. Đặt ADMIN_INITIAL_PASSWORD (>= 10 ký tự) rồi khởi động lại để tạo tài khoản admin đầu tiên."
      );
      return;
    }
    insert.run("admin1", username, bcrypt.hashSync(pwd, 10), "admin", now);
    console.log(`[security] Đã tạo tài khoản admin đầu tiên: ${username}. Hãy xoá ADMIN_INITIAL_PASSWORD khỏi môi trường.`);
    return;
  }

  // Dev/test: tài khoản mẫu để thử nhanh (KHÔNG dùng khi production).
  insert.run("admin1", "admin", bcrypt.hashSync("password", 10), "admin", now);
  insert.run("manager1", "manager", bcrypt.hashSync("password", 10), "manager", now);
  insert.run("user1", "user", bcrypt.hashSync("password", 10), "user", now);
}

/* ------------------------------- Helpers -------------------------------- */

export function publicUser(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    role: u.role as "admin" | "manager" | "user",
    fullName: u.full_name || u.username,
    email: u.email || "",
    tokenVersion: u.token_version ?? 1,
    active: !!u.active,
  };
}

export type ProjectStats = {
  editCount: number;
  quotationVersion: number;
  finalizedVersion: number | null;
};

export function getProjectStats(project: ProjectRow): ProjectStats {
  const e = getDb().prepare("SELECT COUNT(*) AS c FROM edits WHERE project_id = ?").get(project.id) as { c: number };
  const v = getDb()
    .prepare("SELECT COALESCE(MAX(version), 0) AS m FROM versions WHERE project_id = ?")
    .get(project.id) as { m: number };
  let finalizedVersion: number | null = null;
  if (project.finalized_snapshot_id) {
    const f = getDb()
      .prepare("SELECT version FROM versions WHERE id = ?")
      .get(project.finalized_snapshot_id) as { version: number } | undefined;
    finalizedVersion = f ? f.version : null;
  }
  return { editCount: e.c, quotationVersion: v.m, finalizedVersion };
}

export function projectToJson(p: ProjectRow, memberIds: string[] = [], stats?: ProjectStats) {
  const s = stats ?? getProjectStats(p);
  return {
    id: p.id,
    name: p.name,
    sheets: p.sheets ? JSON.parse(p.sheets) : [],
    editableRanges: p.editable_ranges ? JSON.parse(p.editable_ranges) : {},
    soBaoGia: p.so_bao_gia,
    tenKhachHang: p.ten_khach_hang,
    nguoiPhuTrachId: p.nguoi_phu_trach_id,
    memberIds,
    trangThai: normalizeTrangThai(p.trang_thai),
    ghiChu: p.ghi_chu,
    version: p.version ?? 1,
    /** Tăng khi dữ liệu làm việc đổi; client gửi lại dưới tên expectedRevision. */
    projectRevision: p.project_revision,
    /** Số phiên bản báo giá (snapshot) mới nhất. 0 nếu chưa chốt lần nào. */
    quotationVersion: s.quotationVersion,
    finalizedSnapshotId: p.finalized_snapshot_id,
    finalizedVersion: s.finalizedVersion,
    editCount: s.editCount,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    deletedAt: p.deleted_at,
  };
}

export function editToJson(e: EditRow) {
  return {
    id: e.id,
    projectId: e.project_id,
    userId: e.user_id,
    username: e.username,
    sheetName: e.sheet_name,
    cell: e.cell,
    oldValue: e.old_value ?? "",
    newValue: e.new_value ?? "",
    sequence: e.sequence,
    needsReview: !!e.needs_review,
    timestamp: e.timestamp,
  };
}

export function versionToJson(v: VersionRow, finalizedSnapshotId?: string | null) {
  return {
    id: v.id,
    projectId: v.project_id,
    version: v.version,
    note: v.note,
    createdBy: v.created_by,
    createdAt: v.created_at,
    sourceRevision: v.source_revision,
    checksum: v.checksum,
    fileSize: v.file_size,
    sentBy: v.sent_by,
    sentAt: v.sent_at,
    isFinalized: !!finalizedSnapshotId && finalizedSnapshotId === v.id,
  };
}

export function getProjectMembers(projectId: string): string[] {
  const rows = getDb()
    .prepare("SELECT user_id FROM project_members WHERE project_id = ?")
    .all(projectId) as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

export function setProjectMembers(projectId: string, memberIds: string[]) {
  const database = getDb();
  const setMembersTx = database.transaction((pId: string, mIds: string[]) => {
    database.prepare("DELETE FROM project_members WHERE project_id = ?").run(pId);
    const insert = database.prepare("INSERT INTO project_members (project_id, user_id) VALUES (?, ?)");
    for (const uid of new Set(mIds)) {
      insert.run(pId, uid);
    }
  });
  setMembersTx(projectId, memberIds);
}

/** Phiên bản dùng cho PermProject (quy tắc phân quyền dùng chung). */
export function toPermProject(project: ProjectRow, stats?: ProjectStats) {
  return {
    trangThai: project.trang_thai,
    nguoiPhuTrachId: project.nguoi_phu_trach_id,
    memberIds: getProjectMembers(project.id),
    editCount: (stats ?? getProjectStats(project)).editCount,
  };
}

export function userCanAccessProject(user: { id: string; role: string }, project: ProjectRow): boolean {
  if (project.archived_at) return false;
  return canReadProject(user, {
    trangThai: project.trang_thai,
    nguoiPhuTrachId: project.nguoi_phu_trach_id,
    memberIds: user.role === "admin" || user.role === "manager" ? [] : getProjectMembers(project.id),
  });
}

export function isProjectLocked(trangThai: TrangThai | string): boolean {
  return isLockedStatus(trangThai);
}

export function incrementUserTokenVersion(userId: string): number {
  getDb().prepare("UPDATE users SET token_version = token_version + 1 WHERE id = ?").run(userId);
  const row = getDb().prepare("SELECT token_version FROM users WHERE id = ?").get(userId) as { token_version: number } | undefined;
  return row ? row.token_version : 1;
}

export function recordAuditLog(entry: {
  userId?: string | null;
  username?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  detail?: any;
}) {
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    getDb()
      .prepare(
        `INSERT INTO audit_logs (id, user_id, username, action, resource, resource_id, ip_address, user_agent, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        entry.userId || null,
        entry.username || null,
        entry.action,
        entry.resource,
        entry.resourceId || null,
        entry.ipAddress || null,
        entry.userAgent || null,
        typeof entry.detail === "string" ? entry.detail : JSON.stringify(entry.detail || {}),
        new Date().toISOString()
      );
  } catch (err) {
    console.error("[audit_log] Lỗi ghi audit log:", err);
  }
}

export function getCellValue(projectId: string, sheetName: string, cell: string): CellValueRow | undefined {
  return getDb()
    .prepare("SELECT * FROM project_cell_values WHERE project_id = ? AND sheet_name = ? AND cell = ?")
    .get(projectId, sheetName, cell) as CellValueRow | undefined;
}

export function getAllCellValuesForProject(projectId: string): Record<string, Record<string, { value: string; revision: number; updatedBy: string; updatedAt: string }>> {
  const rows = getDb()
    .prepare("SELECT sheet_name, cell, value, revision, updated_by, updated_at FROM project_cell_values WHERE project_id = ?")
    .all(projectId) as CellValueRow[];

  const result: Record<string, Record<string, { value: string; revision: number; updatedBy: string; updatedAt: string }>> = {};
  for (const r of rows) {
    if (!result[r.sheet_name]) result[r.sheet_name] = {};
    result[r.sheet_name][r.cell] = {
      value: r.value ?? "",
      revision: r.revision,
      updatedBy: r.updated_by,
      updatedAt: r.updated_at,
    };
  }
  return result;
}

export function getMemberCustomRanges(projectId: string, userId: string, sheetName: string): string | null {
  const row = getDb()
    .prepare("SELECT editable_ranges FROM project_member_permissions WHERE project_id = ? AND user_id = ? AND sheet_name = ?")
    .get(projectId, userId, sheetName) as { editable_ranges: string } | undefined;
  return row ? row.editable_ranges : null;
}

export function getProjectMemberPermissions(projectId: string): ProjectMemberPermissionRow[] {
  return getDb()
    .prepare("SELECT * FROM project_member_permissions WHERE project_id = ?")
    .all(projectId) as ProjectMemberPermissionRow[];
}

export function setProjectMemberPermissions(
  projectId: string,
  permissions: { userId: string; sheetName: string; editableRanges: string }[]
) {
  const database = getDb();
  database.transaction(() => {
    database.prepare("DELETE FROM project_member_permissions WHERE project_id = ?").run(projectId);
    const insert = database.prepare(
      "INSERT INTO project_member_permissions (project_id, user_id, sheet_name, editable_ranges) VALUES (?, ?, ?, ?)"
    );
    for (const p of permissions) {
      if (p.userId && p.sheetName) {
        insert.run(projectId, p.userId, p.sheetName, p.editableRanges || "");
      }
    }
  })();
}

export function countActiveAdmins(): number {
  const row = getDb().prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1").get() as { c: number };
  return row ? row.c : 0;
}

export function userHasProjectOrEditReferences(userId: string): { hasReferences: boolean; reason?: string } {
  const database = getDb();
  const ownedProject = database.prepare("SELECT name FROM projects WHERE nguoi_phu_trach_id = ? AND deleted_at IS NULL LIMIT 1").get(userId) as { name: string } | undefined;
  if (ownedProject) {
    return { hasReferences: true, reason: `Đang là người phụ trách báo giá "${ownedProject.name}"` };
  }
  const memberProject = database.prepare("SELECT p.name FROM project_members pm JOIN projects p ON pm.project_id = p.id WHERE pm.user_id = ? AND p.deleted_at IS NULL LIMIT 1").get(userId) as { name: string } | undefined;
  if (memberProject) {
    return { hasReferences: true, reason: `Đang được phân công vào báo giá "${memberProject.name}"` };
  }
  const editRecord = database.prepare("SELECT id FROM edits WHERE user_id = ? LIMIT 1").get(userId) as { id: string } | undefined;
  if (editRecord) {
    return { hasReferences: true, reason: `Có dữ liệu lịch sử chỉnh sửa ô trong hệ thống` };
  }
  return { hasReferences: false };
}


import crypto from "crypto";
import { getDb, type ProjectRow } from "../db";
import { AppError } from "../utils/AppError";

export const now = () => new Date().toISOString();

export const newId = () => `${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;

/** Tải project (mặc định bỏ qua project đã lưu trữ). */
export function loadProject(id: string, includeArchived = false): ProjectRow | undefined {
  const row = getDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  if (!row) return undefined;
  if (row.archived_at && !includeArchived) return undefined;
  return row;
}

export function requireProject(id: string): ProjectRow {
  const p = loadProject(id);
  if (!p) throw new AppError("Project not found", 404);
  return p;
}

/**
 * Optimistic concurrency: nếu client gửi expectedRevision mà khác revision hiện tại => 409.
 * Trả về lỗi kèm currentRevision để frontend biết cần tải lại dữ liệu mới nhất.
 */
export function assertRevision(project: ProjectRow, expectedRevision: number | undefined | null) {
  if (expectedRevision === undefined || expectedRevision === null) return;
  if (project.project_revision !== expectedRevision) {
    throw new AppError("Dữ liệu báo giá đã thay đổi ở một phiên làm việc khác. Hãy tải lại rồi thử lại.", 409, {
      code: "REVISION_CONFLICT",
      currentRevision: project.project_revision,
      expectedRevision,
    });
  }
}

export type Actor = { id: string; username: string } | null;

/** Ghi sự kiện quản lý (đổi trạng thái, đổi người phụ trách, chốt snapshot...) vào project_events. */
export function recordEvent(projectId: string, type: string, actor: Actor, detail: Record<string, unknown> = {}) {
  getDb()
    .prepare(
      "INSERT INTO project_events (id, project_id, type, actor_id, actor_name, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(newId(), projectId, type, actor?.id ?? null, actor?.username ?? null, JSON.stringify(detail), now());
}

/* ---- Khóa tuần tự theo project cho các thao tác bất đồng bộ nhiều bước (chốt snapshot, thay file...) ---- */

const locks = new Map<string, Promise<unknown>>();

export async function withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(projectId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const chain = prev.then(() => gate);
  locks.set(projectId, chain);
  try {
    await prev.catch(() => {});
    return await fn();
  } finally {
    release();
    if (locks.get(projectId) === chain) locks.delete(projectId);
  }
}

/** Kiểm tra danh sách user được phân công: phải tồn tại, đang hoạt động và là nhân viên. */
export function assertAssignableUsers(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDb();
  for (const id of ids) {
    const row = db.prepare("SELECT role, active FROM users WHERE id = ?").get(id) as
      | { role: string; active: number }
      | undefined;
    if (!row || !row.active) throw new AppError("Người được phân công không tồn tại hoặc đã bị khóa", 400);
    if (row.role !== "user") throw new AppError("Chỉ có thể phân công cho tài khoản nhân viên", 400);
  }
}

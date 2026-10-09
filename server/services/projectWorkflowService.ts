import { getDb, recordProjectEvent, type ProjectRow, type TrangThai } from "../db";
import { AppError } from "../utils/AppError";
import { isLockedStatus, normalizeTrangThai } from "../../src/lib/constants";
import type { AuthUser } from "../auth";

export const USER_TRANSITIONS: Record<string, TrangThai[]> = {
  nhap: ["dang_lam"],
  dang_lam: ["cho_gui"],
  cho_gui: ["da_gui"],
  da_gui: [],
  cho_duyet: ["dang_lam", "cho_gui", "da_gui"],
  da_duyet: ["dang_lam", "cho_gui", "da_gui"],
};

export const ADMIN_TRANSITIONS: Record<string, TrangThai[]> = {
  nhap: ["dang_lam", "cho_gui", "da_gui"],
  dang_lam: ["cho_gui", "da_gui", "nhap"],
  cho_gui: ["dang_lam", "da_gui", "nhap"],
  da_gui: ["dang_lam", "cho_gui", "nhap"],
  cho_duyet: ["dang_lam", "cho_gui", "da_gui", "nhap"],
  da_duyet: ["dang_lam", "cho_gui", "da_gui", "nhap"],
};

export function canUserTransition(role: string, currentStatus: string, nextStatus: TrangThai): boolean {
  const normCurrent = normalizeTrangThai(currentStatus);
  const map = role === "admin" || role === "manager" ? ADMIN_TRANSITIONS : USER_TRANSITIONS;
  const allowed = map[normCurrent] || map[currentStatus] || [];
  return allowed.includes(nextStatus);
}

export function isProjectMutationLocked(project: ProjectRow): boolean {
  if (project.locked_manually === 1) return true;
  return isLockedStatus(project.trang_thai);
}

export async function transitionProjectStatus(
  project: ProjectRow,
  nextStatus: TrangThai,
  actor: AuthUser,
  note?: string
): Promise<ProjectRow> {
  const normNext = normalizeTrangThai(nextStatus);
  if (!canUserTransition(actor.role, project.trang_thai, normNext)) {
    throw new AppError(
      `Không thể chuyển trạng thái từ "${project.trang_thai}" sang "${normNext}" với vai trò ${actor.role}`,
      400
    );
  }

  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE projects SET trang_thai = ?, updated_at = ?, project_revision = project_revision + 1 WHERE id = ?")
    .run(normNext, now, project.id);

  recordProjectEvent(project.id, "STATUS_CHANGED", actor.id, actor.username, {
    from: project.trang_thai,
    to: normNext,
    note: note || "",
  });

  const updated = getDb().prepare("SELECT * FROM projects WHERE id = ?").get(project.id) as ProjectRow;
  return updated;
}

export async function lockProjectManually(
  project: ProjectRow,
  actor: AuthUser,
  reason: string
): Promise<ProjectRow> {
  if (actor.role !== "admin") {
    throw new AppError("Chỉ Quản trị viên (Admin) mới có quyền khóa thủ công báo giá (UC10)", 403);
  }

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE projects 
       SET locked_manually = 1, locked_by = ?, locked_at = ?, lock_reason = ?, updated_at = ?, project_revision = project_revision + 1 
       WHERE id = ?`
    )
    .run(actor.username, now, reason || "Khóa bởi Admin", now, project.id);

  recordProjectEvent(project.id, "PROJECT_LOCKED", actor.id, actor.username, {
    reason: reason || "Khóa bởi Admin",
  });

  const updated = getDb().prepare("SELECT * FROM projects WHERE id = ?").get(project.id) as ProjectRow;
  return updated;
}

export async function unlockProjectManually(
  project: ProjectRow,
  actor: AuthUser,
  reason: string
): Promise<ProjectRow> {
  if (actor.role !== "admin") {
    throw new AppError("Chỉ Quản trị viên (Admin) mới có quyền mở khóa báo giá (UC10)", 403);
  }

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE projects 
       SET locked_manually = 0, locked_by = NULL, locked_at = NULL, lock_reason = NULL, updated_at = ?, project_revision = project_revision + 1 
       WHERE id = ?`
    )
    .run(now, project.id);

  recordProjectEvent(project.id, "PROJECT_UNLOCKED", actor.id, actor.username, {
    reason: reason || "Mở khóa bởi Admin",
  });

  const updated = getDb().prepare("SELECT * FROM projects WHERE id = ?").get(project.id) as ProjectRow;
  return updated;
}

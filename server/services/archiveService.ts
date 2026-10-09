import {
  getDb,
  hardDeleteProject,
  recordAuditLog,
  recordProjectEvent,
  type ProjectRow,
} from "../db";
import { AppError } from "../utils/AppError";
import { deleteProjectFiles } from "../files";
import type { AuthUser } from "../auth";

export async function handleProjectDelete(
  project: ProjectRow,
  actor: AuthUser
): Promise<{ ok: boolean; isDelete: boolean; deletedAt: string; permanentlyDeletedAt: string }> {
  // 1. Phân quyền UC11:
  // - Nhân viên (user) CHỈ ĐƯỢC XÓA NHÁP CỦA CHÍNH MÌNH (trạng thái 'nhap')
  if (actor.role === "user") {
    if (project.trang_thai !== "nhap") {
      throw new AppError("Nhân viên chỉ có quyền xóa các báo giá ở trạng thái Mới giao (nháp)", 403);
    }
    const isOwner = project.nguoi_phu_trach_id === actor.id;
    if (!isOwner) {
      throw new AppError("Bạn chỉ có quyền xóa bản nháp do chính mình phụ trách", 403);
    }
  }

  const deletedAt = new Date().toISOString();
  getDb()
    .prepare("UPDATE projects SET isDelete = 1, deleted_at = ?, updated_at = ? WHERE id = ?")
    .run(deletedAt, deletedAt, project.id);

  recordProjectEvent(project.id, "SOFT_DELETED", actor.id, actor.username, {
    deletedAt,
  });

  const permanentlyDeletedAt = new Date(Date.parse(deletedAt) + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { ok: true, isDelete: true, deletedAt, permanentlyDeletedAt };
}

export async function archiveProject(
  project: ProjectRow,
  actor: AuthUser
): Promise<ProjectRow> {
  // Kế toán / Quản lý hoặc Admin có quyền lưu trữ (UC11)
  if (actor.role !== "manager" && actor.role !== "admin") {
    throw new AppError("Chỉ Quản lý hoặc Admin mới có quyền lưu trữ báo giá (UC11)", 403);
  }

  if (project.isDelete) {
    throw new AppError("Không thể lưu trữ báo giá đang nằm trong thùng rác", 400);
  }

  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE projects SET archived_at = ?, archived_by = ?, updated_at = ? WHERE id = ?")
    .run(now, actor.username, now, project.id);

  recordProjectEvent(project.id, "ARCHIVED", actor.id, actor.username, {
    archivedAt: now,
  });

  recordAuditLog({
    userId: actor.id,
    username: actor.username,
    action: "PROJECT_ARCHIVED",
    resource: "projects",
    resourceId: project.id,
    detail: { projectName: project.name },
  });

  return getDb().prepare("SELECT * FROM projects WHERE id = ?").get(project.id) as ProjectRow;
}

export async function unarchiveProject(
  project: ProjectRow,
  actor: AuthUser
): Promise<ProjectRow> {
  if (actor.role !== "manager" && actor.role !== "admin") {
    throw new AppError("Chỉ Quản lý hoặc Admin mới có quyền khôi phục lưu trữ báo giá (UC11)", 403);
  }

  if (!project.archived_at) {
    throw new AppError("Báo giá này chưa bị lưu trữ", 400);
  }

  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE projects SET archived_at = NULL, archived_by = NULL, updated_at = ? WHERE id = ?")
    .run(now, project.id);

  recordProjectEvent(project.id, "UNARCHIVED", actor.id, actor.username, {
    unarchivedAt: now,
  });

  recordAuditLog({
    userId: actor.id,
    username: actor.username,
    action: "PROJECT_UNARCHIVED",
    resource: "projects",
    resourceId: project.id,
    detail: { projectName: project.name },
  });

  return getDb().prepare("SELECT * FROM projects WHERE id = ?").get(project.id) as ProjectRow;
}

export async function permanentDeleteProject(
  project: ProjectRow,
  actor: AuthUser
): Promise<{ ok: boolean; purgedProjectId: string }> {
  // Chỉ Quản trị viên (Admin) mới có quyền xóa vĩnh viễn (UC11)
  if (actor.role !== "admin") {
    throw new AppError("Chỉ Quản trị viên (Admin) mới có quyền xóa vĩnh viễn báo giá (UC11)", 403);
  }

  // 1. Xóa toàn bộ file vật lý trên đĩa
  await deleteProjectFiles(project.id);

  // 2. Cascade delete toàn bộ dữ liệu liên quan trong DB
  hardDeleteProject(project.id);

  recordAuditLog({
    userId: actor.id,
    username: actor.username,
    action: "PROJECT_PERMANENTLY_PURGED",
    resource: "projects",
    resourceId: project.id,
    detail: { projectName: project.name, purgedBy: actor.username },
  });

  return { ok: true, purgedProjectId: project.id };
}

export function getArchivedProjectsList() {
  return getDb()
    .prepare(
      `SELECT * FROM projects 
       WHERE isDelete = 0 AND archived_at IS NOT NULL 
       ORDER BY archived_at DESC`
    )
    .all() as ProjectRow[];
}

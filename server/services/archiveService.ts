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

export type ProjectDeleteResult =
  | {
      ok: true;
      mode: "hard";
      isDelete: true;
      purgedProjectId: string;
    }
  | {
      ok: true;
      mode: "soft";
      isDelete: true;
      deletedAt: string;
      permanentlyDeletedAt: string;
    };

/**
 * UC11: Thao tác xóa báo giá theo chính sách mới của dự án Phúc Gia:
 * - Admin và Manager: XÓA CỨNG NGAY LẦN BẤM XÓA, không lưu vào thùng rác. Xóa sạch DB (cascade) và tệp đĩa.
 * - User (Nhân viên kỹ thuật): XÓA MỀM VÀO THÙNG RÁC (30 ngày retention). Chỉ được xóa nháp của chính mình.
 */
export async function handleProjectDelete(
  project: ProjectRow,
  actor: AuthUser
): Promise<ProjectDeleteResult> {
  // 1. Phân quyền và điều hướng theo chính sách UC11 mới:
  if (actor.role === "admin" || actor.role === "manager") {
    const res = await hardDeleteProjectSafely(project, actor);
    return {
      ok: true,
      mode: "hard",
      isDelete: true,
      purgedProjectId: res.purgedProjectId,
    };
  }

  // 2. Vai trò User (Nhân viên): Xóa mềm vào Thùng rác
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
    mode: "soft",
  });

  recordAuditLog({
    userId: actor.id,
    username: actor.username,
    action: "PROJECT_SOFT_DELETED",
    resource: "projects",
    resourceId: project.id,
    detail: { projectName: project.name, mode: "soft", deletedAt },
  });

  const permanentlyDeletedAt = new Date(Date.parse(deletedAt) + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { ok: true, mode: "soft", isDelete: true, deletedAt, permanentlyDeletedAt };
}

/**
 * Xóa cứng an toàn 2-pha: ghi nhận audit receipt -> cascade delete DB -> dọn dẹp file vật lý.
 * Cho phép cả Admin và Manager thực thi (UC11).
 */
export async function hardDeleteProjectSafely(
  project: ProjectRow,
  actor: AuthUser
): Promise<{ ok: boolean; purgedProjectId: string }> {
  if (actor.role !== "admin" && actor.role !== "manager") {
    throw new AppError("Chỉ Quản trị viên (Admin) hoặc Quản lý (Manager) mới có quyền xóa vĩnh viễn báo giá (UC11)", 403);
  }

  const projectId = project.id;
  const projectName = project.name;

  // 1. Ghi nhận audit receipt trước khi xóa dữ liệu DB (tránh mất vết vì cascade)
  recordAuditLog({
    userId: actor.id,
    username: actor.username,
    action: "PROJECT_PERMANENTLY_PURGED",
    resource: "projects",
    resourceId: projectId,
    detail: { projectName, purgedBy: actor.username, actorRole: actor.role },
  });

  // 2. Cascade delete toàn bộ dữ liệu liên quan trong DB
  hardDeleteProject(projectId);

  // 3. Dọn dẹp tệp vật lý trên đĩa
  try {
    await deleteProjectFiles(projectId);
  } catch (err: any) {
    console.error(`[Cleanup Warning] Lỗi khi dọn tệp dự án ${projectId}:`, err);
  }

  return { ok: true, purgedProjectId: projectId };
}

export async function archiveProject(
  project: ProjectRow,
  actor: AuthUser
): Promise<ProjectRow> {
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
  return hardDeleteProjectSafely(project, actor);
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

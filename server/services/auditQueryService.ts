import { getGlobalEdits, type GlobalEditsFilter } from "../db";
import { AppError } from "../utils/AppError";
import type { AuthUser } from "../auth";

export function queryGlobalEdits(actor: AuthUser, filters: GlobalEditsFilter) {
  // Chỉ Quản trị viên (Admin) mới có quyền kiểm toán toàn bộ vết sửa đổi (UC21)
  if (actor.role !== "admin") {
    throw new AppError("Chỉ Quản trị viên (Admin) mới có quyền xem toàn bộ vết sửa đổi toàn hệ thống (UC21)", 403);
  }

  return getGlobalEdits(filters);
}

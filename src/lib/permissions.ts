/**
 * Quy tắc phân quyền TẬP TRUNG - dùng chung frontend + backend.
 * Frontend dùng để ẩn/hiện nút; Backend dùng để CHẶN thật sự. Hai phía gọi cùng một hàm.
 */
import { isLockedStatus, normalizeTrangThai, type TrangThai } from "./constants";

export type Role = "admin" | "manager" | "user";

export interface PermUser {
  id: string;
  role: Role | string;
}

/** Phần thông tin tối thiểu của dự án mà các quy tắc cần. */
export interface PermProject {
  trangThai?: string | null;
  nguoiPhuTrachId?: string | null;
  memberIds?: string[];
  /** số bản ghi edit đã có. Thiếu thì coi như 0. */
  editCount?: number;
}

/** Admin hoặc Manager: toàn quyền quản lý nghiệp vụ báo giá. */
export function canManageQuotation(role?: string | null): boolean {
  return role === "admin" || role === "manager";
}

/** Chỉ Admin được quản trị tài khoản hệ thống. */
export function canManageUsers(role?: string | null): boolean {
  return role === "admin";
}

/** Nhân viên có được phân công vào dự án này không (người phụ trách hoặc thành viên)? */
export function isAssignedToProject(user: PermUser | null | undefined, project: PermProject): boolean {
  if (!user) return false;
  if (project.nguoiPhuTrachId && project.nguoiPhuTrachId === user.id) return true;
  return (project.memberIds || []).includes(user.id);
}

/** Admin, Manager hoặc nhân viên được phân công. */
export function canReadProject(user: PermUser | null | undefined, project: PermProject): boolean {
  if (!user) return false;
  return canManageQuotation(user.role) || isAssignedToProject(user, project);
}

/**
 * Được phép nhập liệu vào ô của dự án hay không (chưa xét ô cụ thể có thuộc vùng cho phép).
 * Chỉ NHÂN VIÊN được phân công, và chỉ khi dự án đang ở trạng thái `dang_lam`.
 */
export function canEditProjectCells(user: PermUser | null | undefined, project: PermProject): boolean {
  if (!user || user.role !== "user") return false;
  if (!isAssignedToProject(user, project)) return false;
  return normalizeTrangThai(project.trangThai) === "dang_lam";
}

/** Lý do (tiếng Việt) khi KHÔNG được nhập liệu, phục vụ thông báo ở UI/API. Trả về null nếu được. */
export function explainCannotEditCells(user: PermUser | null | undefined, project: PermProject): string | null {
  if (!user) return "Chưa đăng nhập.";
  if (user.role !== "user") return "Chỉ nhân viên được phân công mới được nhập liệu vào báo giá.";
  if (!isAssignedToProject(user, project)) return "Bạn không được phân công cho báo giá này.";
  const s = normalizeTrangThai(project.trangThai);
  if (s === "nhap") return 'Báo giá chưa bắt đầu điền. Hãy bấm "Bắt đầu điền" trước.';
  if (s === "cho_gui" || s === "da_gui") return "Báo giá đã chốt/gửi khách nên không thể chỉnh sửa. Nhờ Quản lý mở lại nếu cần.";
  return null;
}

/**
 * Được thay đổi CẤU TRÚC workbook (thêm/xóa dòng, cột, thay file nền) không?
 * Chỉ Admin/Manager, khi dự án còn ở giai đoạn cấu hình (`nhap`) VÀ chưa có edit nào.
 * (Chốt chặn thứ hai: dù trạng thái là `nhap` nhưng đã có edit thì vẫn khóa, vì địa chỉ ô của edit sẽ bị lệch.)
 */
export function canModifyWorkbookStructure(user: PermUser | null | undefined, project: PermProject): boolean {
  if (!user || !canManageQuotation(user.role)) return false;
  if (normalizeTrangThai(project.trangThai) !== "nhap") return false;
  return (project.editCount || 0) === 0;
}

/** Được cấu hình vùng nhập liệu (editableRanges) không? Chỉ Admin/Manager khi còn ở giai đoạn cấu hình. */
export function canConfigureRanges(user: PermUser | null | undefined, project: PermProject): boolean {
  if (!user || !canManageQuotation(user.role)) return false;
  return normalizeTrangThai(project.trangThai) === "nhap";
}

/**
 * Quyền sửa metadata (tên, số BG, khách hàng, người phụ trách, thành viên).
 * Khi đã chốt/gửi chỉ còn được sửa ghi chú.
 */
export function canEditProjectMeta(user: PermUser | null | undefined, project: PermProject): boolean {
  if (!user || !canManageQuotation(user.role)) return false;
  return !isLockedStatus(project.trangThai);
}

export type WorkflowAction = "start" | "back_to_config" | "finalize" | "mark_sent" | "reopen";

export const WORKFLOW_ACTION_LABELS: Record<WorkflowAction, string> = {
  start: "Bắt đầu điền",
  back_to_config: "Về giai đoạn cấu hình",
  finalize: "Chốt báo giá",
  mark_sent: "Xác nhận đã gửi khách",
  reopen: "Mở lại để điền tiếp",
};

/** Trạng thái đích khi thực hiện một hành động workflow. */
export const WORKFLOW_TARGET: Record<WorkflowAction, TrangThai> = {
  start: "dang_lam",
  back_to_config: "nhap",
  finalize: "cho_gui",
  mark_sent: "da_gui",
  reopen: "dang_lam",
};

/** Người dùng có được thực hiện hành động workflow này ở trạng thái hiện tại của dự án không? */
export function canPerformWorkflowAction(
  action: WorkflowAction,
  user: PermUser | null | undefined,
  project: PermProject
): boolean {
  if (!user) return false;
  const status = normalizeTrangThai(project.trangThai);
  const manager = canManageQuotation(user.role);
  const assigned = isAssignedToProject(user, project);

  switch (action) {
    case "start":
      return status === "nhap" && (manager || assigned);
    case "back_to_config":
      return status === "dang_lam" && manager;
    case "finalize":
      return status === "dang_lam" && (manager || assigned);
    case "mark_sent":
      return status === "cho_gui" && (manager || assigned);
    case "reopen":
      return (status === "cho_gui" || status === "da_gui") && manager;
    default:
      return false;
  }
}

/** Danh sách hành động workflow khả dụng cho người dùng (thứ tự hiển thị trên UI). */
export function getAvailableWorkflowActions(
  user: PermUser | null | undefined,
  project: PermProject
): WorkflowAction[] {
  const order: WorkflowAction[] = ["start", "finalize", "mark_sent", "reopen", "back_to_config"];
  return order.filter((a) => canPerformWorkflowAction(a, user, project));
}

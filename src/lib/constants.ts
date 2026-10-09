/**
 * Vòng đời báo giá (dùng chung frontend + backend):
 *
 *   nhap ──start──▶ dang_lam ──finalize──▶ cho_gui ──mark-sent──▶ da_gui
 *     ▲                │                      │                     │
 *     └──back_to_config┘                      └────────reopen───────┴──▶ dang_lam
 *
 *  - nhap     : Mới giao. Admin/Manager cấu hình cấu trúc, vùng sửa, phân công.
 *  - dang_lam : Nhân viên đang điền. Cấu trúc workbook bị đóng băng.
 *  - cho_gui  : Đã chốt, đã tạo snapshot bất biến. Không sửa được nữa. Tải file để gửi khách.
 *  - da_gui   : Nhân viên xác nhận đã gửi một phiên bản cho khách.
 */
export type TrangThai = "nhap" | "dang_lam" | "cho_gui" | "da_gui";

export const TRANG_THAI_VALUES: TrangThai[] = ["nhap", "dang_lam", "cho_gui", "da_gui"];

export const TRANG_THAI_LABELS: Record<TrangThai, string> = {
  nhap: "Mới giao",
  dang_lam: "Đang điền",
  cho_gui: "Đã chốt - chờ gửi",
  da_gui: "Đã gửi khách",
};

export const TRANG_THAI_COLORS: Record<TrangThai, string> = {
  nhap: "bg-slate-100 text-slate-700 border-slate-200",
  dang_lam: "bg-blue-50 text-blue-700 border-blue-200",
  cho_gui: "bg-amber-50 text-amber-700 border-amber-200",
  da_gui: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

/** Khóa nhập liệu: sau khi chốt hoặc đã gửi khách (Admin/Manager có thể mở lại). */
export const LOCKED_STATUSES: TrangThai[] = ["cho_gui", "da_gui"];

/** Chuẩn hoá giá trị trạng thái cũ (legacy) về 4 trạng thái hiện tại. */
export function normalizeTrangThai(status?: string | null): TrangThai {
  if (status === "da_gui" || status === "da_duyet") return "da_gui";
  if (status === "cho_gui") return "cho_gui";
  if (status === "dang_lam" || status === "cho_duyet") return "dang_lam";
  return "nhap";
}

export function isLockedStatus(status?: string | null): boolean {
  return LOCKED_STATUSES.includes(normalizeTrangThai(status));
}

/** Nút chuyển trạng thái cho nhân viên */
export const USER_STATUS_ACTIONS: Partial<Record<TrangThai, { label: string; next: TrangThai }[]>> = {
  nhap: [{ label: "Bắt đầu điền", next: "dang_lam" }],
  dang_lam: [{ label: "Chốt & Chờ gửi", next: "cho_gui" }],
  cho_gui: [{ label: "Đánh dấu đã gửi khách", next: "da_gui" }],
};

/** Nút chuyển trạng thái cho admin */
export const ADMIN_STATUS_ACTIONS: Partial<Record<TrangThai, { label: string; next: TrangThai }[]>> = {
  nhap: [{ label: "Đánh dấu đang điền", next: "dang_lam" }],
  dang_lam: [
    { label: "Chốt & Chờ gửi", next: "cho_gui" },
    { label: "Trả về Mới giao", next: "nhap" },
  ],
  cho_gui: [
    { label: "Đánh dấu đã gửi khách", next: "da_gui" },
    { label: "Mở lại để điền tiếp", next: "dang_lam" },
  ],
  da_gui: [{ label: "Mở lại để điền tiếp", next: "dang_lam" }],
};


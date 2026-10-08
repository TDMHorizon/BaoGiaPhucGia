/** Quy trình: admin cấu hình bản gốc → user điền ô được phép → tải Excel gửi khách. */
export type TrangThai = "nhap" | "dang_lam" | "da_gui";

export const TRANG_THAI_LABELS: Record<TrangThai, string> = {
  nhap: "Mới giao",
  dang_lam: "Đang điền",
  da_gui: "Đã gửi khách",
};

export const TRANG_THAI_COLORS: Record<TrangThai, string> = {
  nhap: "bg-slate-100 text-slate-700 border-slate-200",
  dang_lam: "bg-blue-50 text-blue-700 border-blue-200",
  da_gui: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

/** Chỉ khóa sửa khi đã gửi khách (admin có thể mở lại). */
export const LOCKED_STATUSES: TrangThai[] = ["da_gui"];

export function normalizeTrangThai(status?: string): TrangThai {
  if (status === "da_gui" || status === "da_duyet") return "da_gui";
  if (status === "dang_lam" || status === "cho_duyet") return "dang_lam";
  return "nhap";
}

export function isLockedStatus(status?: string): boolean {
  return LOCKED_STATUSES.includes(normalizeTrangThai(status));
}

/** Nút chuyển trạng thái cho nhân viên */
export const USER_STATUS_ACTIONS: Partial<Record<TrangThai, { label: string; next: TrangThai }[]>> = {
  nhap: [{ label: "Bắt đầu điền", next: "dang_lam" }],
  dang_lam: [{ label: "Đánh dấu đã gửi khách", next: "da_gui" }],
};

/** Nút chuyển trạng thái cho admin */
export const ADMIN_STATUS_ACTIONS: Partial<Record<TrangThai, { label: string; next: TrangThai }[]>> = {
  nhap: [{ label: "Đánh dấu đang điền", next: "dang_lam" }],
  dang_lam: [
    { label: "Đánh dấu đã gửi khách", next: "da_gui" },
    { label: "Về mới giao", next: "nhap" },
  ],
  da_gui: [{ label: "Mở lại để điền tiếp", next: "dang_lam" }],
};

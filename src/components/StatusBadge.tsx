/**
 * StatusBadge - Backward compatibility wrapper
 *
 * Old API: <StatusBadge status="dang_lam" />
 * New API: <StatusBadge variant="info">Đang điền</StatusBadge>
 *
 * This file provides backward compatibility by wrapping the new StatusBadge
 * with the old status prop API.
 */
import { StatusBadge as StatusBadgeNew, type StatusVariant } from "./ui/status-badge";
import { TRANG_THAI_LABELS, normalizeTrangThai } from "../lib/constants";

// Map old status names to new variants
const STATUS_VARIANT_MAP: Record<string, StatusVariant> = {
  nhap: "neutral",
  dang_lam: "info",
  cho_duyet: "warning",
  tu_choi: "error",
  da_duyet: "success",
  da_gui: "purple",
  hoan_tat: "success",
};

export type { StatusVariant };

/**
 * Legacy StatusBadge - wraps new StatusBadge with old API
 *
 * Usage: <StatusBadge status="dang_lam" />
 * Instead of: <StatusBadge variant="info">Đang điền</StatusBadge>
 */
export function StatusBadge({ status, ...props }: { status?: string }) {
  const normalizedStatus = normalizeTrangThai(status);
  const variant = STATUS_VARIANT_MAP[normalizedStatus] || "neutral";
  const label = TRANG_THAI_LABELS[normalizedStatus as keyof typeof TRANG_THAI_LABELS] || status;

  return (
    <StatusBadgeNew variant={variant} {...props}>
      {label}
    </StatusBadgeNew>
  );
}

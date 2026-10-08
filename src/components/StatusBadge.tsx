import { TRANG_THAI_COLORS, TRANG_THAI_LABELS, normalizeTrangThai } from "../lib/constants";

export function StatusBadge({ status }: { status?: string }) {
  const s = normalizeTrangThai(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${TRANG_THAI_COLORS[s]}`}>
      {TRANG_THAI_LABELS[s]}
    </span>
  );
}

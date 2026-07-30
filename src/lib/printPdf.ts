import { TRANG_THAI_LABELS, normalizeTrangThai } from "./constants";

/** Mở cửa sổ in HTML để người dùng lưu PDF (Ctrl+P → Save as PDF). */
export function printProjectAsPdf(project: any, sheetData: any[][], activeSheet: string) {
  const rows = sheetData
    .map(
      (row) =>
        `<tr>${(row || [])
          .map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const statusLabel = TRANG_THAI_LABELS[normalizeTrangThai(project.trangThai)];
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(project.name || "Báo giá")}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; }
    td, th { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: top; }
    th { background: #f1f5f9; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(project.name || "Báo giá")}</h1>
  <div class="meta">
    Số BG: ${escapeHtml(project.soBaoGia || "—")} ·
    Khách hàng: ${escapeHtml(project.tenKhachHang || "—")} ·
    Trạng thái: ${escapeHtml(statusLabel)} ·
    Sheet: ${escapeHtml(activeSheet)} ·
    Phiên bản: v${project.version || 1}
  </div>
  <table>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

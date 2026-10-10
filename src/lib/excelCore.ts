/**
 * Các hàm Excel thuần (không import ExcelJS/XLSX) dùng CHUNG cho frontend và backend,
 * để cả hai phía áp dụng edit giống hệt nhau.
 * Tham số kiểu `any` là đối tượng của ExcelJS (Workbook / Worksheet / Cell).
 */

/**
 * Chuyển chuỗi người dùng nhập thành giá trị lưu vào ô.
 * - Số "thuần" (vd 150000, -3.5) => number.
 * - Mọi thứ khác (kể cả "0123", "1e5", "0x10", "100.000") => giữ nguyên là chuỗi
 *   để không làm mất số 0 đầu của mã/số điện thoại hoặc đổi nghĩa chuỗi.
 */
export function coerceEditValue(value: unknown): string | number {
  const s = value === null || value === undefined ? "" : String(value);
  if (/^-?(0|[1-9]\d{0,14})(\.\d{1,10})?$/.test(s.trim()) && s.trim() !== "-0") {
    return Number(s.trim());
  }
  return s;
}

/** Giá trị của một ô ExcelJS => chuỗi (công thức lấy kết quả đã tính, rich text ghép lại...). */
export function cellValueToString(value: any): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) return cellValueToString((value as any).result);
    if (Array.isArray((value as any).richText)) return (value as any).richText.map((t: any) => t.text).join("");
    if ("text" in value) return cellValueToString((value as any).text);
    if ("error" in value) return String((value as any).error);
  }
  return String(value);
}

/**
 * Ghi giá trị vào ô ĐẠI DIỆN (góc trên-trái) của vùng gộp.
 * `cellRef` phải là địa chỉ đã được xác định là ô đại diện.
 * Ghi đè công thức (nếu có) bằng giá trị người dùng nhập.
 */
export function applyEditToWorksheet(ws: any, cellRef: string, newValue: unknown): void {
  const cell = ws.getCell(cellRef);
  const target = cell.master ?? cell;
  target.value = coerceEditValue(newValue);
}

const EXTERNAL_REF = /\[\d+\]/;

/**
 * ExcelJS KHÔNG giữ lại phần "externalLinks" của file .xlsx. Công thức dạng
 * `'[17]2. GTHT'!A8` sẽ trỏ vào liên kết không còn tồn tại và Excel có thể báo file lỗi khi mở.
 * Hàm này thay các công thức đó bằng giá trị đã tính (cached result) để file xuất ra luôn mở được.
 * Trả về số ô đã chuyển thành giá trị tĩnh.
 */
export function freezeExternalLinkFormulas(workbook: any): number {
  let frozen = 0;
  workbook.eachSheet((ws: any) => {
    ws.eachRow({ includeEmpty: false }, (row: any) => {
      row.eachCell({ includeEmpty: false }, (cell: any) => {
        const v = cell.value;
        if (v && typeof v === "object" && typeof v.formula === "string" && EXTERNAL_REF.test(v.formula)) {
          const result = (v as any).result;
          cell.value = result === undefined || result === null || typeof result === "object" ? null : result;
          frozen++;
        }
      });
    });
  });
  return frozen;
}

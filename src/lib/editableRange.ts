/**
 * Quy tắc Editable Range dùng CHUNG cho frontend và backend.
 *
 * Nguyên tắc: mặc định TỪ CHỐI.
 *  - Chuỗi range rỗng / không hợp lệ  => không ô nào được sửa.
 *  - Chỉ ô nằm trong ít nhất một vùng hợp lệ mới được sửa.
 *
 * Định dạng hỗ trợ (ngăn cách bằng dấu phẩy, không phân biệt hoa/thường, bỏ qua `$`):
 *  - Một ô:            A1, $B$5
 *  - Vùng ô:           A1:C5   (đảo thứ tự B5:A1 vẫn hợp lệ)
 *  - Một cột:          A
 *  - Dải cột:          A:A, A:C
 *
 * File này cố ý KHÔNG import thư viện nào để chạy được ở cả trình duyệt lẫn Node.
 */

export const MAX_COL_INDEX = 16383; // XFD
export const MAX_ROW_INDEX = 1048575; // dòng 1048576

export interface CellAddress {
  /** chỉ số dòng, bắt đầu từ 0 */
  r: number;
  /** chỉ số cột, bắt đầu từ 0 */
  c: number;
}

export interface RangeRule {
  r1: number;
  r2: number;
  c1: number;
  c2: number;
}

/** "A" -> 0, "Z" -> 25, "AA" -> 26. Trả về -1 nếu không hợp lệ. */
export function colLettersToIndex(letters: string): number {
  const s = letters.toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(s)) return -1;
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  const idx = n - 1;
  return idx > MAX_COL_INDEX ? -1 : idx;
}

/** 0 -> "A", 26 -> "AA" */
export function indexToColLetters(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** "B5" -> {r:4,c:1}. Trả về null nếu không phải địa chỉ ô hợp lệ. */
export function parseCellRef(ref: string): CellAddress | null {
  if (typeof ref !== "string") return null;
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(ref.trim());
  if (!m) return null;
  const c = colLettersToIndex(m[1]);
  const r = parseInt(m[2], 10) - 1;
  if (c < 0 || r < 0 || r > MAX_ROW_INDEX) return null;
  return { r, c };
}

export function formatCellRef({ r, c }: CellAddress): string {
  return `${indexToColLetters(c)}${r + 1}`;
}

/** Parse một mục range ("A1", "A1:C5", "A", "A:C"). Trả về null nếu sai định dạng. */
export function parseRangeToken(token: string): RangeRule | null {
  const t = token.trim().replace(/\$/g, "");
  if (!t) return null;

  // Cột hoặc dải cột: A, A:A, A:C
  let m = /^([A-Za-z]{1,3})(?::([A-Za-z]{1,3}))?$/.exec(t);
  if (m) {
    const a = colLettersToIndex(m[1]);
    const b = m[2] ? colLettersToIndex(m[2]) : a;
    if (a < 0 || b < 0) return null;
    return { r1: 0, r2: MAX_ROW_INDEX, c1: Math.min(a, b), c2: Math.max(a, b) };
  }

  // Ô hoặc vùng ô: A1, A1:C5
  m = /^([A-Za-z]{1,3}\d{1,7})(?::([A-Za-z]{1,3}\d{1,7}))?$/.exec(t);
  if (m) {
    const a = parseCellRef(m[1]);
    const b = m[2] ? parseCellRef(m[2]) : a;
    if (!a || !b) return null;
    return {
      r1: Math.min(a.r, b.r),
      r2: Math.max(a.r, b.r),
      c1: Math.min(a.c, b.c),
      c2: Math.max(a.c, b.c),
    };
  }
  return null;
}

export interface ParsedRanges {
  rules: RangeRule[];
  /** các mục không hợp lệ (giữ nguyên văn bản gốc) */
  invalid: string[];
}

export function parseEditableRanges(rangeStr: string | null | undefined): ParsedRanges {
  const rules: RangeRule[] = [];
  const invalid: string[] = [];
  if (typeof rangeStr !== "string") return { rules, invalid };
  for (const raw of rangeStr.split(",")) {
    const token = raw.trim();
    if (!token) continue;
    const rule = parseRangeToken(token);
    if (rule) rules.push(rule);
    else invalid.push(token);
  }
  return { rules, invalid };
}

/**
 * Ô `cellRef` có nằm trong vùng được phép sửa không?
 * Range rỗng, thiếu hoặc sai định dạng => false (mặc định từ chối).
 */
export function isCellInRange(cellRef: string, rangeStr: string | null | undefined): boolean {
  const cell = parseCellRef(cellRef);
  if (!cell) return false;
  const { rules } = parseEditableRanges(rangeStr);
  if (rules.length === 0) return false;
  return rules.some((x) => cell.r >= x.r1 && cell.r <= x.r2 && cell.c >= x.c1 && cell.c <= x.c2);
}

/** Chuẩn hoá chuỗi range: bỏ khoảng trắng thừa, in hoa, bỏ `$`, loại trùng. Mục sai bị loại. */
export function normalizeEditableRanges(rangeStr: string | null | undefined): string {
  if (typeof rangeStr !== "string") return "";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rangeStr.split(",")) {
    const token = raw.trim().replace(/\$/g, "").toUpperCase();
    if (!token || !parseRangeToken(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out.join(", ");
}

/** Trả về danh sách lỗi (rỗng nếu hợp lệ) của một chuỗi range. */
export function validateEditableRangeString(rangeStr: string): string[] {
  return parseEditableRanges(rangeStr).invalid.map((t) => `Vùng "${t}" không đúng định dạng (ví dụ: A1, A1:D10, C, C:E)`);
}

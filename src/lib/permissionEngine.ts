import * as XLSX from 'xlsx';

export interface ParsedRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  isFullRow: boolean;
  isFullCol: boolean;
  raw: string;
}

export interface SheetGrants {
  read: string[];
  edit: string[];
}

export type ProjectUserPermissionsMap = Record<string, SheetGrants>;

export class PermissionEngine {
  /**
   * Parse chuỗi biểu diễn dải ô A1 (hỗ trợ A1, A1:D10, A:B, 5:10, phân tách bởi dấu phẩy, chấm phẩy hoặc xuống dòng)
   */
  public static parseRanges(rangeInput: string | string[]): ParsedRange[] {
    if (!rangeInput) return [];
    const items = Array.isArray(rangeInput)
      ? rangeInput
      : rangeInput.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);

    const parsed: ParsedRange[] = [];

    for (const raw of items) {
      const trimmed = raw.trim().toUpperCase();
      if (!trimmed) continue;

      try {
        // 1. Full Column Range: e.g. "A:D" or "A:A"
        if (/^[A-Z]+:[A-Z]+$/.test(trimmed)) {
          const [startColStr, endColStr] = trimmed.split(':');
          const sc = XLSX.utils.decode_col(startColStr);
          const ec = XLSX.utils.decode_col(endColStr);
          parsed.push({
            startRow: 0,
            endRow: 1048575,
            startCol: Math.min(sc, ec),
            endCol: Math.max(sc, ec),
            isFullCol: true,
            isFullRow: false,
            raw: trimmed,
          });
          continue;
        }

        // 2. Full Row Range: e.g. "5:10" or "5:5"
        if (/^\d+:\d+$/.test(trimmed)) {
          const [startRowStr, endRowStr] = trimmed.split(':');
          const sr = parseInt(startRowStr, 10) - 1;
          const er = parseInt(endRowStr, 10) - 1;
          parsed.push({
            startRow: Math.min(sr, er),
            endRow: Math.max(sr, er),
            startCol: 0,
            endCol: 16383,
            isFullCol: false,
            isFullRow: true,
            raw: trimmed,
          });
          continue;
        }

        // 3. 2D Range or Single Cell: e.g. "A1:D10" or "B8"
        const decoded = XLSX.utils.decode_range(trimmed);
        parsed.push({
          startRow: Math.min(decoded.s.r, decoded.e.r),
          endRow: Math.max(decoded.s.r, decoded.e.r),
          startCol: Math.min(decoded.s.c, decoded.e.c),
          endCol: Math.max(decoded.s.c, decoded.e.c),
          isFullCol: false,
          isFullRow: false,
          raw: trimmed,
        });
      } catch (err) {
        console.warn(`PermissionEngine: Failed to parse range "${raw}"`, err);
      }
    }

    return parsed;
  }

  /**
   * Chuẩn hóa danh sách chuỗi dải ô thành mảng hợp lệ
   */
  public static normalizeRangeList(rangeInput: string | string[]): string[] {
    const parsed = this.parseRanges(rangeInput);
    return parsed.map(p => {
      if (p.isFullCol) {
        const sc = XLSX.utils.encode_col(p.startCol);
        const ec = XLSX.utils.encode_col(p.endCol);
        return `${sc}:${ec}`;
      }
      if (p.isFullRow) {
        return `${p.startRow + 1}:${p.endRow + 1}`;
      }
      if (p.startRow === p.endRow && p.startCol === p.endCol) {
        return XLSX.utils.encode_cell({ r: p.startRow, c: p.startCol });
      }
      const s = XLSX.utils.encode_cell({ r: p.startRow, c: p.startCol });
      const e = XLSX.utils.encode_cell({ r: p.endRow, c: p.endCol });
      return `${s}:${e}`;
    });
  }

  /**
   * Kiểm tra tọa độ ô (row, col) 0-indexed có nằm trong các dải ô cho phép không
   */
  public static isCellAllowed(row: number, col: number, allowedRanges: ParsedRange[]): boolean {
    if (!allowedRanges || allowedRanges.length === 0) return false;
    for (const r of allowedRanges) {
      if (row >= r.startRow && row <= r.endRow && col >= r.startCol && col <= r.endCol) {
        return true;
      }
    }
    return false;
  }

  /**
   * Kiểm tra tên ô (ví dụ "B8") có nằm trong chuỗi dải ô (ví dụ "A8:H10, K1:M5") không
   */
  public static isCellInRange(cellRef: string, rangeInput: string | string[]): boolean {
    try {
      const decodedCell = XLSX.utils.decode_cell(cellRef.trim().toUpperCase());
      const parsedRanges = this.parseRanges(rangeInput);
      return this.isCellAllowed(decodedCell.r, decodedCell.c, parsedRanges);
    } catch {
      return false;
    }
  }

  /**
   * Kiểm tra xem vùng targetRange có nằm HOÀN TOÀN trong tập hợp allowedRanges không (dùng cho Copy/Paste/Fill)
   */
  public static isRangeSubset(target: ParsedRange, allowedRanges: ParsedRange[]): boolean {
    // Check all 4 corner cells of target box
    const corners = [
      { r: target.startRow, c: target.startCol },
      { r: target.startRow, c: target.endCol },
      { r: target.endRow, c: target.startCol },
      { r: target.endRow, c: target.endCol },
    ];

    for (const corner of corners) {
      if (!this.isCellAllowed(corner.r, corner.c, allowedRanges)) {
        return false;
      }
    }

    // Also check every single cell if range is reasonably sized (< 1000 cells)
    const rowCount = target.endRow - target.startRow + 1;
    const colCount = target.endCol - target.startCol + 1;
    if (rowCount * colCount <= 1000) {
      for (let r = target.startRow; r <= target.endRow; r++) {
        for (let c = target.startCol; c <= target.endCol; c++) {
          if (!this.isCellAllowed(r, c, allowedRanges)) return false;
        }
      }
    }

    return true;
  }

  /**
   * Chuẩn hóa 1 chuỗi dải ô thành chuẩn A1 (ví dụ "a1:d10" -> "A1:D10", "c5" -> "C5")
   */
  public static normalizeRange(rangeInput: string): string {
    const list = this.normalizeRangeList(rangeInput);
    if (list.length === 0) {
      throw new Error(`Định dạng vùng không hợp lệ: "${rangeInput}"`);
    }
    return list.join(", ");
  }

  /**
   * Parse chuỗi nhiều dải ô thành danh sách các dải ô chuẩn hóa
   */
  public static parseMultiRange(rangeInput: string | string[]): string[] {
    return this.normalizeRangeList(rangeInput);
  }

  /**
   * Quyết định quyền Đọc (Can Read):
   * Edit \subseteq Read: Nếu ô có quyền Sửa thì mặc nhiên có quyền Đọc.
   * Nếu user không bị giới hạn readRanges trên sheet (mảng rỗng), mặc định cho phép đọc nếu role cho phép.
   */
  public static canReadCell(
    cell: string | number,
    colOrReadRanges?: number | string | string[] | SheetGrants,
    grantsOrEditRanges?: SheetGrants | string | string[]
  ): boolean {
    if (typeof cell === "string") {
      try {
        const decoded = XLSX.utils.decode_cell(cell.trim().toUpperCase());
        const readList = typeof colOrReadRanges === "string" || Array.isArray(colOrReadRanges) ? colOrReadRanges : [];
        const editList = typeof grantsOrEditRanges === "string" || Array.isArray(grantsOrEditRanges) ? grantsOrEditRanges : [];
        const editRanges = this.parseRanges(editList);
        if (this.isCellAllowed(decoded.r, decoded.c, editRanges)) return true;
        const readRanges = this.parseRanges(readList);
        if (readRanges.length > 0) {
          return this.isCellAllowed(decoded.r, decoded.c, readRanges);
        }
        return true;
      } catch {
        return false;
      }
    }

    const row = cell;
    const col = typeof colOrReadRanges === "number" ? colOrReadRanges : 0;
    const grants = typeof grantsOrEditRanges === "object" && !Array.isArray(grantsOrEditRanges)
      ? grantsOrEditRanges
      : typeof colOrReadRanges === "object" && !Array.isArray(colOrReadRanges)
      ? colOrReadRanges as SheetGrants
      : undefined;

    if (!grants) return true;
    const readRanges = this.parseRanges(grants.read);
    const editRanges = this.parseRanges(grants.edit);

    // If edit is granted, reading is automatically allowed
    if (this.isCellAllowed(row, col, editRanges)) return true;

    // If explicit read ranges are configured, cell must be within them
    if (readRanges.length > 0) {
      return this.isCellAllowed(row, col, readRanges);
    }

    // Default allow if no restrictive read ranges configured
    return true;
  }

  /**
   * Quyết định quyền Sửa (Can Edit):
   * Chỉ cho phép khi ô nằm trong editRanges.
   */
  public static canEditCell(
    cell: string | number,
    colOrEditRanges?: number | string | string[] | SheetGrants,
    grants?: SheetGrants
  ): boolean {
    if (typeof cell === "string") {
      try {
        const decoded = XLSX.utils.decode_cell(cell.trim().toUpperCase());
        const editList = typeof colOrEditRanges === "string" || Array.isArray(colOrEditRanges) ? colOrEditRanges : [];
        const editRanges = this.parseRanges(editList);
        return this.isCellAllowed(decoded.r, decoded.c, editRanges);
      } catch {
        return false;
      }
    }

    const row = cell;
    const col = typeof colOrEditRanges === "number" ? colOrEditRanges : 0;
    const sheetGrants = grants ?? (typeof colOrEditRanges === "object" && !Array.isArray(colOrEditRanges) ? colOrEditRanges as SheetGrants : undefined);
    if (!sheetGrants) return false;
    const editRanges = this.parseRanges(sheetGrants.edit);
    return this.isCellAllowed(row, col, editRanges);
  }
}

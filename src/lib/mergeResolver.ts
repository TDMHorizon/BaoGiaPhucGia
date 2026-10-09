import * as XLSX from "xlsx";

export interface IRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface MergeInfo {
  isMerged: boolean;
  isMaster: boolean;
  masterCell: { row: number; column: number; address: string };
  mergeRange: IRange | null;
  rangeRef: string;
}

/**
 * Tra cứu xem một ô (r, c) có nằm trong vùng Merge & Center hay không.
 * Nếu có:
 * - isMerged = true
 * - masterCell = ô trên cùng bên trái (Top-Left)
 * - isMaster = true nếu ô hiện tại chính là ô Master
 * - rangeRef = chuỗi Excel Range (ví dụ "B2:D4")
 */
export function resolveMergeInfo(row: number, column: number, merges: IRange[] = []): MergeInfo {
  if (!merges || merges.length === 0) {
    const addr = XLSX.utils.encode_cell({ r: row, c: column });
    return {
      isMerged: false,
      isMaster: true,
      masterCell: { row, column, address: addr },
      mergeRange: null,
      rangeRef: addr,
    };
  }

  for (const m of merges) {
    if (row >= m.startRow && row <= m.endRow && column >= m.startColumn && column <= m.endColumn) {
      const masterAddr = XLSX.utils.encode_cell({ r: m.startRow, c: m.startColumn });
      const endAddr = XLSX.utils.encode_cell({ r: m.endRow, c: m.endColumn });
      const rangeRef = `${masterAddr}:${endAddr}`;

      return {
        isMerged: true,
        isMaster: row === m.startRow && column === m.startColumn,
        masterCell: { row: m.startRow, column: m.startColumn, address: masterAddr },
        mergeRange: m,
        rangeRef,
      };
    }
  }

  const addr = XLSX.utils.encode_cell({ r: row, c: column });
  return {
    isMerged: false,
    isMaster: true,
    masterCell: { row, column, address: addr },
    mergeRange: null,
    rangeRef: addr,
  };
}

/**
 * Quy đổi địa chỉ ô (ví dụ 'C3') về địa chỉ Master Cell (ví dụ 'B2') nếu nằm trong vùng gộp.
 */
export function resolveMasterCellAddress(address: string, merges: IRange[] = []): string {
  try {
    const decoded = XLSX.utils.decode_cell(address);
    const info = resolveMergeInfo(decoded.r, decoded.c, merges);
    return info.masterCell.address;
  } catch {
    return address;
  }
}

/**
 * Chuẩn hóa Selection trong Univer: Nếu user click vào 1 ô nằm trong merge range,
 * tự động quy đổi selection về toàn bộ merge range hoặc master cell.
 */
export function normalizeSelectionWithMerges(
  range: IRange,
  merges: IRange[] = []
): { normalizedRange: IRange; selectionStr: string; masterCell: { row: number; column: number; address: string } } {
  // Nếu là single cell click
  if (range.startRow === range.endRow && range.startColumn === range.endColumn) {
    const info = resolveMergeInfo(range.startRow, range.startColumn, merges);
    if (info.isMerged && info.mergeRange) {
      return {
        normalizedRange: { ...info.mergeRange },
        selectionStr: info.rangeRef,
        masterCell: info.masterCell,
      };
    }
  }

  const startAddr = XLSX.utils.encode_cell({ r: range.startRow, c: range.startColumn });
  const endAddr = XLSX.utils.encode_cell({ r: range.endRow, c: range.endColumn });
  const selectionStr = startAddr === endAddr ? startAddr : `${startAddr}:${endAddr}`;

  return {
    normalizedRange: range,
    selectionStr,
    masterCell: { row: range.startRow, column: range.startColumn, address: startAddr },
  };
}

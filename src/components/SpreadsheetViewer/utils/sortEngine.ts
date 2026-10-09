import * as XLSX from 'xlsx';
import { clientLogger } from '../../../lib/logger';

export interface SortOptions {
  direction: 'asc' | 'desc';
  sortColumnIndex?: number;
  hasHeader?: boolean;
}

/**
 * Trích xuất giá trị để so sánh từ cell Univer
 */
export function extractCellValueForSort(cell: any): string | number {
  if (!cell) return '';
  if (cell.v !== undefined && cell.v !== null) {
    const num = Number(cell.v);
    if (!isNaN(num) && typeof cell.v !== 'boolean' && String(cell.v).trim() !== '') {
      return num;
    }
    return String(cell.v);
  }
  if (cell.p?.body?.dataStream) {
    const str = cell.p.body.dataStream.replace(/\r\n$/, '').replace(/\n$/, '');
    const num = Number(str);
    if (!isNaN(num) && str.trim() !== '') return num;
    return str;
  }
  if (cell.f) return String(cell.f);
  return '';
}

/**
 * Sắp xếp dữ liệu của một Worksheet trong Univer
 */
export function executeSortWorksheet(
  univerAPI: any,
  options: SortOptions
): { success: boolean; rowsAffected: number; message: string } {
  if (!univerAPI) {
    return { success: false, rowsAffected: 0, message: 'Univer API chưa sẵn sàng.' };
  }

  try {
    const fWorkbook = univerAPI.getActiveWorkbook();
    if (!fWorkbook) {
      return { success: false, rowsAffected: 0, message: 'Không tìm thấy Workbook đang hoạt động.' };
    }

    const worksheet = fWorkbook.getActiveSheet();
    if (!worksheet) {
      return { success: false, rowsAffected: 0, message: 'Không tìm thấy Worksheet đang hoạt động.' };
    }

    const snapshot = worksheet.getSnapshot?.() || {};
    const cellData = snapshot.cellData || {};
    const rowKeys = Object.keys(cellData).map(k => parseInt(k, 10)).sort((a, b) => a - b);

    if (rowKeys.length <= 1) {
      return { success: false, rowsAffected: 0, message: 'Bảng tính không có đủ dòng dữ liệu để sắp xếp.' };
    }

    // Determine active column
    const activeRange = worksheet.getActiveRange();
    let targetCol = options.sortColumnIndex ?? 0;
    if (activeRange) {
      targetCol = activeRange.getColumn();
    }

    // Determine start and end rows
    let startRowIndex = rowKeys[0];
    const endRowIndex = rowKeys[rowKeys.length - 1];

    // Check if first 1 or 2 rows are Headers (e.g. Row 1 or 2 contain 'STT', 'NỘI DUNG', 'TIỀN', etc.)
    const firstRowCells = cellData[startRowIndex] || {};
    const secondRowCells = cellData[startRowIndex + 1] || {};

    const isFirstRowHeader = Object.values(firstRowCells).some((c: any) => {
      const val = String(extractCellValueForSort(c)).toLowerCase();
      return val.includes('stt') || val.includes('nội dung') || val.includes('tiền') || val.includes('ngày') || val.includes('tên');
    });

    const isSecondRowHeader = Object.values(secondRowCells).some((c: any) => {
      const val = String(extractCellValueForSort(c)).toLowerCase();
      return val.includes('stt') || val.includes('nội dung') || val.includes('tiền') || val.includes('ngày');
    });

    if (isFirstRowHeader) {
      startRowIndex = startRowIndex + 1;
    } else if (isSecondRowHeader) {
      startRowIndex = startRowIndex + 2;
    } else if (options.hasHeader !== false && rowKeys.length > 2) {
      startRowIndex = rowKeys[1]; // default assume row 0 is header
    }

    // Collect data rows
    const rowsToSort: Array<{ rowIndex: number; rowObj: Record<string, any>; sortKey: string | number }> = [];

    for (let r = startRowIndex; r <= endRowIndex; r++) {
      if (!cellData[r]) continue;
      const rowObj = cellData[r];
      const targetCell = rowObj[targetCol];
      const sortKey = extractCellValueForSort(targetCell);
      rowsToSort.push({ rowIndex: r, rowObj, sortKey });
    }

    if (rowsToSort.length <= 1) {
      return { success: true, rowsAffected: 0, message: 'Không có đủ dòng để sắp xếp.' };
    }

    // Sort rows
    rowsToSort.sort((a, b) => {
      const keyA = a.sortKey;
      const keyB = b.sortKey;

      if (typeof keyA === 'number' && typeof keyB === 'number') {
        return options.direction === 'asc' ? keyA - keyB : keyB - keyA;
      }

      const strA = String(keyA || '');
      const strB = String(keyB || '');

      const comp = strA.localeCompare(strB, 'vi', { sensitivity: 'base', numeric: true });
      return options.direction === 'asc' ? comp : -comp;
    });

    // Apply reordered row data back to Univer sheet
    rowsToSort.forEach((sortedItem, idx) => {
      const targetR = startRowIndex + idx;
      const rowObj = sortedItem.rowObj;

      Object.keys(rowObj).forEach((cStr) => {
        const c = parseInt(cStr, 10);
        const cell = rowObj[c];
        const range = worksheet.getRange(targetR, c, 1, 1);
        if (range && cell) {
          if (cell.f) {
            range.setValue(`=${cell.f}`);
          } else if (cell.v !== undefined && cell.v !== null) {
            range.setValue(cell.v);
          }
          if (cell.s) {
            // keep styles
          }
        }
      });
    });

    clientLogger.action("SORT_ENGINE", "SORT_COMPLETED", {
      direction: options.direction,
      targetCol,
      rowsCount: rowsToSort.length,
      startRowIndex,
    });

    return {
      success: true,
      rowsAffected: rowsToSort.length,
      message: `Đã sắp xếp ${rowsToSort.length} dòng theo thứ tự ${options.direction === 'asc' ? 'tăng dần (A → Z)' : 'giảm dần (Z → A)'}.`,
    };
  } catch (error) {
    clientLogger.error("SORT_ENGINE", "SORT_FAILED", error);
    return { success: false, rowsAffected: 0, message: 'Có lỗi xảy ra khi sắp xếp bảng tính.' };
  }
}

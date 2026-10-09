import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { clientLogger } from './logger';

export interface ExportWorkbookOptions {
  univerAPI: any;
  filename?: string;
  fallbackWorkbook?: XLSX.WorkBook | null;
}

/**
 * Trích xuất text hoặc number từ cell Univer một cách an toàn
 */
function extractUniverCellValue(cell: any): { value: any; formula?: string } {
  if (!cell) return { value: undefined };

  if (cell.f) {
    const rawFormula = String(cell.f).startsWith('=') ? String(cell.f).slice(1) : String(cell.f);
    let result = cell.v;
    if (result === undefined && cell.p?.body?.dataStream) {
      result = cell.p.body.dataStream.replace(/\r\n$/, '').replace(/\n$/, '');
    }
    return { formula: rawFormula, value: result };
  }

  if (cell.v !== undefined && cell.v !== null) {
    return { value: cell.v };
  }

  if (cell.p?.body?.dataStream) {
    const str = cell.p.body.dataStream.replace(/\r\n$/, '').replace(/\n$/, '');
    const num = Number(str);
    if (!isNaN(num) && str.trim() !== '') {
      return { value: num };
    }
    return { value: str };
  }

  return { value: undefined };
}

/**
 * Trích xuất snapshot từ Univer Runtime SSOT sang ExcelJS và tải file .xlsx
 */
export async function exportUniverToExcelFile(options: ExportWorkbookOptions): Promise<Blob | null> {
  const { univerAPI, filename = 'BaoGia_PhucGia.xlsx', fallbackWorkbook } = options;
  clientLogger.action("EXPORT_EXCEL", "START_EXPORT", { filename });

  try {
    const fWorkbook = univerAPI?.getActiveWorkbook?.();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Công Ty Phúc Gia';
    wb.lastModifiedBy = 'Báo Giá Phúc Gia';
    wb.created = new Date();
    wb.modified = new Date();

    let hasExportedSheets = false;

    if (fWorkbook) {
      const sheets = fWorkbook.getSheets();

      sheets.forEach((ws: any) => {
        const sheetName = ws.getSheetName();
        const snapshot = ws.getSnapshot?.() || {};
        const newWs = wb.addWorksheet(sheetName);
        hasExportedSheets = true;

        const cellData = snapshot.cellData || {};
        const mergeData = snapshot.mergeData || [];
        const rowData = snapshot.rowData || {};
        const columnData = snapshot.columnData || {};

        // 1. Column widths
        Object.keys(columnData).forEach(cStr => {
          const c = parseInt(cStr, 10);
          const colInfo = columnData[c];
          if (colInfo && colInfo.w) {
            newWs.getColumn(c + 1).width = Math.max(8, Math.round(colInfo.w / 8));
          }
        });

        // 2. Row heights & cells
        Object.keys(cellData).forEach(rStr => {
          const r = parseInt(rStr, 10);
          const rowObj = cellData[r];
          if (!rowObj) return;

          const ejRow = newWs.getRow(r + 1);

          if (rowData[r] && rowData[r].h) {
            ejRow.height = Math.round(rowData[r].h * 0.75);
          }

          Object.keys(rowObj).forEach(cStr => {
            const c = parseInt(cStr, 10);
            const cell = rowObj[c];
            if (!cell) return;

            const ejCell = ejRow.getCell(c + 1);
            const { value, formula } = extractUniverCellValue(cell);

            // Formula or Value
            if (formula) {
              ejCell.value = {
                formula,
                result: value !== undefined ? value : undefined,
              };
            } else if (value !== undefined && value !== null) {
              ejCell.value = value;
            }

            // Styles
            const s = typeof cell.s === 'object' ? cell.s : {};
            if (s.bl || s.it || s.cl || s.fs || s.ff) {
              ejCell.font = {
                bold: !!s.bl,
                italic: !!s.it,
                size: s.fs || 11,
                name: s.ff || 'Calibri',
                color: s.cl?.rgb ? { argb: s.cl.rgb.replace('#', 'FF') } : undefined,
              };
            }

            if (s.bg?.rgb) {
              ejCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: s.bg.rgb.replace('#', 'FF') },
              };
            }

            if (s.ht || s.vt || s.tb) {
              ejCell.alignment = {
                horizontal: s.ht === 2 ? 'center' : s.ht === 3 ? 'right' : 'left',
                vertical: s.vt === 2 ? 'middle' : s.vt === 3 ? 'bottom' : 'top',
                wrapText: !!s.tb,
              };
            }

            if (s.n) {
              ejCell.numFmt = s.n;
            }
          });
        });

        // 3. Merges
        mergeData.forEach((m: any) => {
          try {
            newWs.mergeCells(m.startRow + 1, m.startColumn + 1, m.endRow + 1, m.endColumn + 1);
          } catch (err) {
            console.warn("Could not merge cells in export:", err);
          }
        });
      });
    }

    // Fallback if no sheets in Univer
    if (!hasExportedSheets && fallbackWorkbook) {
      fallbackWorkbook.SheetNames.forEach(name => {
        const ws = fallbackWorkbook.Sheets[name];
        const newWs = wb.addWorksheet(name);
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        data.forEach((row, rIdx) => {
          const ejRow = newWs.getRow(rIdx + 1);
          row.forEach((val, cIdx) => {
            if (val !== undefined && val !== null) {
              ejRow.getCell(cIdx + 1).value = val;
            }
          });
        });
      });
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Trigger download in browser if window is available
    if (typeof window !== 'undefined' && window.document) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }

    clientLogger.action("EXPORT_EXCEL", "EXPORT_SUCCESS", { filename, sizeBytes: blob.size });
    return blob;
  } catch (error) {
    clientLogger.error("EXPORT_EXCEL", "EXPORT_FAILED", error);
    return null;
  }
}

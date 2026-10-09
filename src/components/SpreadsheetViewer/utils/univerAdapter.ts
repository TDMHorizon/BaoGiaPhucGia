import * as XLSX from 'xlsx';
import type ExcelJS from 'exceljs';
import type { IWorkbookData, IWorksheetData, ICellData, IStyleData, IRange, IBorderData } from '@univerjs/core';
import { LocaleType } from '@univerjs/presets';
import { isCellInRange } from '../../../lib/utils-excel';

interface ConvertOptions {
  workbook: XLSX.WorkBook | null;
  exceljsWorkbook: ExcelJS.Workbook | null;
  activeSheet?: string;
  mode?: 'user' | 'admin';
  editableRange?: string;
}

/**
 * Convert XLSX and ExcelJS workbooks to Univer IWorkbookData structure
 */
export function convertExcelToUniverData(options: ConvertOptions): IWorkbookData {
  const { workbook, exceljsWorkbook, mode = 'user', editableRange = '' } = options;

  const sheetNames = workbook?.SheetNames && workbook.SheetNames.length > 0 
    ? workbook.SheetNames 
    : ['Sheet1'];

  const sheets: Record<string, Partial<IWorksheetData>> = {};

  sheetNames.forEach((sheetName, index) => {
    const ws = workbook?.Sheets?.[sheetName];
    const ejWs = exceljsWorkbook?.getWorksheet(sheetName);

    // Calculate dimensions
    let maxR = 40;
    let maxC = 15;
    if (ws && ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      maxR = Math.max(maxR, range.e.r + 15);
      maxC = Math.max(maxC, range.e.c + 5);
    }
    if (ejWs && ejWs.rowCount) {
      maxR = Math.max(maxR, ejWs.rowCount + 10);
    }

    // Merges
    const mergeData: IRange[] = [];
    if (ws && ws['!merges']) {
      for (const m of ws['!merges']) {
        mergeData.push({
          startRow: m.s.r,
          endRow: m.e.r,
          startColumn: m.s.c,
          endColumn: m.e.c,
        });
      }
    }

    // Column widths
    const columnData: Record<number, { w?: number }> = {};
    if (ejWs) {
      for (let c = 0; c <= maxC; c++) {
        const col = ejWs.getColumn(c + 1);
        if (col && col.width) {
          columnData[c] = { w: Math.round(col.width * 8.5) };
        } else {
          columnData[c] = { w: 90 };
        }
      }
    } else if (ws && ws['!cols']) {
      ws['!cols'].forEach((col, c) => {
        if (col && col.wpx) {
          columnData[c] = { w: col.wpx };
        } else if (col && col.wch) {
          columnData[c] = { w: Math.round(col.wch * 8) };
        }
      });
    }

    // Row heights
    const rowData: Record<number, { h?: number }> = {};
    if (ejWs) {
      for (let r = 0; r <= maxR; r++) {
        const row = ejWs.getRow(r + 1);
        if (row && row.height) {
          rowData[r] = { h: Math.round(row.height * 1.33) };
        } else {
          rowData[r] = { h: 26 };
        }
      }
    }

    // Cell data
    const cellData: Record<number, Record<number, ICellData>> = {};

    for (let r = 0; r <= maxR; r++) {
      const rowObj: Record<number, ICellData> = {};
      let hasRowCells = false;

      for (let c = 0; c <= maxC; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const xlsxCell = ws ? ws[cellRef] : null;
        const ejCell = ejWs ? ejWs.getCell(r + 1, c + 1) : null;

        if (!xlsxCell && !ejCell) continue;

        const cell: ICellData = {};
        let hasContent = false;

        // Formula first
        if (ejCell && ejCell.formula) {
          cell.f = ejCell.formula.startsWith('=') ? ejCell.formula : `=${ejCell.formula}`;
          hasContent = true;
        } else if (xlsxCell && xlsxCell.f) {
          cell.f = xlsxCell.f.startsWith('=') ? xlsxCell.f : `=${xlsxCell.f}`;
          hasContent = true;
        }

        // Value
        if (xlsxCell && xlsxCell.v !== undefined && xlsxCell.v !== null) {
          cell.v = xlsxCell.v;
          hasContent = true;
        } else if (ejCell && ejCell.value !== undefined && ejCell.value !== null) {
          if (typeof ejCell.value === 'object' && 'result' in (ejCell.value as any)) {
            const res = (ejCell.value as any).result;
            if (res !== undefined && res !== null) {
              cell.v = res;
              hasContent = true;
            }
          } else {
            cell.v = ejCell.value as any;
            hasContent = true;
          }
        }

        // Style
        const style: IStyleData = {};
        let hasStyle = false;

        if (ejCell) {
          // Font styles
          if (ejCell.font) {
            if (ejCell.font.bold) {
              style.bl = 1;
              hasStyle = true;
            }
            if (ejCell.font.italic) {
              style.it = 1;
              hasStyle = true;
            }
            if (ejCell.font.size) {
              style.fs = ejCell.font.size;
              hasStyle = true;
            }
            if (ejCell.font.name) {
              style.ff = ejCell.font.name;
              hasStyle = true;
            }
            if (ejCell.font.color && ejCell.font.color.argb) {
              style.cl = { rgb: `#${ejCell.font.color.argb.slice(-6)}` };
              hasStyle = true;
            }
          }

          // Background fill
          if (ejCell.fill && ejCell.fill.type === 'pattern' && ejCell.fill.fgColor && ejCell.fill.fgColor.argb) {
            style.bg = { rgb: `#${ejCell.fill.fgColor.argb.slice(-6)}` };
            hasStyle = true;
          }

          // Alignment
          if (ejCell.alignment) {
            if (ejCell.alignment.horizontal === 'center') style.ht = 2;
            else if (ejCell.alignment.horizontal === 'right') style.ht = 3;
            else if (ejCell.alignment.horizontal === 'left') style.ht = 1;

            if (ejCell.alignment.vertical === 'middle') style.vt = 2;
            else if (ejCell.alignment.vertical === 'bottom') style.vt = 3;
            else if (ejCell.alignment.vertical === 'top') style.vt = 1;

            if (ejCell.alignment.wrapText) style.tb = 1;
            hasStyle = true;
          }

          // Borders
          if (ejCell.border) {
            const bd: IBorderData = {};
            if (ejCell.border.top) {
              bd.t = { s: 1, cl: { rgb: '#cbd5e1' } };
            }
            if (ejCell.border.bottom) {
              bd.b = { s: 1, cl: { rgb: '#cbd5e1' } };
            }
            if (ejCell.border.left) {
              bd.l = { s: 1, cl: { rgb: '#cbd5e1' } };
            }
            if (ejCell.border.right) {
              bd.r = { s: 1, cl: { rgb: '#cbd5e1' } };
            }
            style.bd = bd;
            hasStyle = true;
          }
        }

        // Highlight editable cells in User mode with a soft green tint
        if (mode === 'user' && editableRange && isCellInRange(cellRef, editableRange)) {
          if (!style.bg) {
            style.bg = { rgb: '#ecfdf5' };
            hasStyle = true;
          }
        }

        if (hasStyle) {
          cell.s = style;
        }

        if (hasContent || hasStyle) {
          rowObj[c] = cell;
          hasRowCells = true;
        }
      }

      if (hasRowCells) {
        cellData[r] = rowObj;
      }
    }

    const sheetId = `sheet_${index}_${sheetName.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    sheets[sheetId] = {
      id: sheetId,
      name: sheetName,
      rowCount: maxR + 1,
      columnCount: maxC + 1,
      cellData,
      mergeData,
      columnData,
      rowData,
      defaultColumnWidth: 90,
      defaultRowHeight: 26,
      showGridlines: 1,
    };
  });

  return {
    id: `workbook_${Date.now()}`,
    name: 'BaoGia',
    appVersion: '3.0.0',
    locale: LocaleType.VI_VN,
    styles: {},
    sheetOrder: Object.keys(sheets),
    sheets,
  };
}


import * as XLSX from "xlsx";
import type ExcelJS from "exceljs";

export interface UniverSheetData {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  defaultRowHeight?: number;
  defaultColumnWidth?: number;
  cellData: Record<number, Record<number, { v?: string | number | boolean; t?: number; f?: string; s?: any }>>;
  mergeData?: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }>;
  rowData?: Record<number, { h?: number }>;
  columnData?: Record<number, { w?: number }>;
}

export interface UniverWorkbookData {
  id: string;
  name: string;
  appVersion: string;
  sheetOrder: string[];
  sheets: Record<string, UniverSheetData>;
}

// Baseline dimensions for a modern, comfortable, spacious spreadsheet view
const MIN_ROW_HEIGHT = 40; // Spacious height for clear text visibility
const MIN_COL_WIDTH = 150; // Comfortable minimum column width

/**
 * Converts SheetJS and ExcelJS workbooks into a rich Univer JSON snapshot.
 * Dynamically computes row heights and column widths so text is never cramped or truncated.
 * Applies word-wrap and vertical centering for ultra-clear readability.
 */
export function convertToUniverWorkbook(
  workbook: XLSX.WorkBook,
  exceljsWb?: ExcelJS.Workbook | null
): UniverWorkbookData {
  const sheetOrder: string[] = [];
  const sheets: Record<string, UniverSheetData> = {};

  workbook.SheetNames.forEach((sheetName, index) => {
    const sheetId = `sheet_${index + 1}`;
    sheetOrder.push(sheetId);

    const ws = workbook.Sheets[sheetName];
    const rawData = ws ? XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" }) : [];
    const cellData: Record<number, Record<number, any>> = {};

    let maxRow = rawData.length;
    let maxCol = 0;

    // Track text length per column for intelligent column sizing
    const colMaxTextLengths: Record<number, number> = {};

    rawData.forEach((row, r) => {
      cellData[r] = {};
      let rowMaxTextLen = 0;
      let rowMaxLines = 1;

      if (Array.isArray(row)) {
        if (row.length > maxCol) maxCol = row.length;

        row.forEach((val, c) => {
          if (val !== undefined && val !== null && val !== "") {
            const strVal = String(val);
            const isNum = typeof val === "number" || (!isNaN(Number(val)) && strVal.trim() !== "");

            // Track max length in column
            const lines = strVal.split("\n");
            lines.forEach((line) => {
              colMaxTextLengths[c] = Math.max(colMaxTextLengths[c] || 0, line.length);
            });

            if (strVal.length > rowMaxTextLen) rowMaxTextLen = strVal.length;
            if (lines.length > rowMaxLines) rowMaxLines = lines.length;

            const isHeaderRow = r === 0;

            cellData[r][c] = {
              v: isNum ? Number(val) : strVal,
              t: isNum ? 2 : 1,
              s: {
                tb: 3, // WrapStrategy.WRAP (Wrap text within cell)
                vt: 2, // VerticalAlign.MIDDLE (Center text vertically)
                ...(isHeaderRow ? { bl: 1 } : {}), // Bold for header row
              },
            };
          }
        });
      }
    });

    // Extract formulas from SheetJS worksheet
    if (ws && ws["!ref"]) {
      try {
        const range = XLSX.utils.decode_range(ws["!ref"]);
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[cellRef];
            if (cell && cell.f) {
              if (!cellData[R]) cellData[R] = {};
              const currVal = cellData[R][C]?.v ?? cell.v;
              cellData[R][C] = {
                v: currVal,
                f: `=${cell.f}`,
                s: {
                  tb: 3,
                  vt: 2,
                },
              };
            }
          }
        }
      } catch (err) {
        console.warn("Could not decode SheetJS range for formulas:", err);
      }
    }

    // Merged cell ranges
    const mergeData: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }> = [];
    if (ws && ws["!merges"]) {
      ws["!merges"].forEach((m) => {
        mergeData.push({
          startRow: m.s.r,
          endRow: m.e.r,
          startColumn: m.s.c,
          endColumn: m.e.c,
        });
      });
    }

    // Row heights calculation: Calculate spacious, clear heights based on content
    const rowData: Record<number, { h?: number }> = {};
    rawData.forEach((row, r) => {
      let maxLen = 0;
      let maxLines = 1;

      if (Array.isArray(row)) {
        row.forEach((val) => {
          if (val !== undefined && val !== null && val !== "") {
            const str = String(val);
            if (str.length > maxLen) maxLen = str.length;
            const lines = str.split("\n").length;
            if (lines > maxLines) maxLines = lines;
          }
        });
      }

      let calculatedHeight = MIN_ROW_HEIGHT;
      if (maxLines > 1) {
        calculatedHeight = Math.max(calculatedHeight, maxLines * 24 + 18);
      } else if (maxLen > 120) {
        calculatedHeight = 90; // Large height for descriptive paragraphs
      } else if (maxLen > 70) {
        calculatedHeight = 70; // Medium-high for detailed notes
      } else if (maxLen > 30) {
        calculatedHeight = 52; // Comfortable height for phrases
      }

      // Check original SheetJS row height
      let origHeight = 0;
      if (ws && ws["!rows"] && ws["!rows"][r]) {
        const rowObj = ws["!rows"][r];
        origHeight = rowObj.hpx || (rowObj.hpt ? Math.round(rowObj.hpt * 1.33) : 0);
      }

      rowData[r] = {
        h: Math.max(origHeight, calculatedHeight, MIN_ROW_HEIGHT),
      };
    });

    // Column widths calculation: Calculate comfortable widths based on longest string in column
    const columnData: Record<number, { w?: number }> = {};
    for (let c = 0; c < Math.max(maxCol, 26); c++) {
      const maxTextLen = colMaxTextLengths[c] || 0;
      let calculatedWidth = MIN_COL_WIDTH;

      if (maxTextLen > 50) {
        calculatedWidth = 360;
      } else if (maxTextLen > 30) {
        calculatedWidth = 280;
      } else if (maxTextLen > 15) {
        calculatedWidth = 200;
      } else if (maxTextLen > 0) {
        calculatedWidth = Math.max(MIN_COL_WIDTH, maxTextLen * 10 + 24);
      }

      // Check original SheetJS column width
      let origWidth = 0;
      if (ws && ws["!cols"] && ws["!cols"][c]) {
        const colObj = ws["!cols"][c];
        origWidth = colObj.wpx || (colObj.wch ? Math.round(colObj.wch * 8.5) : 0);
      }

      columnData[c] = {
        w: Math.max(origWidth, calculatedWidth, MIN_COL_WIDTH),
      };
    }

    // Augment with ExcelJS details if available
    if (exceljsWb) {
      try {
        const ejWs = exceljsWb.getWorksheet(sheetName);
        if (ejWs) {
          ejWs.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            const r = rowNumber - 1;
            if (row.height) {
              const ejHeight = Math.round(row.height * 1.33);
              rowData[r] = {
                h: Math.max(rowData[r]?.h || 0, ejHeight, MIN_ROW_HEIGHT),
              };
            }
          });
          for (let c = 1; c <= ejWs.columnCount; c++) {
            const col = ejWs.getColumn(c);
            if (col && col.width) {
              const ejWidth = Math.round(col.width * 8.5);
              columnData[c - 1] = {
                w: Math.max(columnData[c - 1]?.w || 0, ejWidth, MIN_COL_WIDTH),
              };
            }
          }
        }
      } catch (err) {
        console.warn("Could not extract ExcelJS worksheet styles:", err);
      }
    }

    sheets[sheetId] = {
      id: sheetId,
      name: sheetName,
      rowCount: Math.max(100, maxRow + 30),
      columnCount: Math.max(26, maxCol + 10),
      defaultRowHeight: 40,
      defaultColumnWidth: 170,
      cellData,
      mergeData,
      rowData,
      columnData,
    };
  });

  return {
    id: `univer_wb_${Date.now()}`,
    name: workbook.SheetNames[0] || "BaoGia",
    appVersion: "3.0.0",
    sheetOrder,
    sheets,
  };
}

import { useMemo } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { getColumnWidth, getRowHeight, getCellMergeInfo, MergeInfo } from '../../../lib/utils-excel';

interface UseExcelDataProps {
  workbook: XLSX.WorkBook | null;
  exceljsWorkbook: ExcelJS.Workbook | null;
  activeSheet: string;
  sheetData: any[][];
}

export function useExcelData({ workbook, exceljsWorkbook, activeSheet, sheetData }: UseExcelDataProps) {
  const ws = useMemo(() => workbook?.Sheets?.[activeSheet], [workbook, activeSheet]);
  const ejWs = useMemo(() => exceljsWorkbook?.getWorksheet(activeSheet), [exceljsWorkbook, activeSheet]);

  const numRows = Math.max(20, sheetData.length);
  const numCols = Math.max(10, sheetData[0]?.length || 0);

  const { rowHeights, colWidths, mergesMap } = useMemo(() => {
    const rowHeights: Record<number, number> = {};
    const colWidths: Record<number, number> = {};
    const mergesMap: Record<string, MergeInfo> = {};

    if (!ws) return { rowHeights, colWidths, mergesMap };

    // 1. Calculate spacious, clear row heights (never squeezed)
    for (let r = 0; r < numRows; r++) {
      const origHeight = getRowHeight(ejWs, ws, r);

      // Check content in row for dynamic height expansion
      const rowCells = sheetData[r] || [];
      let maxLen = 0;
      let maxLines = 1;

      rowCells.forEach((val) => {
        if (val !== undefined && val !== null && val !== "") {
          const str = String(val);
          if (str.length > maxLen) maxLen = str.length;
          const lines = str.split("\n").length;
          if (lines > maxLines) maxLines = lines;
        }
      });

      let contentHeight = 38; // Comfortable baseline height
      if (maxLines > 1) {
        contentHeight = Math.max(contentHeight, maxLines * 24 + 16);
      } else if (maxLen > 100) {
        contentHeight = 76;
      } else if (maxLen > 50) {
        contentHeight = 56;
      } else if (maxLen > 25) {
        contentHeight = 44;
      }

      rowHeights[r] = Math.max(origHeight || 0, contentHeight, 38);
    }

    // 2. Calculate spacious column widths
    for (let c = 0; c < numCols; c++) {
      const origWidth = getColumnWidth(ejWs, ws, c);
      let maxLen = 0;

      sheetData.forEach((row) => {
        if (row && row[c] !== undefined && row[c] !== null) {
          const str = String(row[c]);
          str.split("\n").forEach((l) => {
            if (l.length > maxLen) maxLen = l.length;
          });
        }
      });

      let dynamicWidth = 150;
      if (maxLen > 50) dynamicWidth = 340;
      else if (maxLen > 30) dynamicWidth = 260;
      else if (maxLen > 15) dynamicWidth = 190;
      else if (maxLen > 0) dynamicWidth = Math.max(140, maxLen * 9 + 20);

      colWidths[c] = Math.max(origWidth, dynamicWidth, 140);
    }

    // 3. Cache merges
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const mergeInfo = getCellMergeInfo(ws, r, c, ejWs);
        if (mergeInfo.shouldSkip || (mergeInfo.colSpan && mergeInfo.colSpan > 1) || (mergeInfo.rowSpan && mergeInfo.rowSpan > 1)) {
           mergesMap[`${r},${c}`] = mergeInfo;
        }
      }
    }

    return { rowHeights, colWidths, mergesMap };
  }, [ws, ejWs, numRows, numCols, sheetData]);

  return { ws, ejWs, rowHeights, colWidths, mergesMap, numRows, numCols };
}

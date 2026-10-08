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

    // Cache row heights
    for (let r = 0; r < numRows; r++) {
      const h = getRowHeight(ejWs, ws, r);
      if (h !== undefined) {
        rowHeights[r] = h;
      }
    }

    // Cache col widths
    for (let c = 0; c < numCols; c++) {
      colWidths[c] = getColumnWidth(ejWs, ws, c);
    }

    // Cache merges
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const mergeInfo = getCellMergeInfo(ws, r, c, ejWs);
        if (mergeInfo.shouldSkip || (mergeInfo.colSpan && mergeInfo.colSpan > 1) || (mergeInfo.rowSpan && mergeInfo.rowSpan > 1)) {
           mergesMap[`${r},${c}`] = mergeInfo;
        }
      }
    }

    return { rowHeights, colWidths, mergesMap };
  }, [ws, ejWs, numRows, numCols]);

  return { ws, ejWs, rowHeights, colWidths, mergesMap, numRows, numCols };
}

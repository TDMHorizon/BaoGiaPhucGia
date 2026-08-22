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

const DEFAULT_ROWS = 20;
const DEFAULT_COLS = 10;

export function useExcelData({ workbook, exceljsWorkbook, activeSheet, sheetData }: UseExcelDataProps) {
  const ws = useMemo(() => workbook?.Sheets?.[activeSheet], [workbook, activeSheet]);
  const ejWs = useMemo(() => exceljsWorkbook?.getWorksheet(activeSheet), [exceljsWorkbook, activeSheet]);
  const numRows = Math.max(DEFAULT_ROWS, sheetData.length);
  const numCols = Math.max(DEFAULT_COLS, sheetData[0]?.length || 0);

  const dimensionData = useMemo(() => {
    if (!ws) return { rowHeights: {}, colWidths: {}, mergesMap: {} };

    const rowHeights: Record<number, number> = {};
    const colWidths: Record<number, number> = {};
    const mergesMap: Record<string, MergeInfo> = {};

    // Build dimensions
    for (let r = 0; r < numRows; r++) {
      const h = getRowHeight(ejWs, ws, r);
      if (h !== undefined) rowHeights[r] = h;
    }
    for (let c = 0; c < numCols; c++) {
      colWidths[c] = getColumnWidth(ejWs, ws, c);
    }
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const mergeInfo = getCellMergeInfo(ws, r, c, ejWs);
        const isMerged = mergeInfo.shouldSkip || (mergeInfo.colSpan ?? 1) > 1 || (mergeInfo.rowSpan ?? 1) > 1;
        if (isMerged) mergesMap[`${r},${c}`] = mergeInfo;
      }
    }

    return { rowHeights, colWidths, mergesMap };
  }, [ws, ejWs, numRows, numCols]);

  return { ws, ejWs, ...dimensionData, numRows, numCols };
}

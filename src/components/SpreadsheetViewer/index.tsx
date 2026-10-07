import React from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { HeaderCell } from './components/HeaderCell';
import { Row } from './components/Row';
import { useExcelData } from './hooks/useExcelData';

export interface SpreadsheetViewerProps {
  workbook: XLSX.WorkBook | null;
  exceljsWorkbook: ExcelJS.Workbook | null;
  sheetData: any[][];
  activeSheet: string;
  mode: 'user' | 'admin';
  locked?: boolean;
  editableRange?: string;
  selectedRange?: string;
  selectedColumn?: number | null;
  previewLimit?: number;
  onColumnClick?: (colIndex: number) => void;
  onRowClick?: (rowIndex: number) => void;
  onCellEdit?: (r: number, c: number, newValue: string) => void;
  onCellMouseDown?: (r: number, c: number) => void;
  onCellMouseEnter?: (r: number, c: number) => void;
}

export function SpreadsheetViewer({
                                    workbook,
                                    exceljsWorkbook,
                                    sheetData,
                                    activeSheet,
                                    mode,
                                    locked = false,
                                    editableRange = "",
                                    selectedRange = "",
                                    selectedColumn = null,
                                    previewLimit = -1,
                                    onColumnClick,
                                    onRowClick,
                                    onCellEdit,
                                    onCellMouseDown,
                                    onCellMouseEnter
                                  }: SpreadsheetViewerProps) {


  const displayData = previewLimit === -1 ? sheetData : sheetData.slice(0, previewLimit);

  const { ejWs, colWidths, rowHeights, mergesMap, numRows, numCols } = useExcelData({
    workbook,
    exceljsWorkbook,
    activeSheet,
    sheetData: displayData
  });

  return (
      <div className="flex-1 overflow-auto bg-white p-2 relative">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <thead>
          <tr className="shadow-3xs">
            <th className="border border-slate-300 p-2 bg-slate-200 w-12 text-slate-500 font-bold text-xs text-center select-none sticky top-0 left-0 z-20" style={{ width: "48px", minWidth: "48px", maxWidth: "48px" }}>#</th>
            {Array.from({ length: numCols }).map((_, i) => (
                <HeaderCell
                    key={i}
                    colIndex={i}
                    colWidth={colWidths[i] || 80}
                    isSelected={mode === 'user' ? selectedColumn === i : selectedRange.includes(`${XLSX.utils.encode_col(i)}:${XLSX.utils.encode_col(i)}`)}
                    onColumnClick={(idx) => onColumnClick && onColumnClick(idx)}
                />
            ))}
          </tr>
          </thead>
          <tbody>
          {Array.from({ length: numRows }).map((_, r) => (
              <Row
                  key={r}
                  r={r}
                  rowData={displayData[r] || []}
                  numCols={numCols}
                  rowHeight={rowHeights[r]}
                  ejWs={ejWs}
                  colWidths={colWidths}
                  mergesMap={mergesMap}
                  mode={mode}
                  editableRange={editableRange}
                  isLocked={locked}
                  selectedColumn={selectedColumn}
                  selectedRange={selectedRange}
                  onCellEdit={onCellEdit}
                  onMouseDown={onCellMouseDown}
                  onMouseEnter={onCellMouseEnter}
                  onRowClick={onRowClick}
              />
          ))}
          {displayData.length === 0 && (
              <tr>
                <td colSpan={Math.max(11, numCols + 1)} className="border p-8 text-center text-slate-400 font-semibold bg-white">
                  Không có dữ liệu hiển thị.
                </td>
              </tr>
          )}
          </tbody>
        </table>
      </div>
  );
}

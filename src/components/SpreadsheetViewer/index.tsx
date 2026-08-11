import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { HeaderCell } from './components/HeaderCell';
import { Row } from './components/Row';
import { useExcelData } from './hooks/useExcelData';
import { SpreadsheetToolbar } from './components/SpreadsheetToolbar';
import { SpreadsheetViewerProps } from './types/spreadsheet';

/**
 * SpreadsheetViewer - Main spreadsheet component
 *
 * Features:
 * - Toolbar with file name and action buttons
 * - Formula bar (Phase 2)
 * - Spreadsheet grid with sticky headers
 * - Sheet tabs (Phase 4)
 */
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
  fileName: initialFileName = "Untitled.xlsx",
  onColumnClick,
  onCellEdit,
  onCellMouseDown,
  onCellMouseEnter,
  onFileNameChange,
  onPreview,
  onDownload,
  onSaveAsNew,
  onSave,
}: SpreadsheetViewerProps) {

  const [fileName, setFileName] = useState(initialFileName);

  // If previewLimit is used, clamp the sheetData for rendering
  const displayData = previewLimit === -1 ? sheetData : sheetData.slice(0, previewLimit);

  const { ejWs, colWidths, rowHeights, mergesMap, numRows, numCols } = useExcelData({
    workbook,
    exceljsWorkbook,
    activeSheet,
    sheetData: displayData
  });

  const handleFileNameChange = (name: string) => {
    setFileName(name);
    onFileNameChange?.(name);
  };

  return (
    <div className="flex flex-col h-full bg-[#faf8ff]">
      {/* Toolbar */}
      <SpreadsheetToolbar
        fileName={fileName}
        onFileNameChange={handleFileNameChange}
        onPreview={onPreview}
        onDownload={onDownload}
        onSaveAsNew={onSaveAsNew}
        onSave={onSave}
      />

      {/* Spreadsheet Content */}
      <div className="flex-1 overflow-hidden relative">
        <div className="h-full overflow-auto bg-white">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr className="shadow-sm">
                <th
                  className="border border-[#cbd5e1] p-2 bg-[#F8FAFC] w-12 text-[#475569] font-bold text-xs text-center select-none sticky top-0 left-0 z-20"
                  style={{ width: "48px", minWidth: "48px", maxWidth: "48px" }}
                >
                  #
                </th>
                {Array.from({ length: numCols }).map((_, i) => (
                  <HeaderCell
                    key={i}
                    colIndex={i}
                    colWidth={colWidths[i] || 80}
                    isSelected={mode === 'user' ? selectedColumn === i : selectedRange.includes(`${XLSX.utils.encode_col(i)}:${XLSX.utils.encode_col(i)}`)}
                    onColumnClick={(idx) => onColumnClick?.(idx)}
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
                />
              ))}
              {displayData.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(11, numCols + 1)}
                    className="border border-[#E2E8F0] p-8 text-center text-[#94a3b8] font-semibold bg-white"
                  >
                    Không có dữ liệu hiển thị.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Re-export types for convenience
export type { SpreadsheetViewerProps } from './types/spreadsheet';

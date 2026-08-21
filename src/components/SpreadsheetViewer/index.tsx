import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { HeaderCell } from './components/HeaderCell';
import { CornerHeader } from './components/CornerHeader';
import { Row } from './components/Row';
import { useExcelData } from './hooks/useExcelData';
import { clearStyleCache } from './utils/styleCalculator';

// Virtual scrolling configuration
const ROW_HEIGHT = 32; // Default row height in pixels
const BUFFER_ROWS = 10; // Extra rows to render above/below viewport

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
  onCellEdit?: (r: number, c: number, newValue: string) => void;
  onCellMouseDown?: (r: number, c: number) => void;
  onCellMouseEnter?: (r: number, c: number) => void;
}

// Virtual scrolling component for large spreadsheets
function VirtualGrid({
  rows,
  visibleRange,
  children,
}: {
  rows: number;
  visibleRange: { start: number; end: number };
  children: (startIndex: number, endIndex: number) => React.ReactNode;
}) {
  const startIndex = Math.max(0, visibleRange.start - BUFFER_ROWS);
  const endIndex = Math.min(rows, visibleRange.end + BUFFER_ROWS);

  return (
    <>
      {/* Placeholder rows above visible area */}
      {startIndex > 0 && (
        <tr style={{ height: `${startIndex * ROW_HEIGHT}px` }}>
          <td colSpan={999} className="p-0" />
        </tr>
      )}
      {children(startIndex, endIndex)}
      {/* Placeholder rows below visible area */}
      {endIndex < rows && (
        <tr style={{ height: `${(rows - endIndex) * ROW_HEIGHT}px` }}>
          <td colSpan={999} className="p-0" />
        </tr>
      )}
    </>
  );
}

export function SpreadsheetViewer({
  workbook,
  exceljsWorkbook,
  sheetData,
  activeSheet,
  mode,
  locked = false,
  editableRange = '',
  selectedRange = '',
  selectedColumn = null,
  previewLimit = -1,
  onColumnClick,
  onCellEdit,
  onCellMouseDown,
  onCellMouseEnter
}: SpreadsheetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // Clamp data for preview if needed
  const displayData = previewLimit === -1 ? sheetData : sheetData.slice(0, previewLimit);

  const { ejWs, colWidths, rowHeights, mergesMap, numRows, numCols } = useExcelData({
    workbook,
    exceljsWorkbook,
    activeSheet,
    sheetData: displayData
  });

  // Clear style cache when sheet data changes
  useEffect(() => {
    clearStyleCache();
  }, [activeSheet, sheetData]);

  // Calculate visible row range for virtual scrolling
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / ROW_HEIGHT);
    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT);
    const end = Math.min(numRows, start + visibleCount + 1);
    return { start, end };
  }, [scrollTop, containerHeight, numRows]);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
  }, []);

  // Update container height on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Determine if we should use virtual scrolling
  const useVirtualScrolling = numRows > 100;

  // Total row header width
  const rowHeaderWidth = 48;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-surface relative"
      onScroll={handleScroll}
    >
      <table
        className="w-full border-collapse bg-surface-container-lowest"
        style={{ tableLayout: 'fixed' }}
      >
        <thead className="sticky top-0 z-20 shadow-sm">
          <tr>
            <CornerHeader rowHeaderWidth={rowHeaderWidth} />
            {Array.from({ length: numCols }).map((_, i) => (
              <HeaderCell
                key={i}
                colIndex={i}
                colWidth={colWidths[i] || 150}
                isSelected={
                  mode === 'user'
                    ? selectedColumn === i
                    : selectedRange.includes(`${XLSX.utils.encode_col(i)}:${XLSX.utils.encode_col(i)}`)
                }
                onColumnClick={(idx) => onColumnClick && onColumnClick(idx)}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {numRows === 0 ? (
            <tr>
              <td
                colSpan={Math.max(11, numCols + 1)}
                className="border border-border p-8 text-center text-on-surface-variant font-medium"
              >
                Không có dữ liệu hiển thị.
              </td>
            </tr>
          ) : useVirtualScrolling ? (
            <VirtualGrid rows={numRows} visibleRange={visibleRange}>
              {(startIndex, endIndex) => (
                <>
                  {Array.from({ length: endIndex - startIndex }).map((_, i) => {
                    const r = startIndex + i;
                    return (
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
                    );
                  })}
                </>
              )}
            </VirtualGrid>
          ) : (
            Array.from({ length: numRows }).map((_, r) => (
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
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// Utility functions for performance
const raf = (fn: () => void) => requestAnimationFrame(fn);

const debounce = <T extends (...args: unknown[]) => void>(fn: T, delay: number): T => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
};
import { HeaderCell } from './components/HeaderCell';
import { CornerHeader } from './components/CornerHeader';
import { Row, RowPlaceholder } from './components/Row';
import { FormulaBar, FormulaBarCompact } from './components/FormulaBar';
import { SheetTabs, SheetTabsCompact, SheetTabsDropdown } from './components/SheetTabs';
import { SpreadsheetToolbar, SpreadsheetToolbarCompact } from './components/SpreadsheetToolbar';
import { VersionHistorySidebar } from './components/VersionHistorySidebar';
import { ContextMenu } from './components/ContextMenu';
import { useExcelData } from './hooks/useExcelData';
import { clearStyleCache } from './utils/styleCalculator';

// Performance constants
const ROW_HEIGHT = 32; // Default row height in pixels
const BUFFER_ROWS = 10; // Extra rows to render above/below viewport
const ROW_HEADER_WIDTH = 48; // Row header width in pixels

export interface SpreadsheetViewerProps {
  // Core data
  workbook: XLSX.WorkBook | null;
  exceljsWorkbook: ExcelJS.Workbook | null;
  sheetData: any[][];
  activeSheet: string;
  sheetNames?: string[];

  // Permissions & Mode
  mode: 'user' | 'admin';
  locked?: boolean;
  editableRange?: string;
  selectedRange?: string;
  selectedColumn?: number | null;
  previewLimit?: number;

  // Cell selection state
  selectedCellRef?: string;  // e.g., "A1"
  selectedCellValue?: string; // Current value in selected cell

  // Toolbar props
  fileName?: string;
  onFileNameChange?: (name: string) => void;
  onSave?: () => void;
  onDownload?: () => void;
  onSaveVersion?: () => void;
  isLoading?: {
    save?: boolean;
    download?: boolean;
    saveVersion?: boolean;
  };
  showToolbar?: boolean;
  showFormulaBar?: boolean;

  // Sheet tabs props
  onSheetClick?: (sheetName: string) => void;
  onAddSheet?: () => void;
  onRenameSheet?: (oldName: string, newName: string) => void;
  onDeleteSheet?: (sheetName: string) => void;
  canAddSheets?: boolean;
  canDeleteSheets?: boolean;
  canRenameSheets?: boolean;

  // Version history props
  projectId?: string;
  currentVersion?: number;
  versionHistoryOpen?: boolean;
  onRestoreVersion?: (version: number) => void;
  onToggleVersionHistory?: () => void;

  // Callbacks
  onColumnClick?: (colIndex: number) => void;
  onCellEdit?: (r: number, c: number, newValue: string) => void;
  onCellValueChange?: (value: string) => void;
  onCellMouseDown?: (r: number, c: number) => void;
  onCellMouseEnter?: (r: number, c: number) => void;

  // Freeze panes (admin only)
  frozenRows?: number;
  frozenCols?: number;
  onFrozenRowsChange?: (rows: number) => void;
  onFrozenColsChange?: (cols: number) => void;
}

// Virtual scrolling component for large spreadsheets
function VirtualGrid({
  rows,
  numCols,
  visibleRange,
  children,
}: {
  rows: number;
  numCols: number;
  visibleRange: { start: number; end: number };
  children: (startIndex: number, endIndex: number) => React.ReactNode;
}) {
  const startIndex = Math.max(0, visibleRange.start - BUFFER_ROWS);
  const endIndex = Math.min(rows, visibleRange.end + BUFFER_ROWS);

  return (
    <>
      {startIndex > 0 && (
        <RowPlaceholder height={startIndex * ROW_HEIGHT} numCols={numCols} />
      )}
      {children(startIndex, endIndex)}
      {endIndex < rows && (
        <RowPlaceholder height={(rows - endIndex) * ROW_HEIGHT} numCols={numCols} />
      )}
    </>
  );
}

export function SpreadsheetViewer({
  workbook,
  exceljsWorkbook,
  sheetData,
  activeSheet,
  sheetNames = [],
  mode,
  locked = false,
  editableRange = '',
  selectedRange = '',
  selectedColumn = null,
  previewLimit = -1,
  selectedCellRef = 'A1',
  selectedCellValue = '',
  fileName = 'Untitled',
  onFileNameChange,
  onSave,
  onDownload,
  onSaveVersion,
  isLoading = {},
  showToolbar = true,
  showFormulaBar = true,
  onSheetClick,
  onAddSheet,
  onRenameSheet,
  onDeleteSheet,
  canAddSheets = false,
  canDeleteSheets = false,
  canRenameSheets = false,
  projectId,
  currentVersion,
  versionHistoryOpen = false,
  onRestoreVersion,
  onToggleVersionHistory,
  onColumnClick,
  onCellEdit,
  onCellValueChange,
  onCellMouseDown,
  onCellMouseEnter,
  frozenRows: externalFrozenRows = 0,
  frozenCols: externalFrozenCols = 0,
  onFrozenRowsChange,
  onFrozenColsChange
}: SpreadsheetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [localFrozenRows, setLocalFrozenRows] = useState(externalFrozenRows);
  const [localFrozenCols, setLocalFrozenCols] = useState(externalFrozenCols);

  // Use external state if provided, otherwise internal
  const frozenRows = onFrozenRowsChange ? externalFrozenRows : localFrozenRows;
  const frozenCols = onFrozenColsChange ? externalFrozenCols : localFrozenCols;

  const handleFrozenRowsChange = useCallback((rows: number) => {
    if (onFrozenRowsChange) onFrozenRowsChange(rows);
    else setLocalFrozenRows(rows);
  }, [onFrozenRowsChange]);

  const handleFrozenColsChange = useCallback((cols: number) => {
    if (onFrozenColsChange) onFrozenColsChange(cols);
    else setLocalFrozenCols(cols);
  }, [onFrozenColsChange]);

  // Sync column widths with excel data when sheet changes
  const handleColumnResize = useCallback((colIndex: number, width: number) => {
    setColumnWidths(prev => ({ ...prev, [colIndex]: width }));
  }, []);

  const handleColumnAutoFit = useCallback((colIndex: number) => {
    const minWidth = 60;
    const maxWidth = 300;
    const currentWidth = columnWidths[colIndex] || 100;
    const newWidth = Math.min(maxWidth, Math.max(minWidth, currentWidth + 20));
    setColumnWidths(prev => ({ ...prev, [colIndex]: newWidth }));
  }, [columnWidths]);

  // Clamp data for preview if needed
  const displayData = previewLimit === -1 ? sheetData : sheetData.slice(0, previewLimit);

  // Get Excel data FIRST so we can use it in useMemo below
  const { ejWs, colWidths, rowHeights, mergesMap, numRows, numCols } = useExcelData({
    workbook,
    exceljsWorkbook,
    activeSheet,
    sheetData: displayData
  });

  // Merge user-defined widths with default widths
  const mergedColWidths = useMemo(() => {
    const merged: Record<number, number> = {};
    for (let i = 0; i < numCols; i++) {
      merged[i] = columnWidths[i] ?? colWidths[i] ?? 150;
    }
    return merged;
  }, [colWidths, columnWidths, numCols]);

  // Calculate frozen area height
  const frozenHeight = useMemo(() => {
    let height = 0;
    for (let r = 0; r < frozenRows; r++) {
      height += rowHeights[r] ?? ROW_HEIGHT;
    }
    return height;
  }, [frozenRows, rowHeights]);

  // Calculate frozen area width
  const frozenWidth = useMemo(() => {
    let width = 0;
    for (let c = 0; c < frozenCols; c++) {
      width += mergedColWidths[c] ?? 150;
    }
    return width;
  }, [frozenCols, mergedColWidths]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    r: number;
    c: number;
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback((r: number, c: number, x: number, y: number) => {
    setContextMenu({ r, c, x, y });
  }, []);

  // Prepare sheets for SheetTabs component
  const tabsSheets = useMemo(() => {
    const names = sheetNames || workbook?.SheetNames || [];
    return names.map(name => ({
      name,
      isActive: name === activeSheet,
    }));
  }, [sheetNames, activeSheet]);

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

  // Debounced scroll handler for better performance
  const updateScrollTop = useCallback((scrollTop: number) => {
    setScrollTop(scrollTop);
  }, []);

  const debouncedScrollUpdate = useMemo(
    () => debounce(updateScrollTop, 16), // ~60fps
    [updateScrollTop]
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    raf(() => debouncedScrollUpdate(e.currentTarget.scrollTop));
  }, [debouncedScrollUpdate]);

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

  return (
    <div className="flex flex-col h-full bg-surface relative">
      {/* Toolbar */}
      {showToolbar && (
        <SpreadsheetToolbar
          fileName={fileName}
          onFileNameChange={onFileNameChange}
          onSave={onSave}
          onDownload={onDownload}
          onSaveVersion={onSaveVersion}
          isLoading={isLoading}
          disabled={{
            save: !onSave,
            download: !onDownload,
            saveVersion: !onSaveVersion,
          }}
          showButtons={{
            preview: false,
            download: !!onDownload,
            saveVersion: mode === 'admin' && !!onSaveVersion,
            save: !!onSave,
          }}
        />
      )}

      {/* Freeze Panes Controls (admin only) */}
      {mode === 'admin' && (
        <div className="flex items-center gap-4 px-4 py-1 bg-surface-container border-b border-outline text-xs">
          <span className="text-on-surface-variant">Cố định:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleFrozenRowsChange(Math.max(0, frozenRows - 1))}
              className="px-2 py-0.5 rounded hover:bg-surface-container-high"
            >
              ↑
            </button>
            <span className="w-12 text-center">{frozenRows} dòng</span>
            <button
              onClick={() => handleFrozenRowsChange(frozenRows + 1)}
              className="px-2 py-0.5 rounded hover:bg-surface-container-high"
            >
              ↓
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleFrozenColsChange(Math.max(0, frozenCols - 1))}
              className="px-2 py-0.5 rounded hover:bg-surface-container-high"
            >
              ←
            </button>
            <span className="w-12 text-center">{frozenCols} cột</span>
            <button
              onClick={() => handleFrozenColsChange(frozenCols + 1)}
              className="px-2 py-0.5 rounded hover:bg-surface-container-high"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Formula Bar */}
      {showFormulaBar && (
        <FormulaBar
          cellReference={selectedCellRef}
          value={selectedCellValue}
          readonly={locked}
          onValueChange={onCellValueChange}
        />
      )}

      {/* Sheet Tabs - only show if has actions or multiple sheets */}
      {(canAddSheets || canDeleteSheets || canRenameSheets || tabsSheets.length > 1) && (
        <div className="bg-surface border-b border-outline">
          <SheetTabs
            sheets={tabsSheets}
            activeSheet={activeSheet}
            onSheetClick={onSheetClick}
            onAddSheet={canAddSheets ? onAddSheet : undefined}
            onRenameSheet={canRenameSheets ? onRenameSheet : undefined}
            onDeleteSheet={canDeleteSheets ? onDeleteSheet : undefined}
            canAdd={canAddSheets}
            canDelete={canDeleteSheets}
            canRename={canRenameSheets}
          />
        </div>
      )}

      {/* Grid Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        onScroll={handleScroll}
      >
        <table
          className="w-full border-collapse bg-surface-container-lowest"
          style={{ tableLayout: 'fixed' }}
        >
          <thead
            className="z-20 shadow-sm"
            style={{
              position: frozenRows > 0 ? 'sticky' : 'relative',
              top: frozenRows > 0 ? frozenHeight : 0,
              zIndex: frozenRows > 0 ? 30 : 20,
            }}
          >
            <tr>
              <CornerHeader rowHeaderWidth={ROW_HEADER_WIDTH} frozenWidth={frozenWidth} />
              {Array.from({ length: numCols }).map((_, i) => (
                <HeaderCell
                  key={i}
                  colIndex={i}
                  colWidth={mergedColWidths[i]}
                  isSelected={
                    mode === 'user'
                      ? selectedColumn === i
                      : selectedRange.includes(`${XLSX.utils.encode_col(i)}:${XLSX.utils.encode_col(i)}`)
                  }
                  frozenCols={frozenCols}
                  frozenWidth={frozenWidth}
                  onColumnClick={(idx) => onColumnClick?.(idx)}
                  onColumnResize={mode === 'admin' ? handleColumnResize : undefined}
                  onColumnAutoFit={mode === 'admin' ? handleColumnAutoFit : undefined}
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
              <VirtualGrid rows={numRows} numCols={numCols} visibleRange={visibleRange}>
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
                          colWidths={mergedColWidths}
                          mergesMap={mergesMap}
                          mode={mode}
                          editableRange={editableRange}
                          isLocked={locked}
                          selectedColumn={selectedColumn}
                          selectedRange={selectedRange}
                          onCellEdit={onCellEdit}
                          onMouseDown={onCellMouseDown}
                          onMouseEnter={onCellMouseEnter}
                          onContextMenu={handleContextMenu}
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
                  colWidths={mergedColWidths}
                  mergesMap={mergesMap}
                  mode={mode}
                  editableRange={editableRange}
                  isLocked={locked}
                  selectedColumn={selectedColumn}
                  selectedRange={selectedRange}
                  onCellEdit={onCellEdit}
                  onMouseDown={onCellMouseDown}
                  onMouseEnter={onCellMouseEnter}
                  onContextMenu={handleContextMenu}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Version History Sidebar */}
      {projectId && onToggleVersionHistory && (
        <VersionHistorySidebar
          projectId={projectId}
          currentVersion={currentVersion}
          onRestore={onRestoreVersion}
          isOpen={versionHistoryOpen}
          onToggle={onToggleVersionHistory}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            { label: 'Copy', shortcut: 'Ctrl+C', onClick: () => {/* TODO: implement */} },
            { label: 'Paste', shortcut: 'Ctrl+V', onClick: () => {/* TODO: implement */}, disabled: mode !== 'user' || locked },
            { label: 'Cut', shortcut: 'Ctrl+X', onClick: () => {/* TODO: implement */} },
            { separator: true, label: '', onClick: () => {} },
            { label: 'Insert Row Above', onClick: () => {/* TODO: implement */} },
            { label: 'Insert Row Below', onClick: () => {/* TODO: implement */} },
            { label: 'Delete Row', onClick: () => {/* TODO: implement */} },
            { separator: true, label: '', onClick: () => {} },
            { label: 'Insert Column Left', onClick: () => {/* TODO: implement */} },
            { label: 'Insert Column Right', onClick: () => {/* TODO: implement */} },
            { label: 'Delete Column', onClick: () => {/* TODO: implement */} },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

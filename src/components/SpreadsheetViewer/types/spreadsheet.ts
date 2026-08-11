import React from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// ============================================================
// SpreadsheetViewer Props
// ============================================================

export interface SpreadsheetViewerProps {
  /** SheetJS workbook instance */
  workbook: XLSX.WorkBook | null;
  /** ExcelJS workbook instance for styling */
  exceljsWorkbook: ExcelJS.Workbook | null;
  /** 2D array of cell values */
  sheetData: unknown[][];
  /** Name of the active sheet */
  activeSheet: string;
  /** User mode: 'user' (customer view) or 'admin' (editing) */
  mode: 'user' | 'admin';
  /** Whether the spreadsheet is locked (no editing) */
  locked?: boolean;
  /** Cell range that can be edited (e.g., "A1:D10") */
  editableRange?: string;
  /** Currently selected range */
  selectedRange?: string;
  /** Currently selected column index */
  selectedColumn?: number | null;
  /** Max rows to display (-1 for all) */
  previewLimit?: number;
  /** File name for display */
  fileName?: string;
  /** Callback when column header is clicked */
  onColumnClick?: (colIndex: number) => void;
  /** Callback when cell is edited */
  onCellEdit?: (r: number, c: number, newValue: string) => void;
  /** Callback when mouse down on cell */
  onCellMouseDown?: (r: number, c: number) => void;
  /** Callback when mouse enters cell */
  onCellMouseEnter?: (r: number, c: number) => void;
  /** Callback when file name changes */
  onFileNameChange?: (name: string) => void;
  /** Callback for preview action */
  onPreview?: () => void;
  /** Callback for download action */
  onDownload?: () => void;
  /** Callback for save as new version */
  onSaveAsNew?: () => void;
  /** Callback for save action */
  onSave?: () => void;
  /** Callback when sheet tab is clicked */
  onSheetChange?: (sheetName: string) => void;
  /** List of sheet names */
  sheetNames?: string[];
}

// ============================================================
// Toolbar Types
// ============================================================

export interface ToolbarProps {
  /** Current file name */
  fileName: string;
  /** Callback when file name changes */
  onFileNameChange?: (name: string) => void;
  /** Preview action */
  onPreview?: () => void;
  /** Download action */
  onDownload?: () => void;
  /** Save as new version action */
  onSaveAsNew?: () => void;
  /** Save action */
  onSave?: () => void;
}

// ============================================================
// Formula Bar Types
// ============================================================

export interface FormulaBarProps {
  /** Current cell reference (e.g., "C5") */
  cellReference: string;
  /** Current cell value or formula */
  value: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Whether formula bar is editable */
  editable?: boolean;
}

// ============================================================
// Grid Types
// ============================================================

export interface ColumnHeaderProps {
  /** Column index (0-based) */
  colIndex: number;
  /** Column width in pixels */
  colWidth: number;
  /** Whether this column is selected */
  isSelected: boolean;
  /** Callback when header is clicked */
  onColumnClick: (colIndex: number) => void;
}

export interface RowHeaderProps {
  /** Row index (0-based) */
  rowIndex: number;
  /** Row height in pixels */
  rowHeight?: number;
  /** Whether this row is selected */
  isSelected?: boolean;
  /** Callback when header is clicked */
  onRowClick?: (rowIndex: number) => void;
}

export interface SpreadsheetCellProps {
  /** Row index (0-based) */
  r: number;
  /** Column index (0-based) */
  c: number;
  /** Cell value */
  value: string;
  /** Computed UI styles */
  uiStyles: CellUIStyles;
  /** User or admin mode */
  mode: 'user' | 'admin';
  /** Whether cell is editable */
  isEditable: boolean;
  /** Callback when cell is edited */
  onCellEdit?: (r: number, c: number, newValue: string) => void;
  /** Callback for mouse down */
  onMouseDown?: (r: number, c: number) => void;
  /** Callback for mouse enter */
  onMouseEnter?: (r: number, c: number) => void;
}

export interface RowProps {
  /** Row index (0-based) */
  r: number;
  /** Row data array */
  rowData: string[];
  /** Number of columns */
  numCols: number;
  /** Row height from Excel */
  rowHeight?: number;
  /** ExcelJS worksheet for styling */
  ejWs?: ExcelJS.Worksheet;
  /** Column widths map */
  colWidths: Record<number, number>;
  /** Merge information map */
  mergesMap: Record<string, MergeInfo>;
  /** User or admin mode */
  mode: 'user' | 'admin';
  /** Editable cell range */
  editableRange: string;
  /** Whether spreadsheet is locked */
  isLocked: boolean;
  /** Currently selected column */
  selectedColumn: number | null;
  /** Currently selected range */
  selectedRange: string;
  /** Callback when cell is edited */
  onCellEdit?: (r: number, c: number, newValue: string) => void;
  /** Callback for mouse down */
  onMouseDown?: (r: number, c: number) => void;
  /** Callback for mouse enter */
  onMouseEnter?: (r: number, c: number) => void;
}

// ============================================================
// Style Types
// ============================================================

export interface CellUIStyles {
  /** Whether to skip rendering (part of merged cell) */
  shouldSkip: boolean;
  /** Merge information */
  mergeInfo: MergeInfo | { shouldSkip: false };
  /** Whether to truncate text */
  shouldTruncate: boolean;
  /** Styles for td element */
  finalTdStyle: React.CSSProperties;
  /** Styles for span element */
  spanStyle: React.CSSProperties;
}

export interface MergeInfo {
  /** Whether this cell should be skipped */
  shouldSkip: boolean;
  /** Row span if merged */
  rowSpan?: number;
  /** Column span if merged */
  colSpan?: number;
}

export interface ComputeCellStylesOptions {
  /** ExcelJS worksheet */
  ejWs?: ExcelJS.Worksheet;
  /** Row index */
  r: number;
  /** Column index */
  c: number;
  /** Whether cell is editable */
  isEditable: boolean;
  /** Whether cell is selected */
  isSelected: boolean;
  /** Custom selection color */
  selectedColor?: string;
  /** Merge information */
  mergeInfo?: MergeInfo;
  /** Column widths */
  colWidths: Record<number, number>;
}

// ============================================================
// Sheet Tabs Types
// ============================================================

export interface SheetTabsProps {
  /** List of sheet names */
  sheetNames: string[];
  /** Currently active sheet */
  activeSheet: string;
  /** Callback when sheet is selected */
  onSheetChange: (sheetName: string) => void;
  /** Callback when new sheet is created */
  onAddSheet?: () => void;
}

// ============================================================
// Status Bar Types
// ============================================================

export interface StatusBarProps {
  /** Current cell reference */
  cellReference?: string;
  /** Current cell value */
  cellValue?: string;
  /** Selection range */
  selectionRange?: string;
  /** Number of rows */
  rowCount?: number;
  /** Number of columns */
  columnCount?: number;
  /** Zoom level percentage */
  zoom?: number;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
}

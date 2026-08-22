import React, { useMemo } from 'react';
import * as XLSX from 'xlsx';
import type ExcelJS from 'exceljs';
import { Cell } from './Cell';
import { computeCellUIStyles } from '../utils/styleCalculator';
import { MergeInfo, isCellInRange } from '../../../lib/utils-excel';

// Performance constants
const ROW_HEADER_WIDTH = 48;

// Helper functions extracted for single responsibility
const getEditableRange = (cellRef: string, editableRange: string): boolean =>
  isCellInRange(cellRef, editableRange);

const isCellSelected = (mode: 'user' | 'admin', selectedColumn: number | null, c: number, selectedRange: string): boolean => {
  const colRef = XLSX.utils.encode_col(c);
  const isColSelected = selectedColumn === c;
  const isRangeSelected = isCellInRange(colRef, selectedRange) || selectedRange.includes(`${colRef}:${colRef}`);
  return mode === 'user' ? isColSelected : isRangeSelected;
};

const getCellValue = (rowData: string[], c: number): string => rowData[c] || "";

const buildCellKey = (r: number, c: number): string => `${r},${c}`;

// Placeholder row header for virtual scrolling
interface RowHeaderPlaceholderProps {
  height: number;
  rowNumber: number;
}

export const RowHeaderPlaceholder = React.memo(({ height, rowNumber }: RowHeaderPlaceholderProps) => (
  <td
    className="sticky left-0 z-10 bg-surface-container-lowest border-r border-b border-border select-none"
    style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, maxWidth: ROW_HEADER_WIDTH, height }}
  >
    <div className="flex items-center justify-center h-full text-center text-label-sm font-medium text-on-surface-variant">
      {rowNumber}
    </div>
  </td>
));
RowHeaderPlaceholder.displayName = 'RowHeaderPlaceholder';

interface RowHeaderProps {
  rowNumber: number;
}

export const RowHeader = React.memo(({ rowNumber }: RowHeaderProps) => (
  <td
    className="sticky left-0 z-10 px-1 py-2 bg-surface-container-lowest border-r border-b border-border text-center text-label-sm font-medium text-on-surface-variant select-none"
    style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, maxWidth: ROW_HEADER_WIDTH }}
  >
    {rowNumber}
  </td>
));
RowHeader.displayName = 'RowHeader';

// Placeholder row for virtual scrolling
interface RowPlaceholderProps {
  height: number;
  numCols: number;
}

export const RowPlaceholder = React.memo(({ height, numCols }: RowPlaceholderProps) => (
  <tr style={{ height }}>
    <RowHeaderPlaceholder height={height} rowNumber={0} />
    <td colSpan={numCols} className="p-0" />
  </tr>
));
RowPlaceholder.displayName = 'RowPlaceholder';

interface RowProps {
  r: number;
  rowData: string[];
  numCols: number;
  rowHeight: number | undefined;
  ejWs: ExcelJS.Worksheet | undefined;
  colWidths: Record<number, number>;
  mergesMap: Record<string, MergeInfo>;
  mode: 'user' | 'admin';
  editableRange: string;
  isLocked: boolean;
  selectedColumn: number | null;
  selectedRange: string;
  onCellEdit?: (r: number, c: number, newValue: string) => void;
  onMouseDown?: (r: number, c: number) => void;
  onMouseEnter?: (r: number, c: number) => void;
  onContextMenu?: (r: number, c: number, x: number, y: number) => void;
}

export const Row = React.memo(({
  r, rowData, numCols, rowHeight, ejWs, colWidths, mergesMap,
  mode, editableRange, isLocked, selectedColumn, selectedRange,
  onCellEdit, onMouseDown, onMouseEnter, onContextMenu
}: RowProps) => {
  const rowStyle = rowHeight ? { height: `${rowHeight}px` } : undefined;

  const cells = useMemo(() => Array.from({ length: numCols }, (_, c) => {
    const val = getCellValue(rowData, c);
    const cellRef = XLSX.utils.encode_cell({ r, c });
    const mergeInfo = mergesMap[buildCellKey(r, c)];
    const isEditable = mode === 'user'
      ? !isLocked && getEditableRange(cellRef, editableRange)
      : getEditableRange(cellRef, editableRange);
    const isSelected = isCellSelected(mode, selectedColumn, c, selectedRange);

    const uiStyles = computeCellUIStyles({
      ejWs, r, c, isEditable, isSelected, mergeInfo, colWidths,
      selectedColor: mode === 'admin' ? 'rgba(37, 99, 235, 0.12)' : undefined
    });

    return (
      <Cell
        key={c}
        r={r}
        c={c}
        value={val}
        uiStyles={uiStyles}
        mode={mode}
        isEditable={isEditable}
        onCellEdit={onCellEdit}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onContextMenu={onContextMenu}
      />
    );
  }), [numCols, rowData, r, mergesMap, mode, isLocked, editableRange, selectedColumn, selectedRange, ejWs, colWidths, onCellEdit, onMouseDown, onMouseEnter, onContextMenu]);

  return (
    <tr className="hover:bg-surface-container-low" style={rowStyle}>
      <RowHeader rowNumber={r + 1} />
      {cells}
    </tr>
  );
});
Row.displayName = 'Row';

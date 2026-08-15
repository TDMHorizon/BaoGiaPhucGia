import React from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Cell } from './Cell';
import { computeCellUIStyles } from '../utils/styleCalculator';
import { MergeInfo, isCellInRange } from '../../../lib/utils-excel';

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
}

export const Row = React.memo(({
  r, rowData, numCols, rowHeight, ejWs, colWidths, mergesMap,
  mode, editableRange, isLocked, selectedColumn, selectedRange,
  onCellEdit, onMouseDown, onMouseEnter
}: RowProps) => {
  return (
    <tr style={rowHeight ? { height: `${rowHeight}px` } : undefined}>
      <td className="border border-slate-300 p-2 bg-slate-100 text-center font-medium text-slate-500 select-none sticky left-0 z-10" style={{ width: "48px", minWidth: "48px", maxWidth: "48px" }}>
        {r + 1}
      </td>
      {Array.from({ length: numCols }).map((_, c) => {
        const val = rowData[c] || "";
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const mergeInfo = mergesMap[`${r},${c}`];
        
        let isEditable = false;
        if (mode === 'user') {
          isEditable = !isLocked && isCellInRange(cellRef, editableRange);
        } else {
          // In admin mode, editableRange is the current range being edited for the template
          isEditable = isCellInRange(cellRef, editableRange);
        }

        let isSelected = false;
        if (mode === 'user') {
          isSelected = selectedColumn === c;
        } else {
          // Admin drag selection 
          isSelected = isCellInRange(cellRef, selectedRange) || selectedRange.includes(`${XLSX.utils.encode_col(c)}:${XLSX.utils.encode_col(c)}`); // Also check if full column is selected in admin
        }

        const uiStyles = computeCellUIStyles({
          ejWs,
          r,
          c,
          isEditable,
          isSelected,
          mergeInfo,
          colWidths,
          selectedColor: mode === 'admin' ? "rgba(79, 70, 229, 0.15)" : undefined
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
          />
        );
      })}
    </tr>
  );
});
Row.displayName = 'Row';

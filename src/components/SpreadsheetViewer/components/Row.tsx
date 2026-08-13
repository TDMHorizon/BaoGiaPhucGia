import React from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Cell } from './Cell';
import { computeCellUIStyles } from '../utils/styleCalculator';
import { MergeInfo, isCellInRange } from '../../../lib/utils-excel';
import { RowProps } from '../types/spreadsheet';

/**
 * Row - Row component for spreadsheet
 *
 * Matches Stitch design:
 * - Row header: bg-[#F8FAFC], text-[#475569], font-medium
 */
export const Row = React.memo(function Row({
  r,
  rowData,
  numCols,
  rowHeight,
  ejWs,
  colWidths,
  mergesMap,
  mode,
  editableRange,
  isLocked,
  selectedColumn,
  selectedRange,
  onCellEdit,
  onMouseDown,
  onMouseEnter
}: RowProps) {
  return (
    <tr style={rowHeight ? { height: `${rowHeight}px` } : undefined}>
      {/* Row Header */}
      <td
        className="border-r border-b border-[#cbd5e1] p-2 bg-[#F8FAFC] text-center font-medium text-xs text-[#475569] select-none sticky left-0 z-10"
        style={{ width: "48px", minWidth: "48px", maxWidth: "48px" }}
      >
        {r + 1}
      </td>

      {/* Data Cells */}
      {Array.from({ length: numCols }).map((_, c) => {
        const val = rowData[c] || "";
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const mergeInfo = mergesMap[`${r},${c}`];

        let isEditable = false;
        if (mode === 'user') {
          isEditable = !isLocked && isCellInRange(cellRef, editableRange);
        } else {
          isEditable = isCellInRange(cellRef, editableRange);
        }

        let isSelected = false;
        if (mode === 'user') {
          isSelected = selectedColumn === c;
        } else {
          isSelected = isCellInRange(cellRef, selectedRange) || selectedRange.includes(`${XLSX.utils.encode_col(c)}:${XLSX.utils.encode_col(c)}`);
        }

        const uiStyles = computeCellUIStyles({
          ejWs,
          r,
          c,
          isEditable,
          isSelected,
          mergeInfo,
          colWidths,
          selectedColor: mode === 'admin' ? "rgba(0, 74, 198, 0.1)" : undefined
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

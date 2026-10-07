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
    onRowClick?: (r: number) => void;
}

export const Row = React.memo(({
                                   r, rowData, numCols, rowHeight, ejWs, colWidths, mergesMap,
                                   mode, editableRange, isLocked, selectedColumn, selectedRange,
                                   onCellEdit, onMouseDown, onMouseEnter, onRowClick
                               }: RowProps) => {

    const safeEditableRange = editableRange || "";
    const editableParts = safeEditableRange.split(",").map(s => s.trim()).filter(Boolean);

    // Nhận diện vùng nguyên dòng
    const rowStr = `${r + 1}:${r + 1}`;
    const isRowExplicitlyEditable = editableParts.includes(rowStr);

    const safeIsCellInRange = (cell: string, range: string) => {
        if (!range) return false;
        try {
            const parts = range.split(",").map(v => v.trim()).filter(Boolean);


            if (parts.includes(cell)) return true;


            const validRanges = parts.filter(v => v.includes(':') && v.match(/[A-Z]+\d+:[A-Z]+\d+/));
            if (validRanges.length === 0) return false;
            return isCellInRange(cell, validRanges.join(","));
        } catch (e) {
            return false;
        }
    };

    return (
        <tr style={rowHeight ? { height: `${rowHeight}px` } : undefined}>
            {/* Ô Header Dòng có chức năng Click */}
            <td
                className={`border border-slate-300 p-2 text-center font-medium select-none sticky left-0 z-10 cursor-pointer transition-colors ${
                    isRowExplicitlyEditable ? "bg-indigo-100 text-indigo-700 font-bold" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
                style={{ width: "48px", minWidth: "48px", maxWidth: "48px" }}
                onClick={(e) => {
                    e.preventDefault();
                    if (onRowClick) onRowClick(r);
                }}
            >
                {r + 1}
            </td>

            {Array.from({ length: numCols }).map((_, c) => {
                const val = rowData[c] || "";
                const cellRef = XLSX.utils.encode_cell({ r, c });
                const mergeInfo = mergesMap[`${r},${c}`];

                const colLetter = XLSX.utils.encode_col(c);
                const colStr = `${colLetter}:${colLetter}`;

                // Kiểm tra xem ô có nằm trong phân quyền (kể cả chọn dòng/cột) không
                const cellIsInRage = isRowExplicitlyEditable || editableParts.includes(colStr) || safeIsCellInRange(cellRef, safeEditableRange);

                let isEditable = false;
                if (mode === 'user') {
                    isEditable = !isLocked && cellIsInRage;
                } else {
                    isEditable = cellIsInRage;
                }

                let isSelected = false;
                if (mode === 'user') {
                    isSelected = selectedColumn === c;
                } else {
                    isSelected = selectedRange
                        ? (safeIsCellInRange(cellRef, selectedRange) || selectedRange.includes(colStr))
                        : false;
                }

                const uiStyles = computeCellUIStyles({
                    ejWs, r, c, isEditable, isSelected, mergeInfo, colWidths,
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
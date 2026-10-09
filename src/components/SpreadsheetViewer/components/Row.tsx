import React from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Cell, ActiveEditor } from './Cell';
import { computeCellUIStyles } from '../utils/styleCalculator';
import { MergeInfo, isCellInRange, isCellDisabled, isRowDisabled } from '../../../lib/utils-excel';

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
    activeSheet?: string;
    disabledRanges?: any;
    activeEditors?: Record<string, ActiveEditor>;
    onCellEdit?: (r: number, c: number, newValue: string) => void;
    onCellFocus?: (r: number, c: number, cell: string) => void;
    onCellBlur?: (r: number, c: number, cell: string) => void;
    onMouseDown?: (r: number, c: number) => void;
    onMouseEnter?: (r: number, c: number) => void;
    onRowClick?: (r: number) => void;
}

export const Row = React.memo(({
                                   r, rowData, numCols, rowHeight, ejWs, colWidths, mergesMap,
                                   mode, editableRange, isLocked, selectedColumn, selectedRange,
                                   activeSheet = "", disabledRanges,
                                   activeEditors, onCellEdit, onCellFocus, onCellBlur, onMouseDown, onMouseEnter, onRowClick
                               }: RowProps) => {

    const safeEditableRange = editableRange || "";
    const editableParts = safeEditableRange.split(",").map(s => s.trim()).filter(Boolean);

    // Kiểm tra xem toàn bộ dòng có bị Admin vô hiệu hóa logic không (UC04 Tình huống 10)
    const isCurrentRowDisabled = isRowDisabled(activeSheet, r + 1, disabledRanges);

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

    const rowHeaderClass = isCurrentRowDisabled
        ? "bg-slate-700 text-slate-300 font-bold border-slate-600 hover:bg-slate-800"
        : isRowExplicitlyEditable
            ? "bg-indigo-100 text-indigo-700 font-bold"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200";

    return (
        <tr style={rowHeight ? { height: `${rowHeight}px` } : undefined}>
            {/* Ô Header Dòng có chức năng Click */}
            <td
                className={`border border-slate-300 p-2 text-center font-medium select-none sticky left-0 z-10 cursor-pointer transition-colors ${rowHeaderClass}`}
                style={{ width: "48px", minWidth: "48px", maxWidth: "48px" }}
                title={isCurrentRowDisabled ? `Dòng ${r + 1} đã bị Admin vô hiệu hóa` : `Dòng ${r + 1}`}
                onClick={(e) => {
                    e.preventDefault();
                    if (onRowClick) onRowClick(r);
                }}
            >
                <div className="flex items-center justify-center gap-0.5">
                    {isCurrentRowDisabled && (
                        <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    )}
                    <span>{r + 1}</span>
                </div>
            </td>

            {Array.from({ length: numCols }).map((_, c) => {
                const val = rowData[c] || "";
                const cellRef = XLSX.utils.encode_cell({ r, c });
                const mergeInfo = mergesMap[`${r},${c}`];

                const colLetter = XLSX.utils.encode_col(c);
                const colStr = `${colLetter}:${colLetter}`;

                // Kiểm tra xem ô có bị vô hiệu hóa logic bởi Admin không (UC04 Tình huống 10)
                const isCellDisabledByAdmin = isCellDisabled(activeSheet, cellRef, disabledRanges);

                // Kiểm tra xem ô có nằm trong phân quyền (kể cả chọn dòng/cột) không
                const cellIsInRage = isRowExplicitlyEditable || editableParts.includes(colStr) || safeIsCellInRange(cellRef, safeEditableRange);

                let isEditable = false;
                if (isCellDisabledByAdmin) {
                    isEditable = false;
                } else if (mode === 'user') {
                    isEditable = !isLocked && cellIsInRage;
                } else {
                    // Admin và Manager luôn có toàn quyền sửa mọi ô trên bảng tính nếu chưa bị vô hiệu hóa
                    isEditable = true;
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
                    ejWs,
                    r,
                    c,
                    isEditable,
                    isInEditableRange: cellIsInRage,
                    isSelected,
                    mergeInfo,
                    colWidths,
                    selectedColor: mode === 'admin' ? "rgba(99, 102, 241, 0.3)" : undefined
                });

                const activeEditor = activeEditors?.[cellRef] || activeEditors?.[`${r},${c}`];

                return (
                    <Cell
                        key={c}
                        r={r}
                        c={c}
                        value={val}
                        uiStyles={uiStyles}
                        mode={mode}
                        isEditable={isEditable}
                        isDisabled={isCellDisabledByAdmin}
                        activeEditor={activeEditor}
                        onCellEdit={onCellEdit}
                        onCellFocus={onCellFocus ? (rowIdx, colIdx) => onCellFocus(rowIdx, colIdx, cellRef) : undefined}
                        onCellBlur={onCellBlur ? (rowIdx, colIdx) => onCellBlur(rowIdx, colIdx, cellRef) : undefined}
                        onMouseDown={onMouseDown}
                        onMouseEnter={onMouseEnter}
                    />
                );
            })}
        </tr>
    );
});
Row.displayName = 'Row';

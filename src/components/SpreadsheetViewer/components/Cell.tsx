import React, { useState, useEffect, useMemo } from 'react';
import { CellUIStyles } from '../utils/styleCalculator';
import { evaluateCellValue } from '../../../lib/formulaEvaluator';

export interface ActiveEditor {
  userId: string;
  username: string;
  color?: string;
}

interface CellProps {
  r: number;
  c: number;
  value: string;
  sheetData?: any[][];
  uiStyles: CellUIStyles;
  mode: 'user' | 'admin';
  isEditable: boolean;
  isDisabled?: boolean;
  activeEditor?: ActiveEditor;
  onCellEdit?: (r: number, c: number, newValue: string) => void;
  onCellFocus?: (r: number, c: number) => void;
  onCellBlur?: (r: number, c: number) => void;
  onCellClick?: (r: number, c: number, value: string) => void;
  onMouseDown?: (r: number, c: number) => void;
  onMouseEnter?: (r: number, c: number) => void;
}

export const Cell = React.memo(({
  r,
  c,
  value,
  sheetData = [],
  uiStyles,
  mode,
  isEditable,
  isDisabled = false,
  activeEditor,
  onCellEdit,
  onCellFocus,
  onCellBlur,
  onCellClick,
  onMouseDown,
  onMouseEnter
}: CellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  // Sync internal state if external value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Thoát chế độ edit ngay lập tức nếu ô bị Admin vô hiệu hóa (UC04 Tình huống 10)
  useEffect(() => {
    if (isDisabled && isEditing) {
      setIsEditing(false);
      if (onCellBlur) onCellBlur(r, c);
    }
  }, [isDisabled, isEditing, onCellBlur, r, c]);

  // Evaluate formula if value starts with '='
  const { displayValue, isFormula } = useMemo(() => {
    if (typeof value === 'string' && value.startsWith('=')) {
      return evaluateCellValue(value, sheetData);
    }
    return { displayValue: value ?? "", isFormula: false, rawFormula: "" };
  }, [value, sheetData]);

  if (uiStyles.shouldSkip) return null;

  const handleClick = (e: React.MouseEvent) => {
    if (onCellClick) {
      onCellClick(r, c, value);
    }
  };

  const handleDoubleClick = () => {
    // Vùng bị vô hiệu hóa tuyệt đối không cho chỉnh sửa (kể cả admin/user)
    if (isDisabled) return;

    // MỞ QUYỀN CHO ADMIN SỬA HOẶC USER NẾU CÓ QUYỀN
    if (mode === 'admin' || isEditable) {
      setIsEditing(true);
      setEditValue(value);
      if (onCellFocus) onCellFocus(r, c);
    }
  };

  const handleSave = () => {
    if (isDisabled) {
      setIsEditing(false);
      return;
    }
    if (editValue !== value && onCellEdit) {
      onCellEdit(r, c, editValue);
    }
    setIsEditing(false);
    if (onCellBlur) onCellBlur(r, c);
  };

  const activeEditorColor = activeEditor?.color || "#6366f1";

  const className = `border border-slate-300 p-2 transition-colors relative ${
      isDisabled
          ? 'bg-slate-700 text-slate-400 select-none cursor-not-allowed border-slate-600'
          : activeEditor && !isEditing
              ? 'ring-2 ring-indigo-500 bg-indigo-50/60 shadow-sm'
              : mode === 'admin'
                  ? 'cursor-text hover:outline hover:outline-2 hover:outline-indigo-500 hover:-outline-offset-2'
                  : isEditable
                      ? "cursor-text hover:outline hover:outline-2 hover:outline-emerald-500 hover:-outline-offset-2"
                      : "cursor-not-allowed"
  } ${uiStyles.shouldTruncate ? 'truncate' : ''}`;

  const cellTitle = isDisabled
      ? `Ô đã bị Admin vô hiệu hóa (Không thể chỉnh sửa): ${value}`
      : activeEditor
          ? `${activeEditor.username} đang chỉnh sửa ô này: ${value}`
          : isFormula
              ? `Hàm fx: ${value} → Kết quả: ${displayValue}`
              : value;

  const finalStyle = isDisabled
      ? { ...uiStyles.finalTdStyle, backgroundColor: '#334155', color: '#94a3b8' }
      : uiStyles.finalTdStyle;

  const spanStyle = isDisabled
      ? { ...uiStyles.spanStyle, color: '#94a3b8' }
      : uiStyles.spanStyle;

  return (
      <td
          className={className}
          style={finalStyle}
          title={cellTitle}
          rowSpan={uiStyles.mergeInfo && 'rowSpan' in uiStyles.mergeInfo ? uiStyles.mergeInfo.rowSpan : undefined}
          colSpan={uiStyles.mergeInfo && 'colSpan' in uiStyles.mergeInfo ? uiStyles.mergeInfo.colSpan : undefined}
          onClick={handleClick}
          onMouseDown={() => onMouseDown && onMouseDown(r, c)}
          onMouseEnter={() => onMouseEnter && onMouseEnter(r, c)}
          onDoubleClick={handleDoubleClick}
      >
        {activeEditor && !isEditing && !isDisabled && (
          <div
            className="absolute -top-2.5 left-1 z-30 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-md pointer-events-none select-none whitespace-nowrap"
            style={{ backgroundColor: activeEditorColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
            <span>{activeEditor.username}</span>
          </div>
        )}

        {isEditing && !isDisabled ? (
            <textarea
                autoFocus
                className="w-full h-full p-1 border-2 border-emerald-500 rounded bg-white shadow-inner focus:outline-none text-slate-800 resize-none min-h-[60px] font-mono text-xs"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSave();
                  } else if (e.key === "Escape") {
                    setIsEditing(false);
                    setEditValue(value);
                    if (onCellBlur) onCellBlur(r, c);
                  }
                }}
            />
        ) : (
            <span style={spanStyle} className="flex items-center gap-1 relative">
              {isDisabled && (
                <svg className="w-3 h-3 text-slate-400 inline-block flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
              {isFormula && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" title={`Hàm: ${value}`} />
              )}
              <span>{displayValue}</span>
            </span>
        )}
      </td>
  );
});
Cell.displayName = 'Cell';

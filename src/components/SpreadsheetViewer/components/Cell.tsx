import React, { useState, useEffect } from 'react';
import { CellUIStyles } from '../utils/styleCalculator';

interface CellProps {
  r: number;
  c: number;
  value: string;
  uiStyles: CellUIStyles;
  mode: 'user' | 'admin';
  isEditable: boolean;
  onCellEdit?: (r: number, c: number, newValue: string) => void;
  onMouseDown?: (r: number, c: number) => void;
  onMouseEnter?: (r: number, c: number) => void;
}

export const Cell = React.memo(({ r, c, value, uiStyles, mode, isEditable, onCellEdit, onMouseDown, onMouseEnter }: CellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  // Sync internal state if external value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (uiStyles.shouldSkip) return null;

  const handleDoubleClick = () => {
    // MỞ QUYỀN CHO ADMIN SỬA HOẶC USER NẾU CÓ QUYỀN
    if (mode === 'admin' || isEditable) {
      setIsEditing(true);
      setEditValue(value);
    }
  };

  const handleSave = () => {
    if (editValue !== value && onCellEdit) {
      onCellEdit(r, c, editValue);
    }
    setIsEditing(false);
  };

  const className = `border border-slate-300 p-2 transition-colors ${
      mode === 'admin'
          ? 'cursor-text hover:outline hover:outline-2 hover:outline-indigo-500 hover:-outline-offset-2'
          : isEditable
              ? "cursor-text hover:outline hover:outline-2 hover:outline-emerald-500 hover:-outline-offset-2"
              : "cursor-not-allowed"
  } ${uiStyles.shouldTruncate ? 'truncate' : ''}`;

  return (
      <td
          className={className}
          style={uiStyles.finalTdStyle}
          title={value}
          rowSpan={uiStyles.mergeInfo && 'rowSpan' in uiStyles.mergeInfo ? uiStyles.mergeInfo.rowSpan : undefined}
          colSpan={uiStyles.mergeInfo && 'colSpan' in uiStyles.mergeInfo ? uiStyles.mergeInfo.colSpan : undefined}
          onMouseDown={() => onMouseDown && onMouseDown(r, c)}
          onMouseEnter={() => onMouseEnter && onMouseEnter(r, c)}
          onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
            <textarea
                autoFocus
                className="w-full h-full p-1 border-2 border-emerald-500 rounded bg-white shadow-inner focus:outline-none text-slate-800 resize-none min-h-[60px]"
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
                  }
                }}
            />
        ) : (
            <span style={uiStyles.spanStyle}>
          {value}
        </span>
        )}
      </td>
  );
});
Cell.displayName = 'Cell';

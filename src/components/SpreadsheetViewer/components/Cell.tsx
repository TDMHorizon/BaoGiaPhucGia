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

<<<<<<< HEAD
  // Sync internal state if external value changes
=======
  // Sync internal state if external value changes (e.g. from another user's edit or undo)
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (uiStyles.shouldSkip) return null;

  const handleDoubleClick = () => {
<<<<<<< HEAD
    // MỞ QUYỀN CHO ADMIN SỬA HOẶC USER NẾU CÓ QUYỀN
    if (mode === 'admin' || isEditable) {
=======
    if (mode === 'user' && isEditable) {
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
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

<<<<<<< HEAD
  // TÔ MÀU CHO ADMIN THẤY Ô NÀO ĐANG ĐƯỢC MỞ QUYỀN - SỬA THÀNH MÀU XANH LÁ NHẠT
  const adminHighlightClass = (mode === 'admin' && isEditable)
      ? '!bg-emerald-100/80 !text-emerald-900 font-medium border-emerald-200'
      : '';

  const className = `border border-slate-300 p-2 transition-colors ${adminHighlightClass} ${
      mode === 'admin'
          ? 'cursor-text hover:outline hover:outline-2 hover:outline-emerald-500 hover:-outline-offset-2'
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
=======
  const className = `border border-slate-300 p-2 ${
    mode === 'admin' 
      ? 'cursor-crosshair' 
      : isEditable 
        ? "cursor-text hover:outline hover:outline-2 hover:outline-indigo-500 hover:-outline-offset-2" 
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
          className="w-full h-full p-1 border-2 border-indigo-500 rounded bg-white shadow-inner focus:outline-none text-slate-800 resize-none min-h-[60px]"
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
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879

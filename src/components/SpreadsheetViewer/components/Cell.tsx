import React, { useState, useEffect, useCallback } from 'react';
import { CellUIStyles } from '../utils/styleCalculator';

interface CellProps {
  r: number;
  c: number;
  value: string;
  uiStyles: CellUIStyles;
  mode: 'user' | 'admin';
  isEditable: boolean;
  isSelected?: boolean;
  onCellEdit?: (r: number, c: number, newValue: string) => void;
  onMouseDown?: (r: number, c: number) => void;
  onMouseEnter?: (r: number, c: number) => void;
}

export const Cell = React.memo(({
  r, c, value, uiStyles, mode, isEditable, isSelected = false,
  onCellEdit, onMouseDown, onMouseEnter
}: CellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  // Sync internal state if external value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (uiStyles.shouldSkip) return null;

  const handleDoubleClick = useCallback(() => {
    if (mode === 'user' && isEditable) {
      setIsEditing(true);
      setEditValue(value);
    }
  }, [mode, isEditable, value]);

  const handleSave = useCallback(() => {
    if (editValue !== value && onCellEdit) {
      onCellEdit(r, c, editValue);
    }
    setIsEditing(false);
  }, [editValue, value, onCellEdit, r, c]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value);
    }
  }, [handleSave, value]);

  // Selection border styling
  const selectionBorder = isSelected
    ? 'ring-2 ring-primary ring-inset'
    : '';

  const cursorClass = mode === 'admin'
    ? 'cursor-crosshair'
    : isEditable
      ? 'cursor-text'
      : 'cursor-not-allowed';

  return (
    <td
      className={`
        relative
        border border-border
        p-2
        ${cursorClass}
        ${selectionBorder}
        ${uiStyles.shouldTruncate ? 'truncate' : ''}
        ${isEditable && !isEditing ? 'hover:bg-primary/5' : ''}
        transition-colors duration-100
      `}
      style={uiStyles.finalTdStyle}
      title={value}
      rowSpan={uiStyles.mergeInfo && 'rowSpan' in uiStyles.mergeInfo ? uiStyles.mergeInfo.rowSpan : undefined}
      colSpan={uiStyles.mergeInfo && 'colSpan' in uiStyles.mergeInfo ? uiStyles.mergeInfo.colSpan : undefined}
      onMouseDown={() => onMouseDown && onMouseDown(r, c)}
      onMouseEnter={() => onMouseEnter && onMouseEnter(r, c)}
      onDoubleClick={handleDoubleClick}
    >
      {/* Selection resize handle indicator */}
      {isSelected && (
        <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize">
          <svg
            className="w-full h-full text-primary opacity-60"
            viewBox="0 0 10 10"
            fill="none"
          >
            <path
              d="M8.5 1L1 8.5M8.5 4L4 8.5M8.5 7L7 8.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {isEditing ? (
        <textarea
          autoFocus
          className="
            absolute inset-0 w-full h-full p-1
            bg-surface-container-lowest
            border-2 border-primary rounded
            shadow-md
            focus:outline-none focus:ring-2 focus:ring-primary/20
            text-on-surface font-sans
            resize-none
            z-10
          "
          style={{ minHeight: '60px' }}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <span style={uiStyles.spanStyle} className="block truncate">
          {value}
        </span>
      )}
    </td>
  );
});
Cell.displayName = 'Cell';

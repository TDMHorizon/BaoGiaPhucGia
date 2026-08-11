import React, { useState, useEffect } from 'react';
import { CellUIStyles } from '../utils/styleCalculator';
import { SpreadsheetCellProps } from '../types/spreadsheet';

/**
 * Cell - Cell component for spreadsheet
 *
 * Matches Stitch design:
 * - Border: #E2E8F0
 * - Edit mode: border-2 border-[#004ac6]
 * - Selection: border-2 border-primary
 */
export const Cell = React.memo(function Cell({
  r,
  c,
  value,
  uiStyles,
  mode,
  isEditable,
  onCellEdit,
  onMouseDown,
  onMouseEnter
}: SpreadsheetCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));

  // Sync internal state if external value changes
  useEffect(() => {
    setEditValue(String(value ?? ''));
  }, [value]);

  if (uiStyles.shouldSkip) return null;

  const handleDoubleClick = () => {
    if (mode === 'user' && isEditable) {
      setIsEditing(true);
      setEditValue(String(value ?? ''));
    }
  };

  const handleSave = () => {
    if (editValue !== String(value) && onCellEdit) {
      onCellEdit(r, c, editValue);
    }
    setIsEditing(false);
  };

  const baseClassName = `relative ${uiStyles.shouldTruncate ? 'truncate' : ''}`;

  const cursorClassName = mode === 'admin'
    ? 'cursor-crosshair'
    : isEditable
      ? 'cursor-text hover:outline hover:outline-2 hover:outline-[#004ac6] hover:-outline-offset-1'
      : 'cursor-not-allowed';

  return (
    <td
      className={`${baseClassName} ${cursorClassName}`}
      style={{
        ...uiStyles.finalTdStyle,
        borderRight: '1px solid #E2E8F0',
        borderBottom: '1px solid #E2E8F0'
      }}
      title={String(value ?? '')}
      rowSpan={uiStyles.mergeInfo && 'rowSpan' in uiStyles.mergeInfo ? uiStyles.mergeInfo.rowSpan : undefined}
      colSpan={uiStyles.mergeInfo && 'colSpan' in uiStyles.mergeInfo ? uiStyles.mergeInfo.colSpan : undefined}
      onMouseDown={() => onMouseDown?.(r, c)}
      onMouseEnter={() => onMouseEnter?.(r, c)}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <textarea
          autoFocus
          className="absolute inset-0 w-full h-full p-1 border-2 border-[#004ac6] rounded bg-white shadow-inner focus:outline-none text-[#191b23] resize-none"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            } else if (e.key === "Escape") {
              setIsEditing(false);
              setEditValue(String(value ?? ''));
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

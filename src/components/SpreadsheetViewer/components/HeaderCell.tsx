import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

interface HeaderCellProps {
  colIndex: number;
  colWidth: number;
  isSelected: boolean;
  frozenCols?: number;
  frozenWidth?: number;
  onColumnClick: (colIndex: number) => void;
  onColumnResize?: (colIndex: number, width: number) => void;
  onColumnAutoFit?: (colIndex: number) => void;
}

export const HeaderCell = React.memo(({
  colIndex, colWidth, isSelected, frozenCols = 0, frozenWidth = 0,
  onColumnClick, onColumnResize, onColumnAutoFit
}: HeaderCellProps) => {
  const colLetter = XLSX.utils.encode_col(colIndex);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Cleanup resize listeners on unmount
  useEffect(() => {
    return () => {
      setIsResizing(false);
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onColumnResize) return;
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startWidthRef.current = colWidth;
    setIsResizing(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(40, startWidthRef.current + delta);
      onColumnResize(colIndex, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [colIndex, colWidth, onColumnResize]);

  const handleDoubleClick = useCallback(() => {
    onColumnAutoFit?.(colIndex);
  }, [colIndex, onColumnAutoFit]);

  const isFrozen = frozenCols > 0 && colIndex < frozenCols;

  return (
    <th
      className={cn(
        'relative px-3 py-2.5',
        'text-center text-label-sm font-semibold uppercase tracking-wider',
        'cursor-pointer select-none transition-all duration-150',
        'border-b-2 border-r border-l-0 border-t-0 border-r-border',
        isFrozen && 'sticky bg-surface-container-lowest',
        !isFrozen && 'bg-surface-container-high',
        isSelected
          ? 'bg-primary text-primary-foreground border-b-primary'
          : 'text-on-surface hover:bg-surface-container-highest hover:text-primary',
        isResizing && 'select-none'
      )}
      style={{
        width: `${colWidth}px`,
        minWidth: `${colWidth}px`,
        maxWidth: `${colWidth}px`,
        left: isFrozen ? `${frozenWidth}px` : undefined,
        zIndex: isFrozen ? 30 : 10,
      }}
      onClick={() => onColumnClick(colIndex)}
      onDoubleClick={handleDoubleClick}
    >
      {colLetter}
      {onColumnResize && (
        <div
          className={`
            absolute right-0 top-0 bottom-0 w-2 cursor-col-resize
            hover:bg-primary/20 active:bg-primary/30
            ${isResizing ? 'bg-primary/30' : ''}
          `}
          onMouseDown={handleMouseDown}
        />
      )}
    </th>
  );
});
HeaderCell.displayName = 'HeaderCell';

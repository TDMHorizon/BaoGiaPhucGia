import React from 'react';
import * as XLSX from 'xlsx';

interface HeaderCellProps {
  colIndex: number;
  colWidth: number;
  isSelected: boolean;
  onColumnClick: (colIndex: number) => void;
}

export const HeaderCell = React.memo(({ colIndex, colWidth, isSelected, onColumnClick }: HeaderCellProps) => {
  const colLetter = XLSX.utils.encode_col(colIndex);

  return (
    <th
      className={`
        sticky top-0 z-10
        px-3 py-2.5
        text-center text-label-sm font-semibold uppercase tracking-wider
        cursor-pointer select-none
        transition-all duration-150
        border-b-2 border-r border-l-0 border-t-0 border-r-border
        ${isSelected
          ? 'bg-primary text-primary-foreground border-b-primary'
          : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest hover:text-primary'
        }
      `}
      style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px` }}
      onClick={() => onColumnClick(colIndex)}
    >
      {colLetter}
    </th>
  );
});
HeaderCell.displayName = 'HeaderCell';

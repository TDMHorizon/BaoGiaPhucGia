import React from 'react';
import * as XLSX from 'xlsx';
import { ColumnHeaderProps } from '../types/spreadsheet';

/**
 * ColumnHeader - Column header component for spreadsheet
 *
 * Matches Stitch design:
 * - Background: #F8FAFC
 * - Color: #475569
 * - Font: 12px/500 (label-sm)
 * - Selected: primary background (#004ac6)
 */
export const HeaderCell = React.memo(function HeaderCell({
  colIndex,
  colWidth,
  isSelected,
  onColumnClick
}: ColumnHeaderProps) {
  const colLetter = XLSX.utils.encode_col(colIndex);

  return (
    <th
      className={`
        p-2.5 text-center cursor-pointer font-medium text-xs
        transition-colors select-none sticky top-0 z-10
        border-r border-b border-[#cbd5e1]
        ${isSelected
          ? 'bg-[#004ac6] text-white hover:bg-[#003db3]'
          : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9]'
        }
      `}
      style={{
        width: `${colWidth}px`,
        minWidth: `${colWidth}px`,
        maxWidth: `${colWidth}px`
      }}
      onClick={() => onColumnClick(colIndex)}
    >
      {colLetter}
    </th>
  );
});

HeaderCell.displayName = 'HeaderCell';

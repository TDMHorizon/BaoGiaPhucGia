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
      className={`border border-slate-300 p-2.5 text-center cursor-pointer font-extrabold text-xs tracking-wider transition-colors select-none sticky top-0 z-10 ${isSelected
        ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
        : 'bg-slate-200 text-slate-700 hover:text-indigo-700 hover:bg-indigo-50'
        }`}
      style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px` }}
      onClick={() => onColumnClick(colIndex)}
    >
      {colLetter}
    </th>
  );
});
HeaderCell.displayName = 'HeaderCell';

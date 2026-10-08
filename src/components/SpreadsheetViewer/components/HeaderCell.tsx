import React from 'react';
import * as XLSX from 'xlsx';

interface HeaderCellProps {
  colIndex: number;
  colWidth: number;
  isSelected: boolean;
  isDisabled?: boolean;
  onColumnClick: (colIndex: number) => void;
}

export const HeaderCell = React.memo(({ colIndex, colWidth, isSelected, isDisabled = false, onColumnClick }: HeaderCellProps) => {
  const colLetter = XLSX.utils.encode_col(colIndex);

  const headerClass = isDisabled
    ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-800'
    : isSelected
      ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
      : 'bg-slate-200 text-slate-700 hover:text-indigo-700 hover:bg-indigo-50';

  return (
    <th
      className={`border border-slate-300 p-2.5 text-center cursor-pointer font-extrabold text-xs tracking-wider transition-colors select-none sticky top-0 z-10 ${headerClass}`}
      style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px` }}
      title={isDisabled ? `Cột ${colLetter} đã bị Admin vô hiệu hóa` : `Cột ${colLetter}`}
      onClick={() => onColumnClick(colIndex)}
    >
      <div className="flex items-center justify-center gap-1">
        {isDisabled && (
          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
        <span>{colLetter}</span>
      </div>
    </th>
  );
});
HeaderCell.displayName = 'HeaderCell';

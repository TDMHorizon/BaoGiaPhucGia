import React from 'react';

interface CornerHeaderProps {
  rowHeaderWidth?: number;
}

export const CornerHeader = React.memo(({ rowHeaderWidth = 48 }: CornerHeaderProps) => {
  return (
    <th
      className="
        sticky top-0 left-0 z-20
        w-12 min-w-12 max-w-12 h-10
        bg-surface-container-lowest
        border-b-2 border-r border-border
      "
      style={{ width: `${rowHeaderWidth}px`, minWidth: `${rowHeaderWidth}px`, maxWidth: `${rowHeaderWidth}px` }}
    >
      <span className="sr-only">Corner (Row/Column Headers)</span>
    </th>
  );
});
CornerHeader.displayName = 'CornerHeader';

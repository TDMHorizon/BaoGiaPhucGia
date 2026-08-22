import React from 'react';

interface CornerHeaderProps {
  rowHeaderWidth?: number;
  frozenHeight?: number;
  frozenWidth?: number;
}

export const CornerHeader = React.memo(({
  rowHeaderWidth = 48,
  frozenHeight = 0,
  frozenWidth = 0
}: CornerHeaderProps) => {
  return (
    <th
      className="bg-surface-container-lowest border-b-2 border-r border-border"
      style={{
        width: `${rowHeaderWidth}px`,
        minWidth: `${rowHeaderWidth}px`,
        maxWidth: `${rowHeaderWidth}px`,
        height: frozenHeight > 0 ? `${frozenHeight}px` : undefined,
        position: frozenHeight > 0 || frozenWidth > 0 ? 'sticky' : undefined,
        left: frozenWidth > 0 ? `${frozenWidth}px` : 0,
        top: frozenHeight > 0 ? `${frozenHeight}px` : 0,
        zIndex: 40,
      }}
    >
      <span className="sr-only">Corner (Row/Column Headers)</span>
    </th>
  );
});
CornerHeader.displayName = 'CornerHeader';

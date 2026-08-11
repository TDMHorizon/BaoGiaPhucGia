import React from 'react';
import { Sigma } from 'lucide-react';
import { FormulaBarProps } from '../types/spreadsheet';

/**
 * FormulaBar - Formula bar component for SpreadsheetViewer
 *
 * Matches Stitch design:
 * - Cell reference display (e.g., "C5")
 * - fx icon (Sigma)
 * - Formula/value input
 */
export const FormulaBar = React.memo(function FormulaBar({
  cellReference,
  value,
  onChange,
  editable = true
}: FormulaBarProps) {
  return (
    <div className="h-10 border-b border-[#E2E8F0] flex items-center px-6 shrink-0 gap-2 bg-[#f3f3fe]">
      {/* Cell Reference */}
      <div className="w-16 text-center border border-[#E2E8F0] bg-[#F8FAFC] rounded text-xs font-medium text-[#565e74] px-2 py-1">
        {cellReference || 'A1'}
      </div>

      {/* fx Icon */}
      <div className="text-[#565e74]">
        <Sigma className="w-[18px] h-[18px]" />
      </div>

      {/* Formula Input */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={!editable}
        className="flex-1 border-none focus:ring-0 px-2 py-1 text-sm text-[#191b23] bg-transparent outline-none disabled:bg-transparent disabled:cursor-default"
        placeholder="Enter value or formula..."
      />
    </div>
  );
});

export default FormulaBar;

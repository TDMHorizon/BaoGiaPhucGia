import React from 'react';
import { Eye, Download, Copy, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolbarProps } from '../types/spreadsheet';

/**
 * SpreadsheetToolbar - Toolbar component for SpreadsheetViewer
 *
 * Matches Stitch design with:
 * - File name input (editable)
 * - Action buttons: Preview, Download, Save as New Version, Save
 */
export const SpreadsheetToolbar = React.memo(function SpreadsheetToolbar({
  fileName,
  onFileNameChange,
  onPreview,
  onDownload,
  onSaveAsNew,
  onSave
}: ToolbarProps) {
  return (
    <div className="h-14 border-b border-[#E2E8F0] flex items-center justify-between px-6 shrink-0 bg-[#faf8ff]">
      {/* Left: File name */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-[#565e74]">
          Đang chỉnh sửa:
        </span>
        <input
          type="text"
          value={fileName}
          onChange={(e) => onFileNameChange?.(e.target.value)}
          className={cn(
            "w-64 border border-transparent hover:border-[#E2E8F0] focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6]",
            "rounded px-2 py-1 text-sm font-semibold text-[#191b23] bg-transparent transition-all",
            "outline-none"
          )}
        />
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-2">
        <ToolbarButton onClick={onPreview} icon={<Eye className="w-[18px] h-[18px]" />}>
          Preview
        </ToolbarButton>

        <ToolbarButton onClick={onDownload} icon={<Download className="w-[18px] h-[18px]" />}>
          Download
        </ToolbarButton>

        <ToolbarButton onClick={onSaveAsNew} icon={<Copy className="w-[18px] h-[18px]" />}>
          Save as New Version
        </ToolbarButton>

        <ToolbarButton
          onClick={onSave}
          icon={<Save className="w-[18px] h-[18px]" />}
          variant="primary"
        >
          Save
        </ToolbarButton>
      </div>
    </div>
  );
});

interface ToolbarButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'primary';
  disabled?: boolean;
}

const ToolbarButton = React.memo(function ToolbarButton({
  children,
  onClick,
  icon,
  variant = 'default',
  disabled = false
}: ToolbarButtonProps) {
  const baseClasses = "flex items-center gap-2 px-3 py-1.5 rounded text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = variant === 'primary'
    ? "bg-[#2563eb] text-white hover:opacity-90"
    : "border border-[#E2E8F0] text-[#191b23] hover:bg-[#F1F5F9]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(baseClasses, variantClasses)}
    >
      {icon}
      {children}
    </button>
  );
});

export default SpreadsheetToolbar;

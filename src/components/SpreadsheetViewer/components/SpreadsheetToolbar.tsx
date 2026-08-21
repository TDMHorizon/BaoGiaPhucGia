"use client";

import React, { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { cn } from "@/lib/utils";
import {
  Eye,
  Download,
  Save,
  Plus,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";

interface SpreadsheetToolbarProps {
  /** File name (editable) */
  fileName: string;
  /** Callback when file name changes */
  onFileNameChange?: (name: string) => void;
  /** Preview button click */
  onPreview?: () => void;
  /** Download button click */
  onDownload?: () => void;
  /** Save as new version button click */
  onSaveVersion?: () => void;
  /** Regular save button click */
  onSave?: () => void;
  /** Loading states */
  isLoading?: {
    preview?: boolean;
    download?: boolean;
    saveVersion?: boolean;
    save?: boolean;
  };
  /** Disabled states */
  disabled?: {
    preview?: boolean;
    download?: boolean;
    saveVersion?: boolean;
    save?: boolean;
  };
  /** Show/hide specific buttons */
  showButtons?: {
    preview?: boolean;
    download?: boolean;
    saveVersion?: boolean;
    save?: boolean;
  };
  /** Additional class name */
  className?: string;
}

export function SpreadsheetToolbar({
  fileName,
  onFileNameChange,
  onPreview,
  onDownload,
  onSaveVersion,
  onSave,
  isLoading = {},
  disabled = {},
  showButtons = {
    preview: true,
    download: true,
    saveVersion: true,
    save: true,
  },
  className,
}: SpreadsheetToolbarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(fileName);

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (editedName.trim() !== fileName) {
      onFileNameChange?.(editedName.trim());
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSubmit();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
      setEditedName(fileName);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "bg-surface-container border-b border-outline",
        "px-4 py-2",
        "gap-4",
        className
      )}
    >
      {/* Left Section: File Name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />

        {isEditingName ? (
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            autoFocus
            className="h-8 text-sm font-semibold max-w-[300px]"
          />
        ) : (
          <button
            onClick={() => {
              setEditedName(fileName);
              setIsEditingName(true);
            }}
            className={cn(
              "text-sm font-semibold text-on-surface",
              "hover:text-primary transition-colors",
              "truncate max-w-[300px]",
              "text-left"
            )}
            title="Click to edit"
          >
            {fileName || "Untitled"}
          </button>
        )}
      </div>

      {/* Center Section: Status Indicators */}
      <div className="hidden md:flex items-center gap-2 text-xs text-on-surface-variant">
        {/* Placeholder for future status indicators */}
      </div>

      {/* Right Section: Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {showButtons.preview && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            disabled={disabled.preview || isLoading.preview}
            className="gap-1.5"
          >
            {isLoading.preview ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Xem trước</span>
          </Button>
        )}

        {showButtons.download && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={disabled.download || isLoading.download}
            className="gap-1.5"
          >
            {isLoading.download ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Tải Excel</span>
          </Button>
        )}

        {showButtons.saveVersion && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveVersion}
            disabled={disabled.saveVersion || isLoading.saveVersion}
            className="gap-1.5"
          >
            {isLoading.saveVersion ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Lưu phiên bản mới</span>
          </Button>
        )}

        {showButtons.save && (
          <Button
            size="sm"
            onClick={onSave}
            disabled={disabled.save || isLoading.save}
            className="gap-1.5 bg-primary hover:bg-primary/90"
          >
            {isLoading.save ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Lưu</span>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact toolbar for smaller viewports
 */
export function SpreadsheetToolbarCompact({
  onDownload,
  onSave,
  isLoading = {},
  className,
}: {
  onDownload?: () => void;
  onSave?: () => void;
  isLoading?: { download?: boolean; save?: boolean };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end",
        "bg-surface-container border-b border-outline",
        "px-3 py-1.5",
        "gap-2",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onDownload}
        disabled={isLoading.download}
        title="Tải Excel"
      >
        {isLoading.download ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </Button>

      <Button
        size="icon-sm"
        onClick={onSave}
        disabled={isLoading.save}
        className="bg-primary hover:bg-primary/90"
        title="Lưu"
      >
        {isLoading.save ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}

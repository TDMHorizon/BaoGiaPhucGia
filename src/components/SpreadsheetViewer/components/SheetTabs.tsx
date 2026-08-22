"use client";

import React, { useState, useRef } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { cn } from "@/lib/utils";
import { Plus, X, Check, Edit2 } from "lucide-react";

interface SheetTab {
  /** Sheet name */
  name: string;
  /** Is active */
  isActive?: boolean;
  /** Has unsaved changes */
  isDirty?: boolean;
  /** Is readonly */
  isReadonly?: boolean;
}

interface SheetTabsProps {
  /** List of sheets */
  sheets: SheetTab[];
  /** Currently active sheet */
  activeSheet?: string;
  /** Callback when sheet is clicked */
  onSheetClick?: (sheetName: string) => void;
  /** Callback when new sheet is created */
  onAddSheet?: () => void;
  /** Callback when sheet is renamed */
  onRenameSheet?: (oldName: string, newName: string) => void;
  /** Callback when sheet is deleted */
  onDeleteSheet?: (sheetName: string) => void;
  /** Can add new sheets */
  canAdd?: boolean;
  /** Can delete sheets */
  canDelete?: boolean;
  /** Can rename sheets */
  canRename?: boolean;
  /** Maximum number of sheets allowed */
  maxSheets?: number;
  /** Additional class name */
  className?: string;
}

export function SheetTabs({
  sheets,
  activeSheet,
  onSheetClick,
  onAddSheet,
  onRenameSheet,
  onDeleteSheet,
  canAdd = true,
  canDelete = false,
  canRename = false,
  maxSheets = 20,
  className,
}: SheetTabsProps) {
  const [editingSheet, setEditingSheet] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRenameStart = (sheet: SheetTab) => {
    if (!canRename) return;
    setEditingSheet(sheet.name);
    setEditedName(sheet.name);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleRenameSubmit = (oldName: string) => {
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== oldName) {
      onRenameSheet?.(oldName, trimmed);
    }
    setEditingSheet(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, oldName: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit(oldName);
    } else if (e.key === "Escape") {
      setEditingSheet(null);
    }
  };

  const handleDelete = (e: React.MouseEvent, sheetName: string) => {
    e.stopPropagation();
    if (sheets.length <= 1) {
      return; // Don't delete last sheet
    }
    onDeleteSheet?.(sheetName);
  };

  const canAddMore = canAdd && sheets.length < maxSheets;

  return (
    <div
      className={cn(
        "flex items-end gap-1",
        "bg-surface border-b border-outline",
        "px-2 pt-2 pb-0",
        "overflow-x-auto",
        "custom-scrollbar",
        className
      )}
    >
      {/* Sheet Tabs */}
      {sheets.map((sheet) => {
        const isActive = activeSheet === sheet.name;
        const isEditing = editingSheet === sheet.name;

        return (
          <div
            key={sheet.name}
            className={cn(
              "relative group",
              "flex items-center gap-1",
              "min-w-[80px] max-w-[200px]"
            )}
          >
            {/* Tab Button */}
            <button
              onClick={() => !isEditing && onSheetClick?.(sheet.name)}
              className={cn(
                "relative px-4 py-2",
                "text-sm font-semibold",
                "rounded-t-lg border border-b-0",
                "transition-all duration-150",
                "truncate max-w-[150px]",
                isActive
                  ? [
                      "bg-background text-primary",
                      "border-outline z-10",
                      "shadow-sm",
                      // Active indicator
                      "after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[2px]",
                      "after:bg-background",
                    ]
                  : [
                      "bg-surface-container text-on-surface-variant",
                      "border-transparent",
                      "hover:bg-surface-container-high hover:text-on-surface",
                    ],
                sheet.isDirty && !isActive && "after:absolute after:top-2 after:right-2",
                "after:w-1.5 after:h-1.5 after:rounded-full after:bg-warning"
              )}
            >
              {isEditing ? (
                <Input
                  ref={inputRef}
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={() => handleRenameSubmit(sheet.name)}
                  onKeyDown={(e) => handleRenameKeyDown(e, sheet.name)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 w-full text-xs py-0 px-1"
                />
              ) : (
                <span className="flex items-center gap-1">
                  {sheet.name}
                  {sheet.isDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  )}
                </span>
              )}
            </button>

            {/* Action Buttons - visible on hover, respect permissions */}
            {(canRename || canDelete) && (
              <div
                className={cn(
                  "flex items-center gap-0.5",
                  "opacity-0 group-hover:opacity-100 transition-opacity"
                )}
              >
                {canRename && !isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameStart(sheet);
                    }}
                    className={cn(
                      "p-0.5 rounded",
                      "text-on-surface-variant hover:text-on-surface",
                      "hover:bg-surface-container-high"
                    )}
                    title="Rename"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}

                {canDelete && sheets.length > 1 && (
                  <button
                    onClick={(e) => handleDelete(e, sheet.name)}
                    className={cn(
                      "p-0.5 rounded",
                      "text-on-surface-variant hover:text-error",
                      "hover:bg-error-container"
                    )}
                    title="Delete"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Sheet Button */}
      {canAddMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddSheet}
          className={cn(
            "h-9 px-3",
            "text-sm font-medium",
            "rounded-t-lg border border-b-0 border-transparent",
            "text-on-surface-variant hover:text-on-surface",
            "hover:bg-surface-container-high"
          )}
        >
          <Plus className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">Thêm sheet</span>
        </Button>
      )}
    </div>
  );
}

/**
 * Simple horizontal scrollable tabs for compact views
 */
export function SheetTabsCompact({
  sheets,
  activeSheet,
  onSheetClick,
  className,
}: {
  sheets: { name: string }[];
  activeSheet?: string;
  onSheetClick?: (sheetName: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1",
        "bg-surface-container border-b border-outline",
        "px-1 py-1",
        "overflow-x-auto",
        "custom-scrollbar",
        className
      )}
    >
      {sheets.map((sheet) => {
        const isActive = activeSheet === sheet.name;

        return (
          <button
            key={sheet.name}
            onClick={() => onSheetClick?.(sheet.name)}
            className={cn(
              "px-3 py-1.5",
              "text-xs font-medium",
              "rounded-md",
              "truncate max-w-[100px]",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            )}
          >
            {sheet.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Dropdown variant for mobile/small screens
 */
export function SheetTabsDropdown({
  sheets,
  activeSheet,
  onSheetClick,
  className,
}: {
  sheets: { name: string }[];
  activeSheet?: string;
  onSheetClick?: (sheetName: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        <span className="truncate">
          {activeSheet || "Select Sheet"}
        </span>
        <span className="ml-2">▼</span>
      </Button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full left-0 right-0 z-50",
            "mt-1 py-1",
            "bg-surface border border-outline",
            "rounded-lg shadow-lg",
            "max-h-[200px] overflow-y-auto",
            "custom-scrollbar"
          )}
        >
          {sheets.map((sheet) => (
            <button
              key={sheet.name}
              onClick={() => {
                onSheetClick?.(sheet.name);
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 text-left",
                "text-sm",
                "hover:bg-surface-container-high",
                activeSheet === sheet.name && [
                  "bg-primary-container text-primary-container-foreground",
                  "font-semibold",
                ]
              )}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

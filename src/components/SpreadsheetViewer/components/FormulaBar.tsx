"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { cn } from "@/lib/utils";
import { Sigma } from "lucide-react";

interface FormulaBarProps {
  /** Currently selected cell reference (e.g., "A1") */
  cellReference?: string;
  /** Current cell value or formula */
  value?: string;
  /** Whether the cell is in edit mode */
  isEditing?: boolean;
  /** Callback when value changes */
  onValueChange?: (value: string) => void;
  /** Callback when editing starts */
  onEditStart?: () => void;
  /** Callback when editing ends */
  onEditEnd?: () => void;
  /** Function button click */
  onFunctionClick?: () => void;
  /** Is readonly mode */
  readonly?: boolean;
  /** Additional class name */
  className?: string;
}

export function FormulaBar({
  cellReference = "A1",
  value = "",
  isEditing = false,
  onValueChange,
  onEditStart,
  onEditEnd,
  onFunctionClick,
  readonly = false,
  className,
}: FormulaBarProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal value when external value changes
  useEffect(() => {
    if (!isFocused) {
      setInternalValue(value);
    }
  }, [value, isFocused]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      onValueChange?.(newValue);
    },
    [onValueChange]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onEditStart?.();
  }, [onEditStart]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onEditEnd?.();
  }, [onEditEnd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        inputRef.current?.blur();
        onEditEnd?.();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setInternalValue(value);
        inputRef.current?.blur();
        onEditEnd?.();
      }
    },
    [onEditEnd, value]
  );

  // Check if value starts with formula indicator (=)
  const isFormula = value.startsWith("=") || value.startsWith("+");

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        "bg-surface-container border-b border-outline",
        "px-3 py-2",
        "min-h-[44px]",
        className
      )}
    >
      {/* Function Button */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onFunctionClick}
        disabled={readonly}
        className={cn(
          "shrink-0",
          isFormula && "text-primary"
        )}
        title="Insert Function"
      >
        <Sigma className="w-4 h-4" />
      </Button>

      {/* Cell Reference Display */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-16 h-8 px-2",
          "bg-surface-container-high border border-outline",
          "rounded-md",
          "text-sm font-mono font-semibold text-on-surface",
          "shrink-0"
        )}
        title="Cell Reference"
      >
        {cellReference}
      </div>

      {/* Function Indicator */}
      <div
        className={cn(
          "w-px h-6 bg-outline",
          "shrink-0"
        )}
      />

      {/* Formula/Value Input */}
      <div className="flex-1 min-w-0">
        {readonly ? (
          <div
            className={cn(
              "flex items-center h-8 px-2",
              "bg-surface-container-low border border-outline",
              "rounded-md",
              "text-sm text-on-surface truncate",
              "font-mono"
            )}
            title={value}
          >
            {value || <span className="text-on-surface-variant italic">Empty</span>}
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={internalValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={isFormula ? "Enter formula..." : "Enter value..."}
            className={cn(
              "w-full h-8 px-2",
              "bg-surface border border-outline",
              "rounded-md",
              "text-sm text-on-surface",
              "font-mono",
              "outline-none transition-colors",
              "placeholder:text-on-surface-variant placeholder:font-sans",
              isFocused && "border-ring ring-2 ring-ring/20",
              "focus:border-primary focus:ring-2 focus:ring-primary/20"
            )}
          />
        )}
      </div>

      {/* Formula Indicator Badge */}
      {isFormula && (
        <div
          className={cn(
            "shrink-0",
            "px-2 py-0.5",
            "bg-primary-container text-primary-container-foreground",
            "text-xs font-semibold rounded",
            "hidden sm:flex items-center"
          )}
        >
          fx
        </div>
      )}
    </div>
  );
}

/**
 * Compact formula bar for smaller viewports
 * Shows only cell reference and a simple input
 */
export function FormulaBarCompact({
  cellReference = "A1",
  value = "",
  readonly = false,
  className,
}: {
  cellReference?: string;
  value?: string;
  readonly?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        "bg-surface-container border-b border-outline",
        "px-2 py-1.5",
        "min-h-[36px]",
        className
      )}
    >
      {/* Cell Reference */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-12 h-6 px-1.5",
          "bg-surface-container-high border border-outline",
          "rounded text-xs font-mono font-semibold text-on-surface",
          "shrink-0"
        )}
      >
        {cellReference}
      </div>

      {/* Value */}
      <div
        className={cn(
          "flex-1 min-w-0",
          "px-2 py-1",
          "bg-surface-container-low border border-outline",
          "rounded text-xs font-mono text-on-surface truncate",
          readonly && "bg-muted"
        )}
        title={value}
      >
        {value || <span className="text-on-surface-variant">—</span>}
      </div>
    </div>
  );
}

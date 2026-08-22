"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "../../ui/button";
import { cn } from "@/lib/utils";
import { Sigma } from "lucide-react";
import { EXCEL_FUNCTIONS } from "../utils/formulaParser";

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

interface AutocompleteSuggestion {
  text: string;
  description: string;
  type: 'function' | 'cell' | 'range';
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Sync internal value when external value changes
  useEffect(() => {
    if (!isFocused) {
      setInternalValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isFocused]);

  // Compute suggestions based on current input
  const suggestions = useMemo((): AutocompleteSuggestion[] => {
    if (!isFocused || !showSuggestions) return [];

    const beforeCursor = internalValue.slice(0, cursorPosition);

    // Check if typing a function name
    const funcMatch = beforeCursor.match(/([A-Z]+)$/i);
    if (funcMatch) {
      const prefix = funcMatch[1].toUpperCase();
      return EXCEL_FUNCTIONS
        .filter(fn => fn.startsWith(prefix))
        .slice(0, 10)
        .map(fn => ({
          text: fn + '(',
          description: getFunctionDescription(fn),
          type: 'function' as const,
        }));
    }

    return [];
  }, [internalValue, cursorPosition, isFocused, showSuggestions]);

  // Show suggestions when typing
  useEffect(() => {
    if (isFocused && suggestions.length > 0) {
      setShowSuggestions(true);
      setSelectedSuggestion(0);
    }
  }, [suggestions.length, isFocused]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      onValueChange?.(newValue);

      // Track cursor position
      if (inputRef.current) {
        setCursorPosition(inputRef.current.selectionStart || 0);
      }
    },
    [onValueChange]
  );

  // Track cursor position on selection change
  const handleSelect = useCallback((e: React.SyntheticEvent<HTMLInputElement>) => {
    setCursorPosition(e.currentTarget.selectionStart || 0);
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onEditStart?.();
  }, [onEditStart]);

  const handleBlur = useCallback(() => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setShowSuggestions(false);
      setIsFocused(false);
      onEditEnd?.();
    }, 150);
  }, [onEditEnd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showSuggestions && suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedSuggestion((prev) => Math.max(prev - 1, 0));
          return;
        }
        if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
          e.preventDefault();
          if (suggestions[selectedSuggestion]) {
            applySuggestion(suggestions[selectedSuggestion]);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowSuggestions(false);
          return;
        }
      }

      if (e.key === "Enter") {
        e.preventDefault();
        setShowSuggestions(false);
        inputRef.current?.blur();
        onEditEnd?.();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowSuggestions(false);
        setInternalValue(value); // Reset về external value khi escape
        inputRef.current?.blur();
        onEditEnd?.();
      }
    },
    [onEditEnd, value, suggestions, selectedSuggestion, showSuggestions]
  );

  const applySuggestion = useCallback((suggestion: AutocompleteSuggestion) => {
    const beforeCursor = internalValue.slice(0, cursorPosition);
    const afterCursor = internalValue.slice(cursorPosition);

    // Find the partial function name to replace
    const funcMatch = beforeCursor.match(/([A-Z]+)$/i);
    let newValue: string;
    let newCursorPos: number;

    if (funcMatch) {
      // Replace partial function name
      const startPos = cursorPosition - funcMatch[1].length;
      newCursorPos = startPos + suggestion.text.length;
      newValue = internalValue.slice(0, startPos) + suggestion.text + afterCursor;
    } else {
      // Insert at cursor
      newCursorPos = cursorPosition + suggestion.text.length;
      newValue = beforeCursor + suggestion.text + afterCursor;
    }

    setInternalValue(newValue);
    onValueChange?.(newValue);
    setShowSuggestions(false);

    // Move cursor after the inserted text
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [internalValue, cursorPosition, onValueChange]);

  // Check if value starts with formula indicator (not a negative number)
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
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={internalValue}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onSelect={handleSelect}
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

            {/* Autocomplete Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className={cn(
                  "absolute top-full left-0 right-0 z-50",
                  "mt-1 py-1",
                  "bg-surface-container-lowest border border-outline",
                  "rounded-md shadow-lg",
                  "max-h-48 overflow-y-auto"
                )}
              >
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.text}
                    className={cn(
                      "px-3 py-1.5 cursor-pointer",
                      "flex items-center gap-2",
                      "text-sm",
                      index === selectedSuggestion
                        ? "bg-primary/10 text-primary"
                        : "text-on-surface hover:bg-surface-container-high"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur before click
                      applySuggestion(suggestion);
                    }}
                    onMouseEnter={() => setSelectedSuggestion(index)}
                  >
                    <span className="font-mono font-medium">{suggestion.text}</span>
                    <span className="text-xs text-on-surface-variant truncate">
                      {suggestion.description}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
 * Get description for Excel function
 */
function getFunctionDescription(fnName: string): string {
  const descriptions: Record<string, string> = {
    SUM: 'Adds numbers',
    AVERAGE: 'Returns average of arguments',
    COUNT: 'Counts numeric values',
    COUNTA: 'Counts non-empty cells',
    MAX: 'Returns largest value',
    MIN: 'Returns smallest value',
    ABS: 'Returns absolute value',
    ROUND: 'Rounds to specified digits',
    ROUNDUP: 'Rounds up',
    ROUNDDOWN: 'Rounds down',
    SUMIF: 'Sums with condition',
    COUNTIF: 'Counts with condition',
    AVERAGEIF: 'Averages with condition',
    CONCATENATE: 'Joins text',
    CONCAT: 'Joins text (new)',
    LEFT: 'Extracts from left',
    RIGHT: 'Extracts from right',
    MID: 'Extracts from middle',
    LEN: 'Returns length',
    UPPER: 'Converts to uppercase',
    LOWER: 'Converts to lowercase',
    TRIM: 'Removes spaces',
    SUBSTITUTE: 'Replaces text',
    IF: 'Conditional logic',
    IFERROR: 'Handles errors',
    IFNA: 'Handles #N/A',
    AND: 'Logical AND',
    OR: 'Logical OR',
    NOT: 'Logical NOT',
    VLOOKUP: 'Vertical lookup',
    HLOOKUP: 'Horizontal lookup',
    INDEX: 'Returns value by position',
    MATCH: 'Finds position',
    TODAY: "Returns today's date",
    NOW: 'Returns current date/time',
  };
  return descriptions[fnName.toUpperCase()] || '';
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

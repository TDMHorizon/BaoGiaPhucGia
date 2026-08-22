"use client";

import React, { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

export interface SearchInputProps {
  /** Current value */
  value?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Input disabled state */
  disabled?: boolean;
  /** Input size */
  size?: "sm" | "md" | "lg";
  /** Additional classes */
  className?: string;
  /** Show clear button */
  showClear?: boolean;
  /** Debounce onChange (ms) */
  debounce?: number;
}

/**
 * SearchInput - Search field with icon
 *
 * Features:
 * - Search icon prefix
 * - Optional clear button
 * - Debounced onChange for performance
 */
export function SearchInput({
  value = "",
  onChange,
  placeholder = "Search...",
  disabled = false,
  size = "md",
  className,
  showClear = true,
  debounce,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = React.useState(value);
  const debounceRef = React.useRef<NodeJS.Timeout>();

  // Sync internal value with external prop
  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);

      if (debounce && onChange) {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onChange(newValue), debounce);
      } else {
        onChange?.(newValue);
      }
    },
    [onChange, debounce]
  );

  const handleClear = useCallback(() => {
    setInternalValue("");
    onChange?.("");
  }, [onChange]);

  const sizeStyles = {
    sm: "h-7 text-xs pl-8 pr-8",
    md: "h-9 text-sm pl-9 pr-9",
    lg: "h-11 text-base pl-10 pr-10",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5 left-2.5",
    md: "w-4 h-4 left-3",
    lg: "w-5 h-5 left-3.5",
  };

  return (
    <div className={cn("relative", className)}>
      {/* Search icon */}
      <Search
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none",
          iconSizes[size]
        )}
      />

      {/* Input */}
      <input
        type="text"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full rounded-lg border border-outline bg-surface",
          "text-on-surface placeholder:text-on-surface-variant/60",
          "outline-none transition-colors",
          "focus:border-primary focus:ring-2 focus:ring-primary/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          sizeStyles[size]
        )}
      />

      {/* Clear button */}
      {showClear && internalValue && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            "absolute top-1/2 -translate-y-1/2",
            "p-1 rounded-full text-on-surface-variant",
            "hover:bg-surface-container-high hover:text-on-surface",
            "transition-colors",
            size === "sm" ? "right-2" : size === "lg" ? "right-3.5" : "right-2.5"
          )}
        >
          <X className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
        </button>
      )}
    </div>
  );
}

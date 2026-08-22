"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Filter } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
  /** Optional icon */
  icon?: React.ReactNode;
}

export interface FilterSelectProps {
  /** Current selected value */
  value?: string;
  /** Options list */
  options: FilterOption[];
  /** Change handler */
  onChange?: (value: string) => void;
  /** Placeholder when no value selected */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional trigger classes */
  className?: string;
  /** Show filter icon */
  showIcon?: boolean;
}

/**
 * FilterSelect - Dropdown for filter panel
 *
 * A styled Select wrapper with optional filter icon
 */
export function FilterSelect({
  value,
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className,
  showIcon = true,
}: FilterSelectProps) {
  const handleValueChange = (newValue: string) => {
    onChange?.(newValue === "none" ? "" : newValue);
  };

  return (
    <div className={cn("relative", className)}>
      <Select
        value={value || "none"}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            "w-full min-w-[140px]",
            "bg-surface border-outline",
            "hover:border-primary/50",
            "data-[placeholder]:text-on-surface-variant"
          )}
        >
          {showIcon && (
            <Filter className="w-3.5 h-3.5 mr-1.5 text-on-surface-variant" />
          )}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                {option.icon && (
                  <span className="text-on-surface-variant">{option.icon}</span>
                )}
                {option.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Multi-select filter variant
export interface MultiFilterSelectProps extends Omit<FilterSelectProps, "value" | "onChange"> {
  /** Selected values array */
  value?: string[];
  /** Change handler */
  onChange?: (values: string[]) => void;
  /** Maximum selections */
  maxSelections?: number;
}

export function MultiFilterSelect({
  value = [],
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className,
}: MultiFilterSelectProps) {
  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange?.(value.filter((v) => v !== optionValue));
    } else {
      onChange?.([...value, optionValue]);
    }
  };

  const selectedLabels = options
    .filter((opt) => value.includes(opt.value))
    .map((opt) => opt.label)
    .join(", ");

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          "w-full min-w-[140px]",
          "bg-surface border border-outline rounded-lg",
          "text-sm text-left",
          "hover:border-primary/50",
          "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Filter className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
        <span className={cn(!selectedLabels && "text-on-surface-variant")}>
          {selectedLabels || placeholder}
        </span>
        {value.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
            {value.length}
          </span>
        )}
      </button>
    </div>
  );
}

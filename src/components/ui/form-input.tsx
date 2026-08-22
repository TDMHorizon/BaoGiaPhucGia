"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { AlertCircle } from "lucide-react";

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field label */
  label?: string;
  /** Error message */
  error?: string;
  /** Help text below input */
  helpText?: string;
  /** Required indicator */
  required?: boolean;
  /** Input size */
  size?: "sm" | "md" | "lg";
  /** Show error icon */
  showErrorIcon?: boolean;
  /** Wrapper class */
  wrapperClassName?: string;
}

/**
 * FormInput - Input with form field wrapper
 *
 * Features:
 * - Label with required asterisk
 * - Error state styling
 * - Help text
 * - Error icon
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      error,
      helpText,
      required = false,
      size = "md",
      showErrorIcon = true,
      wrapperClassName,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;

    const sizeStyles = {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
    };

    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "font-medium text-on-surface",
              hasError && "text-[#991B1B]",
              sizeStyles[size]
            )}
          >
            {label}
            {required && (
              <span className="ml-1 text-[#991B1B]">*</span>
            )}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative">
          <Input
            ref={ref}
            id={inputId}
            aria-invalid={hasError}
            className={cn(
              hasError && [
                "border-[#991B1B] bg-[#FEE2E2]/10",
                "focus:border-[#991B1B] focus:ring-[#991B1B]/20",
              ],
              className
            )}
            {...props}
          />

          {/* Error icon */}
          {hasError && showErrorIcon && (
            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#991B1B] pointer-events-none" />
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className={cn("text-xs text-[#991B1B] flex items-center gap-1")}>
            {error}
          </p>
        )}

        {/* Help text */}
        {helpText && !error && (
          <p className={cn("text-xs text-on-surface-variant")}>
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

FormInput.displayName = "FormInput";

// Textarea variant
export interface FormTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  wrapperClassName?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  (
    {
      label,
      error,
      helpText,
      required = false,
      wrapperClassName,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;

    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              "font-medium text-on-surface",
              hasError && "text-[#991B1B]"
            )}
          >
            {label}
            {required && <span className="ml-1 text-[#991B1B]">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={hasError}
          className={cn(
            "min-h-[80px] px-3 py-2 rounded-lg",
            "border border-outline bg-surface",
            "text-sm text-on-surface placeholder:text-on-surface-variant/60",
            "outline-none transition-colors",
            "focus:border-primary focus:ring-2 focus:ring-primary/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            hasError && [
              "border-[#991B1B] bg-[#FEE2E2]/10",
              "focus:border-[#991B1B] focus:ring-[#991B1B]/20",
            ],
            className
          )}
          {...props}
        />

        {error && (
          <p className={cn("text-xs text-[#991B1B] flex items-center gap-1")}>
            {error}
          </p>
        )}

        {helpText && !error && (
          <p className={cn("text-xs text-on-surface-variant")}>{helpText}</p>
        )}
      </div>
    );
  }
);

FormTextarea.displayName = "FormTextarea";

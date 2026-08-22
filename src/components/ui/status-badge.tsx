"use client";

import React from "react";
import { cn } from "@/lib/utils";

// Status badge variants with Stitch Design System colors
const STATUS_VARIANTS = {
  success: {
    bg: "bg-[#DCFCE7]",
    text: "text-[#166534]",
    border: "border-[#BBF7D0]",
  },
  warning: {
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
    border: "border-[#FDE68A]",
  },
  neutral: {
    bg: "bg-[#F1F5F9]",
    text: "text-[#475569]",
    border: "border-[#E2E8F0]",
  },
  error: {
    bg: "bg-[#FEE2E2]",
    text: "text-[#991B1B]",
    border: "border-[#FECACA]",
  },
  info: {
    bg: "bg-[#DBE1FF]",
    text: "text-[#003EA8]",
    border: "border-[#BFDBFE]",
  },
  purple: {
    bg: "bg-[#F3E8FF]",
    text: "text-[#7C3AED]",
    border: "border-[#E9D5FF]",
  },
} as const;

export type StatusVariant = keyof typeof STATUS_VARIANTS;

export interface StatusBadgeProps {
  /** Badge variant determines colors */
  variant?: StatusVariant;
  /** Custom additional classes */
  className?: string;
  /** Children content */
  children: React.ReactNode;
  /** Show dot indicator */
  showDot?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * StatusBadge - Displays status with semantic colors
 *
 * Variants:
 * - success: For completed/approved states
 * - warning: For pending/attention states
 * - neutral: For draft/new states
 * - error: For rejected/error states
 * - info: For processing/in-progress states
 * - purple: For sent-to-customer states
 */
export function StatusBadge({
  variant = "neutral",
  className,
  children,
  showDot = false,
  size = "sm",
}: StatusBadgeProps) {
  const variantStyles = STATUS_VARIANTS[variant];

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold border",
        variantStyles.bg,
        variantStyles.text,
        variantStyles.border,
        sizeStyles[size],
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            variantStyles.bg.replace("bg-", "bg-") === "bg-[#DCFCE7]"
              ? "bg-[#166534]"
              : variantStyles.text.replace("text-", "bg-")
          )}
        />
      )}
      {children}
    </span>
  );
}

// Preset status badges for common use cases
export function SuccessBadge({ children, ...props }: Omit<StatusBadgeProps, "variant">) {
  return <StatusBadge variant="success" {...props}>{children}</StatusBadge>;
}

export function WarningBadge({ children, ...props }: Omit<StatusBadgeProps, "variant">) {
  return <StatusBadge variant="warning" {...props}>{children}</StatusBadge>;
}

export function ErrorBadge({ children, ...props }: Omit<StatusBadgeProps, "variant">) {
  return <StatusBadge variant="error" {...props}>{children}</StatusBadge>;
}

export function InfoBadge({ children, ...props }: Omit<StatusBadgeProps, "variant">) {
  return <StatusBadge variant="info" {...props}>{children}</StatusBadge>;
}

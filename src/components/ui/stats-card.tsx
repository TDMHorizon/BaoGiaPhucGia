"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

export interface StatsCardProps {
  /** Card label */
  label: string;
  /** Display value */
  value: string | number;
  /** Icon component from Lucide */
  icon?: LucideIcon;
  /** Optional icon color class */
  iconColor?: string;
  /** Trend indicator */
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  /** Additional classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * StatsCard - Dashboard bento grid card with trend indicator
 *
 * Displays a statistic with optional icon and trend comparison
 */
export function StatsCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-primary",
  trend,
  className,
  onClick,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "bg-white border border-[#E2E8F0] rounded-[12px] p-lg",
        "transition-shadow hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full" />

      <div className="relative flex flex-col gap-3">
        {/* Header row: Icon + Label */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#64748B]">{label}</span>
          {Icon && (
            <div className={cn("p-2 rounded-lg bg-primary/10", iconColor)}>
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Value */}
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold text-[#191B23]">{value}</span>
        </div>

        {/* Trend indicator */}
        {trend && (
          <div className="flex items-center gap-1.5">
            {trend.isPositive ? (
              <TrendingUp className="w-4 h-4 text-[#22C55E]" />
            ) : (
              <TrendingDown className="w-4 h-4 text-[#EF4444]" />
            )}
            <span
              className={cn(
                "text-xs font-semibold",
                trend.isPositive ? "text-[#22C55E]" : "text-[#EF4444]"
              )}
            >
              {trend.value > 0 ? "+" : ""}
              {trend.value}%
            </span>
            {trend.label && (
              <span className="text-xs text-[#94A3B8]">{trend.label}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

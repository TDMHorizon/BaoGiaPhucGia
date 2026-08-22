"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  isActive?: boolean;
  icon?: React.ReactNode;
}

export interface TopNavProps {
  /** Brand name/logo */
  brand: React.ReactNode;
  /** Navigation items */
  navItems?: NavItem[];
  /** Right side content (user menu, etc.) */
  rightContent?: React.ReactNode;
  /** Fixed position */
  fixed?: boolean;
  /** Additional classes */
  className?: string;
  /** Show border */
  showBorder?: boolean;
}

/**
 * TopNav - Navigation bar component
 *
 * Design specs from Stitch Design System:
 * - Fixed top, h-16
 * - bg-surface-container-lowest
 * - border-b border-outline
 */
export function TopNav({
  brand,
  navItems = [],
  rightContent,
  fixed = true,
  className,
  showBorder = true,
}: TopNavProps) {
  return (
    <header
      className={cn(
        "h-16 px-6",
        "flex items-center justify-between",
        "bg-surface-container-lowest",
        showBorder && "border-b border-outline",
        fixed && "fixed top-0 left-0 right-0 z-50",
        className
      )}
    >
      {/* Left section: Brand + Nav */}
      <div className="flex items-center gap-8">
        {/* Brand */}
        <div className="flex items-center gap-2">
          {brand}
        </div>

        {/* Navigation */}
        {navItems.length > 0 && (
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium",
                  "transition-colors duration-150",
                  item.isActive
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                )}
              >
                <span className="flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
              </a>
            ))}
          </nav>
        )}
      </div>

      {/* Right section: User menu, etc. */}
      {rightContent && (
        <div className="flex items-center gap-2">
          {rightContent}
        </div>
      )}
    </header>
  );
}

// Mobile nav variant
export interface MobileTopNavProps extends Omit<TopNavProps, "fixed" | "showBorder"> {
  onMenuToggle?: () => void;
  menuIcon?: React.ReactNode;
}

export function MobileTopNav({
  onMenuToggle,
  menuIcon,
  ...props
}: MobileTopNavProps) {
  return (
    <TopNav
      {...props}
      fixed={true}
      showBorder={true}
      className={cn(props.className)}
      rightContent={
        <>
          {onMenuToggle && (
            <button
              type="button"
              onClick={onMenuToggle}
              className={cn(
                "p-2 rounded-lg",
                "text-on-surface-variant hover:bg-surface-container-high",
                "md:hidden"
              )}
            >
              {menuIcon || <MenuIcon />}
            </button>
          )}
          {props.rightContent}
        </>
      }
    />
  );
}

// Simple menu icon component
function MenuIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

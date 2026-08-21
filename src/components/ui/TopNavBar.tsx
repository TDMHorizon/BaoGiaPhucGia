"use client";

import React from "react";
import { Button } from "./button";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface NavLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface TopNavBarProps {
  /** Logo text or element */
  logo?: React.ReactNode;
  /** Navigation links */
  links?: NavLink[];
  /** Current active link */
  activeLink?: string;
  /** Callback when link is clicked */
  onLinkClick?: (href: string) => void;
  /** Right side content (notifications, account) */
  rightContent?: React.ReactNode;
  /** Additional class for nav bar */
  className?: string;
  /** User info display */
  user?: {
    name: string;
    role?: string;
    avatar?: React.ReactNode;
  };
  /** Logout callback */
  onLogout?: () => void;
}

export function TopNavBar({
  logo = (
    <span className="flex items-center gap-2">
      <span className="bg-primary text-primary-foreground rounded-md p-1 px-2 text-xs font-black uppercase shadow-sm">
        BG
      </span>
      <span className="font-extrabold text-on-surface tracking-tight hidden sm:inline">
        Báo Giá Phúc Gia
      </span>
    </span>
  ),
  links = [],
  activeLink,
  onLinkClick,
  rightContent,
  className,
  user,
  onLogout,
}: TopNavBarProps) {
  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        "bg-surface border-b border-outline",
        "shadow-xs",
        className
      )}
    >
      <div className="flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-4">
          {logo}
        </div>

        {/* Navigation Links */}
        {links.length > 0 && (
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <button
                key={link.href}
                onClick={() => onLinkClick?.(link.href)}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high",
                  activeLink === link.href && [
                    "text-primary",
                    "after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5",
                    "after:bg-primary after:rounded-full",
                  ]
                )}
              >
                <span className="flex items-center gap-2">
                  {link.icon}
                  {link.label}
                </span>
              </button>
            ))}
          </nav>
        )}

        {/* Right Side Content */}
        <div className="flex items-center gap-3">
          {rightContent}

          {/* User Menu */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-on-surface">
                  {user.name}
                </span>
                {user.role && (
                  <span className="text-xs text-on-surface-variant">
                    {user.role === "admin"
                      ? "Quản trị"
                      : user.role === "manager"
                        ? "Quản lý"
                        : "Nhân viên"}
                  </span>
                )}
              </div>

              {user.avatar || (
                <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-primary-container-foreground text-sm font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}

              {onLogout && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="text-error hover:bg-error-container hover:text-error-foreground"
                >
                  Đăng xuất
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Mobile-friendly bottom navigation bar variant
 */
export function BottomNavBar({
  links,
  activeLink,
  onLinkClick,
  className,
}: {
  links: NavLink[];
  activeLink?: string;
  onLinkClick?: (href: string) => void;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-surface border-t border-outline",
        "md:hidden",
        className
      )}
    >
      <div className="flex h-16 items-center justify-around px-2">
        {links.map((link) => (
          <button
            key={link.href}
            onClick={() => onLinkClick?.(link.href)}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]",
              activeLink === link.href
                ? "text-primary"
                : "text-on-surface-variant"
            )}
          >
            {link.icon}
            <span className="text-xs font-medium">{link.label}</span>
            {activeLink === link.href && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

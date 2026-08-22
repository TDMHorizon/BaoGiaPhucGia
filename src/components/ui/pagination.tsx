"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export interface PaginationProps {
  /** Current page (1-indexed) */
  currentPage: number;
  /** Total pages */
  totalPages: number;
  /** Page change handler */
  onPageChange: (page: number) => void;
  /** Sibling page count (default: 1) */
  siblingCount?: number;
  /** Show first/last buttons */
  showFirstLast?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Additional classes */
  className?: string;
}

/**
 * Pagination - Page navigation with ellipsis
 *
 * Features:
 * - Page numbers with ellipsis
 * - First/last page buttons
 * - Previous/next buttons
 * - Compact mode
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  showFirstLast = true,
  compact = false,
  className,
}: PaginationProps) {
  // Generate page range with ellipsis
  const pageRange = useMemo(() => {
    const range: (number | "ellipsis")[] = [];
    const delta = siblingCount + 2; // Pages around current

    // Always show first page
    if (totalPages <= 7) {
      // Show all pages if few
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always include first page
    range.push(1);

    // Calculate range around current page
    const leftSibling = Math.max(2, currentPage - siblingCount);
    const rightSibling = Math.min(totalPages - 1, currentPage + siblingCount);

    // Add ellipsis after first page if needed
    if (leftSibling > 2) {
      range.push("ellipsis");
    }

    // Add pages around current
    for (let i = leftSibling; i <= rightSibling; i++) {
      range.push(i);
    }

    // Add ellipsis before last page if needed
    if (rightSibling < totalPages - 1) {
      range.push("ellipsis");
    }

    // Always include last page
    range.push(totalPages);

    return range;
  }, [currentPage, totalPages, siblingCount]);

  const handleClick = (page: number | "ellipsis") => {
    if (page === "ellipsis") return;
    onPageChange(page);
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-sm text-on-surface-variant">
          Trang {currentPage} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* First page button */}
      {showFirstLast && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="hidden sm:flex"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
      )}

      {/* Previous button */}
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pageRange.map((page, index) =>
          page === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="w-8 h-8 flex items-center justify-center text-on-surface-variant"
            >
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "ghost"}
              size="sm"
              onClick={() => handleClick(page)}
              className={cn("min-w-[32px]", currentPage === page && "pointer-events-none")}
            >
              {page}
            </Button>
          )
        )}
      </div>

      {/* Next button */}
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      {/* Last page button */}
      {showFirstLast && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="hidden sm:flex"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

// Page size selector component
export interface PageSizeSelectorProps {
  pageSize: number;
  pageSizeOptions?: number[];
  onPageSizeChange: (size: number) => void;
  className?: string;
}

export function PageSizeSelector({
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageSizeChange,
  className,
}: PageSizeSelectorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm text-on-surface-variant">Hiển thị</span>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className={cn(
          "h-8 px-2 rounded-lg border border-outline bg-surface",
          "text-sm text-on-surface",
          "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
          "cursor-pointer"
        )}
      >
        {pageSizeOptions.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <span className="text-sm text-on-surface-variant">mục</span>
    </div>
  );
}

"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";

export interface Column<T> {
  /** Column key for data access */
  key: keyof T | string;
  /** Header label */
  header: string;
  /** Custom cell renderer */
  render?: (row: T, index: number) => React.ReactNode;
  /** Column width */
  width?: string | number;
  /** Column alignment */
  align?: "left" | "center" | "right";
  /** Sortable column */
  sortable?: boolean;
}

export interface DataTableProps<T extends { id?: string | number }> {
  /** Column definitions */
  columns: Column<T>[];
  /** Data rows */
  data: T[];
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state icon */
  emptyIcon?: React.ReactNode;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Row className generator */
  rowClassName?: (row: T) => string;
  /** Sticky header */
  stickyHeader?: boolean;
  /** Zebra striping */
  zebraStripe?: boolean;
  /** Additional container classes */
  className?: string;
}

/**
 * DataTable - Generic table with sorting and features
 *
 * Features:
 * - Column definitions with custom renderers
 * - Sticky header support
 * - Row click handling
 * - Empty/loading states
 * - Zebra striping
 */
export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  loading = false,
  emptyMessage = "No data available",
  emptyIcon,
  onRowClick,
  rowClassName,
  stickyHeader = true,
  zebraStripe = false,
  className,
}: DataTableProps<T>) {
  // Default empty icon
  const DefaultEmptyIcon = <Inbox className="w-12 h-12 text-on-surface-variant/50" />;

  // Get cell value from row by column key
  const getCellValue = (row: T, column: Column<T>): React.ReactNode => {
    if (column.render) {
      return column.render(row, data.indexOf(row));
    }
    const key = column.key as string;
    return (row as Record<string, unknown>)[key] as React.ReactNode;
  };

  return (
    <div className={cn("relative w-full", className)}>
      <Table>
        <TableHeader className={cn(stickyHeader && "sticky top-0 z-10 bg-surface-container-high")}>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={String(column.key)}
                className={cn(
                  "font-semibold text-on-surface-variant bg-surface-container-high",
                  column.align === "center" && "text-center",
                  column.align === "right" && "text-right"
                )}
                style={{ width: column.width }}
              >
                <div className={cn("flex items-center gap-1", column.sortable && "cursor-pointer select-none")}>
                  {column.header}
                  {column.sortable && (
                    <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant/50" />
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading ? (
            // Loading skeleton rows
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {columns.map((column) => (
                  <TableCell key={String(column.key)}>
                    <div className="h-4 bg-surface-container-high rounded animate-pulse" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            // Empty state
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-12">
                <div className="flex flex-col items-center gap-3">
                  {emptyIcon || DefaultEmptyIcon}
                  <p className="text-on-surface-variant">{emptyMessage}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            // Data rows
            data.map((row, rowIndex) => (
              <TableRow
                key={row.id ?? rowIndex}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  zebraStripe && rowIndex % 2 === 1 && "bg-surface-container-low",
                  onRowClick && "cursor-pointer",
                  rowClassName?.(row)
                )}
              >
                {columns.map((column) => (
                  <TableCell
                    key={String(column.key)}
                    className={cn(
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right"
                    )}
                  >
                    {getCellValue(row, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Expandable row variant
export interface ExpandableRow<T> {
  id: string | number;
  content: T;
  subRows?: ExpandableRow<T>[];
}

export interface ExpandableDataTableProps<T extends { id?: string | number }>
  extends Omit<DataTableProps<T>, "data"> {
  data: (T & { subRows?: T[] })[];
  defaultExpanded?: boolean;
  onRowExpand?: (row: T, expanded: boolean) => void;
}

export function ExpandableDataTable<T extends { id?: string | number }>({
  data,
  defaultExpanded = false,
  onRowExpand,
  ...props
}: ExpandableDataTableProps<T>) {
  const [expandedRows, setExpandedRows] = React.useState<Set<string | number>>(
    defaultExpanded ? new Set(data.map((r) => r.id)) : new Set()
  );

  const handleToggle = (rowId: string | number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
    const row = data.find((r) => r.id === rowId);
    if (row && onRowExpand) {
      onRowExpand(row, newExpanded.has(rowId));
    }
  };

  return (
    <DataTable
      {...props}
      data={data}
      rowClassName={(row) =>
        expandedRows.has(row.id as string | number) ? "bg-surface-container-low" : ""
      }
    />
  );
}

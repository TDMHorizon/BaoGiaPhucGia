import React from 'react';
import ExcelJS from "exceljs";
import { MergeInfo, getCellExcelJSStyle } from "../../../lib/utils-excel";

// Stitch Design System colors
const STITCH_COLORS = {
  surface: '#f8fafc',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f8fafc',
  surfaceContainer: '#f1f5f9',
  primary: '#2563eb',
  primaryLight: 'rgba(37, 99, 235, 0.12)',
  primaryForeground: '#ffffff',
  onSurface: '#0f172a',
  onSurfaceVariant: '#475569',
  outline: '#e2e8f0',
  outlineVariant: '#cbd5e1',
  editable: '#f0fdf4',
  editableBorder: '#bbf7d0',
  error: '#ef4444',
  selected: 'rgba(37, 99, 235, 0.08)',
} as const;

interface ComputeCellStylesOptions {
  ejWs: ExcelJS.Worksheet | undefined;
  r: number;
  c: number;
  isEditable: boolean;
  isSelected: boolean;
  selectedColor?: string;
  mergeInfo?: MergeInfo;
  colWidths: Record<number, number>;
}

export interface CellUIStyles {
  shouldSkip: boolean;
  mergeInfo: MergeInfo | { shouldSkip: false };
  shouldTruncate: boolean;
  finalTdStyle: React.CSSProperties;
  spanStyle: React.CSSProperties;
}

// Simple memoization cache for performance
const memoCache = new Map<string, CellUIStyles>();
const MAX_CACHE_SIZE = 1000;

function getCacheKey(opts: ComputeCellStylesOptions): string {
  return `${opts.r}-${opts.c}-${opts.isEditable}-${opts.isSelected}-${opts.mergeInfo?.shouldSkip ?? 'none'}`;
}

export function computeCellUIStyles(opts: ComputeCellStylesOptions): CellUIStyles {
  const cacheKey = getCacheKey(opts);

  // Check cache first
  if (memoCache.has(cacheKey)) {
    return memoCache.get(cacheKey)!;
  }

  const result = computeStyles(opts);

  // Manage cache size
  if (memoCache.size >= MAX_CACHE_SIZE) {
    // Clear half the cache when full
    const keysToDelete = Array.from(memoCache.keys()).slice(0, MAX_CACHE_SIZE / 2);
    keysToDelete.forEach(key => memoCache.delete(key));
  }

  memoCache.set(cacheKey, result);
  return result;
}

function computeStyles(opts: ComputeCellStylesOptions): CellUIStyles {
  const { ejWs, r, c, isEditable, isSelected, selectedColor, mergeInfo, colWidths } = opts;

  if (mergeInfo?.shouldSkip) {
    return {
      shouldSkip: true,
      mergeInfo,
      shouldTruncate: false,
      finalTdStyle: {},
      spanStyle: {}
    };
  }

  const cellStyle = getCellExcelJSStyle(ejWs, r, c);
  const cellWidth = colWidths[c] || 80;

  // Calculate total width for merged cells
  const totalWidth = (mergeInfo?.colSpan && mergeInfo.colSpan > 1) ? (() => {
    let w = 0;
    for (let offset = 0; offset < (mergeInfo.colSpan || 1); offset++) {
      w += (colWidths[c + offset] || 80);
    }
    return w;
  })() : cellWidth;

  const shouldTruncate = totalWidth < 120;

  // Determine background color
  let baseBgColor = cellStyle.backgroundColor || 'transparent';

  // Handle transparent/white backgrounds
  if (baseBgColor === 'transparent' || baseBgColor === '#ffffff' || baseBgColor === '#fff') {
    if (isEditable) {
      // Editable cells get light green background
      baseBgColor = STITCH_COLORS.editable;
    } else {
      baseBgColor = 'transparent';
    }
  }

  // Apply selection color
  const defaultSelectedColor = STITCH_COLORS.selected;
  const finalBgColor = isSelected
    ? (selectedColor || defaultSelectedColor)
    : baseBgColor;

  // Build final TD style with Stitch tokens
  const finalTdStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: finalBgColor,
    width: `${totalWidth}px`,
    minWidth: `${totalWidth}px`,
    maxWidth: `${totalWidth}px`,
  };

  // Span style for text content
  const spanStyle: React.CSSProperties = {
    textAlign: finalTdStyle.textAlign || 'left',
    fontWeight: finalTdStyle.fontWeight,
    fontStyle: finalTdStyle.fontStyle,
    textDecoration: finalTdStyle.textDecoration,
    color: finalTdStyle.color || STITCH_COLORS.onSurface,
    fontSize: finalTdStyle.fontSize,
    writingMode: finalTdStyle.writingMode,
    textOrientation: finalTdStyle.textOrientation,
    transform: finalTdStyle.transform,
    transformOrigin: finalTdStyle.transformOrigin,
    whiteSpace: finalTdStyle.whiteSpace || 'pre-wrap',
    wordBreak: finalTdStyle.wordBreak || 'break-word',
  };

  return {
    shouldSkip: false,
    mergeInfo: mergeInfo || { shouldSkip: false },
    shouldTruncate,
    finalTdStyle,
    spanStyle
  };
}

// Clear cache when needed (e.g., when sheet data changes significantly)
export function clearStyleCache(): void {
  memoCache.clear();
}

// Export Stitch colors for use in other components
export { STITCH_COLORS };

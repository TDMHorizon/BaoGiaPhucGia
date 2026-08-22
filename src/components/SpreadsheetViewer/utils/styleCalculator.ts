import React from 'react';
import ExcelJS from "exceljs";
import { MergeInfo, getCellExcelJSStyle } from "../../../lib/utils-excel";

// Design tokens - single source of truth
const DESIGN_TOKENS = {
  colors: {
    surface: '#f8fafc',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#f8fafc',
    primary: '#2563eb',
    primaryLight: 'rgba(37, 99, 235, 0.12)',
    onSurface: '#0f172a',
    onSurfaceVariant: '#475569',
    editable: '#f0fdf4',
    selected: 'rgba(37, 99, 235, 0.08)',
  },
  sizes: {
    defaultCellWidth: 80,
    truncateThreshold: 120,
  }
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

// LRU Cache implementation for better performance
const MAX_CACHE_SIZE = 2000;

class LRUCache<K, V> {
  private cache = new Map<K, V>();

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= MAX_CACHE_SIZE) {
      // Remove oldest (first) entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Metrics tracking (reset on cache clear to prevent overflow)
let cacheHits = 0;
let cacheMisses = 0;
const MAX_METRIC_VALUE = 1000000;

function getCacheKey(opts: ComputeCellStylesOptions): string {
  return `${opts.r}-${opts.c}-${opts.isEditable}-${opts.isSelected}-${opts.mergeInfo?.shouldSkip ?? 'none'}`;
}

const styleCache = new LRUCache<string, CellUIStyles>();

export function computeCellUIStyles(opts: ComputeCellStylesOptions): CellUIStyles {
  const cacheKey = getCacheKey(opts);
  const cached = styleCache.get(cacheKey);

  if (cached) {
    if (cacheHits < MAX_METRIC_VALUE) cacheHits++;
    return cached;
  }

  if (cacheMisses < MAX_METRIC_VALUE) cacheMisses++;
  const result = computeStyles(opts);
  styleCache.set(cacheKey, result);
  return result;
}

// Export metrics for debugging/performance monitoring
export function getCacheStats(): { hits: number; misses: number; size: number; hitRate: number } {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    size: styleCache.size,
    hitRate: total > 0 ? cacheHits / total : 0,
  };
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
  const cellWidth = colWidths[c] || DESIGN_TOKENS.sizes.defaultCellWidth;

  // Calculate total width for merged cells
  const totalWidth = (mergeInfo?.colSpan && mergeInfo.colSpan > 1)
    ? Array.from({ length: mergeInfo.colSpan }, (_, i) => colWidths[c + i] || DESIGN_TOKENS.sizes.defaultCellWidth).reduce((a, b) => a + b, 0)
    : cellWidth;

  const shouldTruncate = totalWidth < DESIGN_TOKENS.sizes.truncateThreshold;

  // Determine background color
  let baseBgColor = cellStyle.backgroundColor || 'transparent';

  if (baseBgColor === 'transparent' || baseBgColor === '#ffffff' || baseBgColor === '#fff') {
    baseBgColor = isEditable ? DESIGN_TOKENS.colors.editable : 'transparent';
  }

  const finalBgColor = isSelected
    ? (selectedColor || DESIGN_TOKENS.colors.selected)
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
    color: finalTdStyle.color || DESIGN_TOKENS.colors.onSurface,
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
  styleCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

// Export design tokens for use in other components
export { DESIGN_TOKENS };

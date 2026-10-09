import React from 'react';
import ExcelJS from "exceljs";
import { MergeInfo, getCellExcelJSStyle } from "../../../lib/utils-excel";

interface ComputeCellStylesOptions {
  ejWs: ExcelJS.Worksheet | undefined;
  r: number;
  c: number;
  isEditable: boolean;
  isSelected: boolean;
  selectedColor?: string; // Color when selected
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

export function computeCellUIStyles(opts: ComputeCellStylesOptions): CellUIStyles {
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
  const cellWidth = colWidths[c] || 80; // default 80

  const totalWidth = (mergeInfo?.colSpan && mergeInfo.colSpan > 1) ? (() => {
    let w = 0;
    for (let offset = 0; offset < (mergeInfo.colSpan || 1); offset++) {
      w += (colWidths[c + offset] || 80);
    }
    return w;
  })() : cellWidth;

  const shouldTruncate = totalWidth < 120;

  let baseBgColor = cellStyle.fillColor || "transparent";
  if (baseBgColor === "transparent" || baseBgColor === "#ffffff") {
    // isEditable highlight
    baseBgColor = isEditable ? "#ecfdf5" : "transparent";
  }

  const defaultSelectedColor = "rgba(191, 219, 254, 0.5)"; // Blue for user dashboard
  const finalBgColor = isSelected ? (selectedColor || defaultSelectedColor) : baseBgColor;

  const finalTdStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: finalBgColor,
    width: `${totalWidth}px`,
    minWidth: `${totalWidth}px`,
    maxWidth: `${totalWidth}px`,
  };

  const spanStyle: React.CSSProperties = {
    textAlign: finalTdStyle.textAlign || 'left',
    fontWeight: finalTdStyle.fontWeight,
    fontStyle: finalTdStyle.fontStyle,
    textDecoration: finalTdStyle.textDecoration,
    color: finalTdStyle.color || '#1e293b',
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

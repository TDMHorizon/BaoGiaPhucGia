import * as ExcelJS from "exceljs";

// Comprehensive color converter supporting Hex, RGB, RGBA, Named colors to ExcelJS ARGB
export const colorToArgb = (color: any): string | undefined => {
  if (!color) return undefined;

  let str =
    typeof color === "string"
      ? color.trim()
      : color.rgb
      ? String(color.rgb).trim()
      : "";
  if (!str) return undefined;

  const NAMED_COLORS: Record<string, string> = {
    black: "FF000000",
    white: "FFFFFFFF",
    red: "FFFF0000",
    green: "FF008000",
    blue: "FF0000FF",
    yellow: "FFFFFF00",
    cyan: "FF00FFFF",
    magenta: "FFFF00FF",
    gray: "FF808080",
    grey: "FF808080",
    orange: "FFFFA500",
    purple: "FF800080",
    pink: "FFFFC0CB",
    lime: "FF00FF00",
    navy: "FF000080",
    teal: "FF008080",
    maroon: "FF800000",
    olive: "FF808000",
    silver: "FFC0C0C0",
  };

  const lower = str.toLowerCase();
  if (NAMED_COLORS[lower]) {
    return NAMED_COLORS[lower];
  }

  // rgb(r, g, b)
  const rgbMatch = lower.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1], 10)).toString(16).padStart(2, "0");
    const g = Math.min(255, parseInt(rgbMatch[2], 10)).toString(16).padStart(2, "0");
    const b = Math.min(255, parseInt(rgbMatch[3], 10)).toString(16).padStart(2, "0");
    return `FF${r}${g}${b}`.toUpperCase();
  }

  // rgba(r, g, b, a)
  const rgbaMatch = lower.match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
  if (rgbaMatch) {
    const a = Math.round(Math.min(1, Math.max(0, parseFloat(rgbaMatch[4]))) * 255)
      .toString(16)
      .padStart(2, "0");
    const r = Math.min(255, parseInt(rgbaMatch[1], 10)).toString(16).padStart(2, "0");
    const g = Math.min(255, parseInt(rgbaMatch[2], 10)).toString(16).padStart(2, "0");
    const b = Math.min(255, parseInt(rgbaMatch[3], 10)).toString(16).padStart(2, "0");
    return `${a}${r}${g}${b}`.toUpperCase();
  }

  // Hex (#RGB, #RGBA, #RRGGBB, #AARRGGBB)
  const cleanHex = str.replace("#", "").trim();
  if (cleanHex.length === 3) {
    const r = cleanHex[0] + cleanHex[0];
    const g = cleanHex[1] + cleanHex[1];
    const b = cleanHex[2] + cleanHex[2];
    return `FF${r}${g}${b}`.toUpperCase();
  }
  if (cleanHex.length === 4) {
    const r = cleanHex[0] + cleanHex[0];
    const g = cleanHex[1] + cleanHex[1];
    const b = cleanHex[2] + cleanHex[2];
    const a = cleanHex[3] + cleanHex[3];
    return `${a}${r}${g}${b}`.toUpperCase();
  }
  if (cleanHex.length === 6) {
    return `FF${cleanHex}`.toUpperCase();
  }
  if (cleanHex.length === 8) {
    return cleanHex.toUpperCase();
  }

  return undefined;
};

// Map Univer border style code to ExcelJS BorderStyle
const mapBorderStyle = (s: number | string | undefined): ExcelJS.BorderStyle => {
  if (typeof s === "string") {
    const validStyles: ExcelJS.BorderStyle[] = [
      "thin",
      "medium",
      "thick",
      "dotted",
      "dashed",
      "double",
      "hair",
      "mediumDashed",
      "dashDot",
      "mediumDashDot",
      "dashDotDot",
      "mediumDashDotDot",
      "slantDashDot",
    ];
    if (validStyles.includes(s as any)) return s as ExcelJS.BorderStyle;
  }
  const num = typeof s === "number" ? s : parseInt(String(s), 10);
  switch (num) {
    case 1:
      return "thin";
    case 2:
      return "medium";
    case 3:
      return "dashed";
    case 4:
      return "dotted";
    case 5:
      return "thick";
    case 6:
      return "double";
    case 7:
      return "hair";
    case 8:
      return "mediumDashed";
    case 9:
      return "dashDot";
    case 10:
      return "mediumDashDot";
    case 11:
      return "dashDotDot";
    case 12:
      return "mediumDashDotDot";
    case 13:
      return "slantDashDot";
    default:
      return "thin";
  }
};

/**
 * Synchronizes full Univer spreadsheet snapshot into an ExcelJS Workbook.
 * Preserves text, formulas, font colors, font sizes, bold, italic, underline, strike,
 * background fill colors, alignments, borders, merged cells, row heights, and column widths.
 */
export const syncUniverToExcelJS = (
  univerSnapshot: any,
  exceljsWorkbook: ExcelJS.Workbook
): ExcelJS.Workbook => {
  if (!univerSnapshot || !univerSnapshot.sheets) {
    return exceljsWorkbook;
  }

  // Global styles table in Univer
  const styles = univerSnapshot.styles || {};

  // Process sheets in snapshot
  const sheetList = Object.values(univerSnapshot.sheets) as any[];

  sheetList.forEach((univerSheet: any) => {
    let ws = exceljsWorkbook.getWorksheet(univerSheet.name);
    if (!ws) {
      ws = exceljsWorkbook.addWorksheet(univerSheet.name);
    }

    // 1. Sync Row Heights
    if (univerSheet.rowData) {
      Object.keys(univerSheet.rowData).forEach((rowKey) => {
        const r = parseInt(rowKey, 10);
        const rowObj = univerSheet.rowData[rowKey];
        if (rowObj && rowObj.h) {
          const excelRowHeight = Math.round(rowObj.h / 1.33);
          ws!.getRow(r + 1).height = excelRowHeight;
        }
      });
    }

    // 2. Sync Column Widths
    if (univerSheet.columnData) {
      Object.keys(univerSheet.columnData).forEach((colKey) => {
        const c = parseInt(colKey, 10);
        const colObj = univerSheet.columnData[colKey];
        if (colObj && colObj.w) {
          const excelColWidth = Math.max(10, Math.round(colObj.w / 8.5));
          ws!.getColumn(c + 1).width = excelColWidth;
        }
      });
    }

    // 3. Sync Merged Cells
    if (Array.isArray(univerSheet.mergeData)) {
      univerSheet.mergeData.forEach((m: any) => {
        try {
          ws!.mergeCells(
            m.startRow + 1,
            m.startColumn + 1,
            m.endRow + 1,
            m.endColumn + 1
          );
        } catch {
          // Cell might already be merged
        }
      });
    }

    const cellData = univerSheet.cellData;
    if (!cellData) return;

    // 4. Sync Cell Content & Styling
    Object.keys(cellData).forEach((rowStr) => {
      const rowIndex = parseInt(rowStr, 10);
      const rowCols = cellData[rowStr];
      if (!rowCols) return;

      Object.keys(rowCols).forEach((colStr) => {
        const colIndex = parseInt(colStr, 10);
        const cell = rowCols[colStr];
        if (!cell) return;

        const excelCell = ws!.getCell(rowIndex + 1, colIndex + 1);

        // Value & Formula
        if (cell.f) {
          const formulaStr = String(cell.f).startsWith("=") ? String(cell.f).slice(1) : String(cell.f);
          excelCell.value = {
            formula: formulaStr,
            result: cell.v,
          };
        } else if (cell.p && cell.p.body && cell.p.body.dataStream) {
          // Univer Rich Text Paragraph
          const cleanStream = cell.p.body.dataStream.replace(/\r?\n$/, "");
          excelCell.value = cell.v !== undefined ? cell.v : cleanStream;
        } else if (cell.v !== undefined && cell.v !== null) {
          excelCell.value = cell.v;
        }

        // Style resolution: string key from styles table or direct object
        const rawStyle = cell.s;
        const styleObj =
          typeof rawStyle === "string" ? styles[rawStyle] : rawStyle;

        if (styleObj) {
          // --- FONT STYLES ---
          const fontConfig: Partial<ExcelJS.Font> = { ...(excelCell.font || {}) };

          // Font Family
          if (styleObj.ff) {
            fontConfig.name = styleObj.ff;
          }

          // Font Size (fs)
          if (styleObj.fs) {
            fontConfig.size = Number(styleObj.fs);
          }

          // Bold (bl)
          if (styleObj.bl !== undefined) {
            fontConfig.bold = styleObj.bl === 1 || styleObj.bl === true;
          }

          // Italic (it)
          if (styleObj.it !== undefined) {
            fontConfig.italic = styleObj.it === 1 || styleObj.it === true;
          }

          // Underline (ul)
          if (styleObj.ul !== undefined) {
            const hasUl = styleObj.ul === 1 || styleObj.ul === true || (typeof styleObj.ul === "object" && styleObj.ul?.s);
            fontConfig.underline = hasUl ? true : undefined;
          }

          // Strike (st)
          if (styleObj.st !== undefined) {
            const hasSt = styleObj.st === 1 || styleObj.st === true || (typeof styleObj.st === "object" && styleObj.st?.s);
            fontConfig.strike = hasSt ? true : undefined;
          }

          // Font Color (cl)
          if (styleObj.cl) {
            const argb = colorToArgb(styleObj.cl);
            if (argb) {
              fontConfig.color = { argb };
            }
          }

          excelCell.font = fontConfig;

          // --- BACKGROUND FILL COLOR (bg) ---
          if (styleObj.bg) {
            const bgArgb = colorToArgb(styleObj.bg);
            if (bgArgb) {
              excelCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: bgArgb },
              };
            }
          }

          // --- ALIGNMENT & TEXT WRAP ---
          const alignConfig: Partial<ExcelJS.Alignment> = { ...(excelCell.alignment || {}) };

          // Horizontal Align (ht): 1=left, 2=center, 3=right, 4=justify
          if (styleObj.ht !== undefined) {
            const ht = Number(styleObj.ht);
            if (ht === 1) alignConfig.horizontal = "left";
            else if (ht === 2) alignConfig.horizontal = "center";
            else if (ht === 3) alignConfig.horizontal = "right";
            else if (ht === 4) alignConfig.horizontal = "justify";
          }

          // Vertical Align (vt): 1=top, 2=middle, 3=bottom
          if (styleObj.vt !== undefined) {
            const vt = Number(styleObj.vt);
            if (vt === 1) alignConfig.vertical = "top";
            else if (vt === 2) alignConfig.vertical = "middle";
            else if (vt === 3) alignConfig.vertical = "bottom";
          }

          // Wrap Strategy (tb): 3=wrap
          if (styleObj.tb !== undefined) {
            alignConfig.wrapText = styleObj.tb === 3 || styleObj.tb === true;
          }

          excelCell.alignment = alignConfig;

          // --- BORDERS (bd) ---
          if (styleObj.bd) {
            const borderConfig: Partial<ExcelJS.Borders> = { ...(excelCell.border || {}) };
            const { t, b, l, r } = styleObj.bd;

            if (t) {
              borderConfig.top = {
                style: mapBorderStyle(t.s),
                color: t.cl ? { argb: colorToArgb(t.cl) } : undefined,
              };
            }
            if (b) {
              borderConfig.bottom = {
                style: mapBorderStyle(b.s),
                color: b.cl ? { argb: colorToArgb(b.cl) } : undefined,
              };
            }
            if (l) {
              borderConfig.left = {
                style: mapBorderStyle(l.s),
                color: l.cl ? { argb: colorToArgb(l.cl) } : undefined,
              };
            }
            if (r) {
              borderConfig.right = {
                style: mapBorderStyle(r.s),
                color: r.cl ? { argb: colorToArgb(r.cl) } : undefined,
              };
            }

            excelCell.border = borderConfig;
          }
        }
      });
    });
  });

  return exceljsWorkbook;
};
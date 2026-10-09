import type { IStyleData, IRange } from "@univerjs/core";
import { clientLogger } from "../../../lib/logger";
import type { CellFormatOptions } from "../components/FormatCellsModal";

export const WRAP_STRATEGY_WRAP = 2;

export interface WhitelistedCommandEvent {
  commandId: string;
  type: "value" | "style" | "numberFormat" | "merge" | "filter" | "sort";
  sheetId?: string;
  range?: IRange;
  payload?: any;
}

export const COMMAND_WHITELIST = new Set([
  // Cell Values & Formulas
  "sheet.command.set-range-values",
  "sheet.mutation.set-range-values",
  "set-range-values",

  // Cell Styles & Fonts
  "sheet.command.set-style",
  "sheet.mutation.set-range-style",
  "set-range-style",
  "set-range-background",
  "set-range-font-weight",
  "set-range-font-style",
  "set-range-font-color",
  "set-range-alignment",

  // Number Formats
  "sheet.command.set-numfmt",
  "sheet.mutation.set-numfmt",
  "set-range-number-format",

  // Merges
  "sheet.command.add-range-merge",
  "sheet.command.remove-range-merge",
  "sheet.mutation.add-worksheet-merge",
  "sheet.mutation.remove-worksheet-merge",
  "add-worksheet-merge",
  "remove-worksheet-merge",

  // Filter & Sort
  "sheet.command.set-filter-range",
  "sheet.command.sort-range",
]);

/**
 * Phân loại command ID xem có nằm trong whitelist không
 */
export function classifyUniverCommand(commandId: string): WhitelistedCommandEvent["type"] | null {
  if (!commandId) return null;
  const lower = commandId.toLowerCase();

  for (const cmd of COMMAND_WHITELIST) {
    if (lower.includes(cmd)) {
      if (lower.includes("style") || lower.includes("background") || lower.includes("font") || lower.includes("align")) {
        return "style";
      }
      if (lower.includes("numfmt") || lower.includes("number-format")) {
        return "numberFormat";
      }
      if (lower.includes("merge")) {
        return "merge";
      }
      if (lower.includes("filter")) {
        return "filter";
      }
      if (lower.includes("sort")) {
        return "sort";
      }
      return "value";
    }
  }

  return null;
}

/**
 * Toggle Bold trên range
 */
export function toggleRangeBold(activeRange: any): boolean {
  if (!activeRange) return false;
  try {
    const currentWeight = typeof activeRange.getFontWeight === 'function' ? activeRange.getFontWeight() : 'normal';
    const isBold = currentWeight === 'bold' || currentWeight === 1 || currentWeight === '700';
    const newWeight = isBold ? 'normal' : 'bold';
    activeRange.setFontWeight(newWeight);
    return !isBold;
  } catch (err) {
    console.warn("Toggle bold error:", err);
    return false;
  }
}

/**
 * Toggle Italic trên range
 */
export function toggleRangeItalic(activeRange: any): boolean {
  if (!activeRange) return false;
  try {
    const currentStyle = typeof activeRange.getFontStyle === 'function' ? activeRange.getFontStyle() : 'normal';
    const isItalic = currentStyle === 'italic' || currentStyle === 1;
    const newStyle = isItalic ? 'normal' : 'italic';
    activeRange.setFontStyle(newStyle);
    return !isItalic;
  } catch (err) {
    console.warn("Toggle italic error:", err);
    return false;
  }
}

/**
 * Áp dụng toàn bộ cài đặt từ FormatCellsModal
 */
export function applyFormatCellsOptionsToRange(activeRange: any, options: CellFormatOptions): boolean {
  if (!activeRange) return false;

  try {
    // 1. Number Format
    if (options.numberFormat && typeof activeRange.setNumberFormat === 'function') {
      activeRange.setNumberFormat(options.numberFormat);
    }

    // 2. Font properties
    if (options.fontFamily && typeof activeRange.setFontFamily === 'function') {
      activeRange.setFontFamily(options.fontFamily);
    }
    if (options.fontSize && typeof activeRange.setFontSize === 'function') {
      activeRange.setFontSize(options.fontSize);
    }
    if (options.bold !== undefined && typeof activeRange.setFontWeight === 'function') {
      activeRange.setFontWeight(options.bold ? 'bold' : 'normal');
    }
    if (options.italic !== undefined && typeof activeRange.setFontStyle === 'function') {
      activeRange.setFontStyle(options.italic ? 'italic' : 'normal');
    }
    if (options.fontColor && typeof activeRange.setFontColor === 'function') {
      activeRange.setFontColor(options.fontColor);
    }

    // 3. Alignment
    if (options.horizontalAlign && typeof activeRange.setHorizontalAlignment === 'function') {
      const alignCode = options.horizontalAlign === 'center' ? 2 : options.horizontalAlign === 'right' ? 3 : 1;
      activeRange.setHorizontalAlignment(alignCode);
    }
    if (options.verticalAlign && typeof activeRange.setVerticalAlignment === 'function') {
      const vAlignCode = options.verticalAlign === 'middle' ? 2 : options.verticalAlign === 'bottom' ? 3 : 1;
      activeRange.setVerticalAlignment(vAlignCode);
    }
    if (options.wrapText && typeof activeRange.setWrapStrategy === 'function') {
      activeRange.setWrapStrategy(WRAP_STRATEGY_WRAP);
    }

    // 4. Fill / Background
    if (options.backgroundColor && typeof activeRange.setBackgroundColor === 'function') {
      activeRange.setBackgroundColor(options.backgroundColor);
    }

    return true;
  } catch (err) {
    clientLogger.error("FORMAT_CELLS", "APPLY_OPTIONS_FAILED", err);
    return false;
  }
}

/**
 * Debounce helper to batch persistent syncs
 */
export function createDebouncedSync(callback: () => void, delayMs: number = 300) {
  let timeoutId: NodeJS.Timeout | null = null;
  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback();
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Format Painter State Machine
 */
export type FormatPainterMode = "inactive" | "single" | "persistent";

export class FormatPainterManager {
  private mode: FormatPainterMode = "inactive";
  private copiedStyle: any = null;
  private onModeChangeCallbacks: Array<(mode: FormatPainterMode) => void> = [];

  public getMode(): FormatPainterMode {
    return this.mode;
  }

  public getCopiedStyle(): any {
    return this.copiedStyle;
  }

  public subscribe(cb: (mode: FormatPainterMode) => void): () => void {
    this.onModeChangeCallbacks.push(cb);
    return () => {
      this.onModeChangeCallbacks = this.onModeChangeCallbacks.filter((c) => c !== cb);
    };
  }

  private notify() {
    this.onModeChangeCallbacks.forEach((cb) => cb(this.mode));
  }

  /**
   * Kích hoạt sao chép định dạng từ active range
   */
  public copyFormat(activeRange: any, isPersistent: boolean = false): boolean {
    if (!activeRange) return false;

    try {
      const styles = typeof activeRange.getStyle === "function" ? activeRange.getStyle() : null;
      this.copiedStyle = styles || {
        bl: activeRange.getFontWeight ? (activeRange.getFontWeight() === "bold" ? 1 : 0) : undefined,
        it: activeRange.getFontStyle ? (activeRange.getFontStyle() === "italic" ? 1 : 0) : undefined,
        ff: activeRange.getFontFamily ? activeRange.getFontFamily() : undefined,
        fs: activeRange.getFontSize ? activeRange.getFontSize() : undefined,
        bg: activeRange.getBackgroundColor ? { rgb: activeRange.getBackgroundColor() } : undefined,
        cl: activeRange.getFontColor ? { rgb: activeRange.getFontColor() } : undefined,
        ht: activeRange.getHorizontalAlignment ? activeRange.getHorizontalAlignment() : undefined,
        vt: activeRange.getVerticalAlignment ? activeRange.getVerticalAlignment() : undefined,
        n: activeRange.getNumberFormat ? activeRange.getNumberFormat() : undefined,
      };

      this.mode = isPersistent ? "persistent" : "single";
      this.notify();

      clientLogger.action("FORMAT_PAINTER", "COPY_STYLE_SUCCESS", {
        mode: this.mode,
        copiedStyle: this.copiedStyle,
      });

      return true;
    } catch (err) {
      clientLogger.error("FORMAT_PAINTER", "COPY_STYLE_FAILED", err);
      return false;
    }
  }

  /**
   * Dán định dạng vào target range
   */
  public applyFormat(targetRange: any): boolean {
    if (this.mode === "inactive" || !this.copiedStyle || !targetRange) return false;

    try {
      const style = this.copiedStyle;
      if (style.bl !== undefined && typeof targetRange.setFontWeight === "function") {
        targetRange.setFontWeight(style.bl ? "bold" : "normal");
      }
      if (style.it !== undefined && typeof targetRange.setFontStyle === "function") {
        targetRange.setFontStyle(style.it ? "italic" : "normal");
      }
      if (style.ff && typeof targetRange.setFontFamily === "function") {
        targetRange.setFontFamily(style.ff);
      }
      if (style.fs && typeof targetRange.setFontSize === "function") {
        targetRange.setFontSize(style.fs);
      }
      if (style.bg?.rgb && typeof targetRange.setBackgroundColor === "function") {
        targetRange.setBackgroundColor(style.bg.rgb);
      }
      if (style.cl?.rgb && typeof targetRange.setFontColor === "function") {
        targetRange.setFontColor(style.cl.rgb);
      }
      if (style.ht !== undefined && typeof targetRange.setHorizontalAlignment === "function") {
        targetRange.setHorizontalAlignment(style.ht);
      }
      if (style.vt !== undefined && typeof targetRange.setVerticalAlignment === "function") {
        targetRange.setVerticalAlignment(style.vt);
      }
      if (style.n && typeof targetRange.setNumberFormat === "function") {
        targetRange.setNumberFormat(style.n);
      }

      clientLogger.action("FORMAT_PAINTER", "APPLY_STYLE_SUCCESS", {
        mode: this.mode,
        appliedTo: targetRange,
      });

      if (this.mode === "single") {
        this.reset();
      }

      return true;
    } catch (err) {
      clientLogger.error("FORMAT_PAINTER", "APPLY_STYLE_FAILED", err);
      return false;
    }
  }

  public reset() {
    this.mode = "inactive";
    this.copiedStyle = null;
    this.notify();
    clientLogger.action("FORMAT_PAINTER", "RESET_MODE");
  }
}

import * as XLSX from "xlsx";

/**
 * Robust, client-side Excel Formula Evaluator
 * Supports arithmetic, cell references (e.g. A1, B12), ranges (e.g. A1:A10, B2:D4),
 * and standard Excel functions (SUM, AVERAGE, COUNT, COUNTA, MAX, MIN, PRODUCT, ROUND, IF, IFERROR, CONCAT, CONCATENATE, UPPER, LOWER, TRIM, LEN, LEFT, RIGHT, MID, TODAY, NOW, ABS, SQRT, POWER, MOD).
 */

type CellValueProvider = (r: number, c: number) => any;

/**
 * Parses cell reference e.g. "A1" -> { r: 0, c: 0 }
 */
export function parseCellRef(ref: string): { r: number; c: number } | null {
  try {
    const clean = ref.trim().toUpperCase();
    if (!/^[A-Z]+[1-9]\d*$/.test(clean)) return null;
    const decoded = XLSX.utils.decode_cell(clean);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Parses range reference e.g. "A1:B3" -> array of coordinates
 */
export function parseRangeRef(rangeStr: string): Array<{ r: number; c: number }> {
  try {
    const clean = rangeStr.trim().toUpperCase();
    if (!clean.includes(":")) {
      const single = parseCellRef(clean);
      return single ? [single] : [];
    }
    const decodedRange = XLSX.utils.decode_range(clean);
    const coords: Array<{ r: number; c: number }> = [];
    for (let r = decodedRange.s.r; r <= decodedRange.e.r; r++) {
      for (let c = decodedRange.s.c; c <= decodedRange.e.c; c++) {
        coords.push({ r, c });
      }
    }
    return coords;
  } catch {
    return [];
  }
}

/**
 * Helper to get numeric value from a cell or literal
 */
function toNum(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).replace(/,/g, "").replace(/\s/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Helper to flatten arguments which may contain ranges or arrays
 */
function flattenArgs(args: any[], getVal: CellValueProvider): any[] {
  const result: any[] = [];
  for (const arg of args) {
    if (typeof arg === "string" && arg.includes(":")) {
      const coords = parseRangeRef(arg);
      for (const { r, c } of coords) {
        result.push(getVal(r, c));
      }
    } else if (typeof arg === "string" && parseCellRef(arg)) {
      const coord = parseCellRef(arg)!;
      result.push(getVal(coord.r, coord.c));
    } else if (Array.isArray(arg)) {
      result.push(...flattenArgs(arg, getVal));
    } else {
      result.push(arg);
    }
  }
  return result;
}

/**
 * Built-in Excel functions implementation
 */
const EXCEL_FUNCTIONS: Record<string, (args: any[], getVal: CellValueProvider) => any> = {
  SUM: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    return flat.reduce((acc, v) => acc + toNum(v), 0);
  },
  AVERAGE: (args, getVal) => {
    const flat = flattenArgs(args, getVal).filter((v) => v !== "" && v !== null && v !== undefined);
    if (flat.length === 0) return 0;
    const sum = flat.reduce((acc, v) => acc + toNum(v), 0);
    return sum / flat.length;
  },
  COUNT: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    return flat.filter((v) => typeof v === "number" || (!isNaN(Number(v)) && String(v).trim() !== "")).length;
  },
  COUNTA: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    return flat.filter((v) => v !== "" && v !== null && v !== undefined).length;
  },
  MAX: (args, getVal) => {
    const flat = flattenArgs(args, getVal).map(toNum);
    if (flat.length === 0) return 0;
    return Math.max(...flat);
  },
  MIN: (args, getVal) => {
    const flat = flattenArgs(args, getVal).map(toNum);
    if (flat.length === 0) return 0;
    return Math.min(...flat);
  },
  PRODUCT: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    if (flat.length === 0) return 0;
    return flat.reduce((acc, v) => acc * toNum(v), 1);
  },
  ROUND: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    const num = toNum(flat[0]);
    const decimals = flat.length > 1 ? toNum(flat[1]) : 0;
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  },
  ROUNDUP: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    const num = toNum(flat[0]);
    const decimals = flat.length > 1 ? toNum(flat[1]) : 0;
    const factor = Math.pow(10, decimals);
    return Math.ceil(num * factor) / factor;
  },
  ROUNDDOWN: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    const num = toNum(flat[0]);
    const decimals = flat.length > 1 ? toNum(flat[1]) : 0;
    const factor = Math.pow(10, decimals);
    return Math.floor(num * factor) / factor;
  },
  ABS: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    return Math.abs(toNum(flat[0]));
  },
  SQRT: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    const n = toNum(flat[0]);
    return n < 0 ? "#NUM!" : Math.sqrt(n);
  },
  POWER: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    return Math.pow(toNum(flat[0]), toNum(flat[1]));
  },
  MOD: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    const divisor = toNum(flat[1]);
    if (divisor === 0) return "#DIV/0!";
    return toNum(flat[0]) % divisor;
  },
  IF: (args, getVal) => {
    const condition = evaluateExpression(args[0], getVal);
    const isTrue = condition && condition !== 0 && condition !== "0" && condition !== "FALSE" && condition !== false;
    if (isTrue) {
      return args.length > 1 ? evaluateExpression(args[1], getVal) : true;
    } else {
      return args.length > 2 ? evaluateExpression(args[2], getVal) : false;
    }
  },
  IFERROR: (args, getVal) => {
    try {
      const val = evaluateExpression(args[0], getVal);
      if (typeof val === "string" && val.startsWith("#")) {
        return args.length > 1 ? evaluateExpression(args[1], getVal) : "";
      }
      return val;
    } catch {
      return args.length > 1 ? evaluateExpression(args[1], getVal) : "";
    }
  },
  CONCAT: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    return flat.join("");
  },
  CONCATENATE: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    return flat.join("");
  },
  UPPER: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    return String(flat[0] ?? "").toUpperCase();
  },
  LOWER: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    return String(flat[0] ?? "").toLowerCase();
  },
  TRIM: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    return String(flat[0] ?? "").trim();
  },
  LEN: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    return String(flat[0] ?? "").length;
  },
  LEFT: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    const str = String(flat[0] ?? "");
    const count = flat.length > 1 ? toNum(flat[1]) : 1;
    return str.slice(0, count);
  },
  RIGHT: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    const str = String(flat[0] ?? "");
    const count = flat.length > 1 ? toNum(flat[1]) : 1;
    return str.slice(Math.max(0, str.length - count));
  },
  MID: (args, getVal) => {
    const flat = flattenArgs(args, getVal);
    const str = String(flat[0] ?? "");
    const start = Math.max(1, toNum(flat[1])) - 1;
    const count = flat.length > 2 ? toNum(flat[2]) : str.length;
    return str.slice(start, start + count);
  },
  TODAY: () => {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  },
  NOW: () => {
    const d = new Date();
    return d.toLocaleString("vi-VN");
  },
};

/**
 * Tokenizes formula expression and handles function calls recursively
 */
function evaluateExpression(expr: any, getVal: CellValueProvider): any {
  if (typeof expr !== "string") return expr;
  let str = expr.trim();
  if (str.startsWith("=")) str = str.slice(1).trim();
  if (!str) return "";

  // Check if expression is a function call like SUM(A1:A10, B2)
  const fnMatch = str.match(/^([A-Z_]+)\s*\((.*)\)$/i);
  if (fnMatch) {
    const fnName = fnMatch[1].toUpperCase();
    const argsContent = fnMatch[2];
    if (EXCEL_FUNCTIONS[fnName]) {
      // Split args respecting inner parentheses and quotes
      const parsedArgs = splitFunctionArgs(argsContent);
      return EXCEL_FUNCTIONS[fnName](parsedArgs, getVal);
    }
  }

  // Replace function calls embedded within arithmetic expressions e.g. SUM(A1:A5) * 1.1 + B2
  let processed = str.replace(/([A-Z_]+)\s*\(([^()]+)\)/gi, (fullMatch, fnName, innerArgs) => {
    const upperFn = fnName.toUpperCase();
    if (EXCEL_FUNCTIONS[upperFn]) {
      const argsList = splitFunctionArgs(innerArgs);
      const val = EXCEL_FUNCTIONS[upperFn](argsList, getVal);
      return typeof val === "number" ? String(val) : `"${val}"`;
    }
    return fullMatch;
  });

  // Replace cell references (e.g. A1, B12, AA5) with their evaluated value
  processed = processed.replace(/\b([A-Z]+[1-9]\d*)\b/g, (match) => {
    const cell = parseCellRef(match);
    if (!cell) return match;
    const val = getVal(cell.r, cell.c);
    const num = toNum(val);
    return isNaN(num) ? "0" : String(num);
  });

  // Evaluate arithmetic and logical operators safely
  try {
    // Only allow safe characters: numbers, decimals, basic operators, parens, quotes, boolean comparisons
    if (/^[0-9+\-*/().\s^%&><=!|'"eE]+$/.test(processed)) {
      // Replace ^ with ** for power
      const sanitized = processed.replace(/\^/g, "**");
      // Use Function constructor for safe math evaluation
      const evaluated = new Function(`"use strict"; return (${sanitized});`)();
      if (typeof evaluated === "number") {
        if (!isFinite(evaluated)) return "#DIV/0!";
        // Round floating precision anomalies
        return Math.round(evaluated * 1e10) / 1e10;
      }
      return evaluated;
    }
  } catch (err) {
    // Return error tag if evaluation fails
    return "#VALUE!";
  }

  return processed;
}

/**
 * Splits function argument strings taking quotes and nested parens into account
 */
function splitFunctionArgs(str: string): string[] {
  const args: string[] = [];
  let current = "";
  let parenDepth = 0;
  let inQuote = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && (i === 0 || str[i - 1] !== "\\")) {
      inQuote = !inQuote;
      current += char;
    } else if (char === "(" && !inQuote) {
      parenDepth++;
      current += char;
    } else if (char === ")" && !inQuote) {
      parenDepth--;
      current += char;
    } else if ((char === "," || char === ";") && parenDepth === 0 && !inQuote) {
      args.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    args.push(current.trim());
  }
  return args;
}

/**
 * Evaluates a cell's display value given sheet data 2D array
 */
export function evaluateCellValue(
  rawVal: any,
  sheetData: any[][],
  visited = new Set<string>()
): { displayValue: string; isFormula: boolean; rawFormula: string } {
  if (rawVal === null || rawVal === undefined) {
    return { displayValue: "", isFormula: false, rawFormula: "" };
  }

  const str = String(rawVal);
  if (!str.startsWith("=")) {
    return { displayValue: str, isFormula: false, rawFormula: "" };
  }

  const getVal: CellValueProvider = (r, c) => {
    const key = `${r},${c}`;
    if (visited.has(key)) return 0; // Prevent circular reference loops
    visited.add(key);
    const raw = sheetData[r]?.[c] ?? "";
    const res = evaluateCellValue(raw, sheetData, new Set(visited));
    visited.delete(key);
    return res.displayValue;
  };

  try {
    const evalRes = evaluateExpression(str, getVal);
    const displayValue = evalRes === null || evalRes === undefined ? "" : String(evalRes);
    return { displayValue, isFormula: true, rawFormula: str };
  } catch {
    return { displayValue: "#ERROR!", isFormula: true, rawFormula: str };
  }
}

/**
 * Re-evaluates entire sheetData grid to calculate dynamic formulas
 */
export function evaluateSheetGrid(sheetData: any[][]): any[][] {
  if (!sheetData || sheetData.length === 0) return [];
  const result: any[][] = [];
  for (let r = 0; r < sheetData.length; r++) {
    const row = sheetData[r] || [];
    const newRow: any[] = [];
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (typeof val === "string" && val.startsWith("=")) {
        const { displayValue } = evaluateCellValue(val, sheetData);
        newRow.push(displayValue);
      } else {
        newRow.push(val);
      }
    }
    result.push(newRow);
  }
  return result;
}

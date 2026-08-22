/**
 * Formula Evaluator for SpreadsheetViewer
 * Evaluates parsed formula ASTs against spreadsheet data
 */

import type { ASTNode } from './formulaParser';

// Cell data accessor type
export type CellAccessor = (r: number, c: number) => string | number | null;

// Type for values that can be arrays (for range references)
export type EvalValue = string | number | null | (string | number | null)[];

export interface EvaluateContext {
  getCell: CellAccessor;
  getRange: (startR: number, startC: number, endR: number, endC: number) => (string | number | null)[];
  sheetData: (string | number | null)[][];
}

// Evaluate an AST node
export function evaluateAST(node: ASTNode | null, context: EvaluateContext): EvalValue {
  if (!node) return null;

  switch (node.type) {
    case 'NumberLiteral':
      return typeof node.value === 'number' ? node.value : parseFloat(String(node.value));

    case 'StringLiteral':
      return String(node.value);

    case 'CellReference':
      if (node.start) {
        return context.getCell(node.start.r, node.start.c);
      }
      return null;

    case 'RangeReference':
      // Return array for functions that need ranges
      if (node.start && node.end) {
        const values: (string | number | null)[] = [];
        for (let r = node.start.r; r <= node.end.r; r++) {
          for (let c = node.start.c; c <= node.end.c; c++) {
            values.push(context.getCell(r, c));
          }
        }
        return values;
      }
      return [];

    case 'BinaryExpression':
      return evaluateBinary(node, context);

    case 'UnaryExpression':
      return evaluateUnary(node, context);

    case 'FunctionCall':
      return evaluateFunction(node, context);

    default:
      return null;
  }
}

function evaluateBinary(node: ASTNode, context: EvaluateContext): EvalValue {
  const left = evaluateAST(node.left, context);
  const right = evaluateAST(node.right, context);

  // Convert to numbers for arithmetic
  const leftNum = toNumber(left);
  const rightNum = toNumber(right);

  // String concatenation with &
  if (node.operator === '&') {
    return String(left ?? '') + String(right ?? '');
  }

  // Comparison operators
  if (['=', '==', '!=', '<>', '<', '>', '<=', '>='].includes(node.operator || '')) {
    return compareValues(left, right, node.operator || '==');
  }

  // Arithmetic operators
  switch (node.operator) {
    case '+':
      return leftNum + rightNum;
    case '-':
      return leftNum - rightNum;
    case '*':
      return leftNum * rightNum;
    case '/':
      if (rightNum === 0) return '#DIV/0!';
      return leftNum / rightNum;
    case '%':
      return leftNum % rightNum;
    case '^':
      return Math.pow(leftNum, rightNum);
    default:
      return null;
  }
}

function evaluateUnary(node: ASTNode, context: EvaluateContext): string | number | null {
  const operand = evaluateAST(node.right, context);
  const num = toNumber(operand);

  switch (node.operator) {
    case '-':
      return -num;
    case '+':
      return num;
    default:
      return null;
  }
}

function evaluateFunction(node: ASTNode, context: EvaluateContext): EvalValue {
  const args = (node.arguments || []).map(arg => evaluateAST(arg, context));

  switch (node.name?.toUpperCase()) {
    // Math functions
    case 'SUM':
      return sum(args.flat());
    case 'AVERAGE':
    case 'AVG':
      return average(args.flat());
    case 'COUNT':
      return count(args.flat());
    case 'COUNTA':
      return countA(args.flat());
    case 'MAX':
      return max(args.flat());
    case 'MIN':
      return min(args.flat());
    case 'ABS':
      return Math.abs(toNumber(args[0]));
    case 'ROUND':
      return round(toNumber(args[0]), toNumber(args[1]) || 0);
    case 'ROUNDUP':
      return roundUp(toNumber(args[0]), toNumber(args[1]) || 0);
    case 'ROUNDDOWN':
      return roundDown(toNumber(args[0]), toNumber(args[1]) || 0);
    case 'SQRT':
      return Math.sqrt(toNumber(args[0]));
    case 'POWER':
      return Math.pow(toNumber(args[0]), toNumber(args[1]));
    case 'MOD':
      return mod(toNumber(args[0]), toNumber(args[1]));
    case 'SUMIF':
      return sumIf(args, context);
    case 'COUNTIF':
      return countIf(args, context);

    // Text functions
    case 'CONCATENATE':
    case 'CONCAT':
      return args.map(a => String(a ?? '')).join('');
    case 'LEFT':
      return String(args[0] ?? '').slice(0, toNumber(args[1]) || 1);
    case 'RIGHT':
      const str = String(args[0] ?? '');
      return str.slice(-(toNumber(args[1]) || 1));
    case 'MID':
      const s = String(args[0] ?? '');
      const start = toNumber(args[1]) - 1;
      const len = toNumber(args[2]);
      return s.slice(start, start + len);
    case 'LEN':
      return String(args[0] ?? '').length;
    case 'UPPER':
      return String(args[0] ?? '').toUpperCase();
    case 'LOWER':
      return String(args[0] ?? '').toLowerCase();
    case 'TRIM':
      return String(args[0] ?? '').trim();
    case 'SUBSTITUTE':
      return String(args[0] ?? '').replaceAll(String(args[1] ?? ''), String(args[2] ?? ''));
    case 'TEXT':
      return formatNumber(toNumber(args[0]), String(args[1] ?? '0'));

    // Date/Time functions
    case 'TODAY':
      return formatDate(new Date());
    case 'NOW':
      return formatDateTime(new Date());
    case 'DATE':
      return formatDate(new Date(toNumber(args[0]), toNumber(args[1]) - 1, toNumber(args[2])));

    // Logic functions
    case 'IF':
      if (toBoolean(args[0])) return args[1];
      return args[2];
    case 'IFERROR':
      if (isError(args[0])) return args[1];
      return args[0];
    case 'IFNA':
      if (isNA(args[0])) return args[1];
      return args[0];
    case 'AND':
      return args.every(a => toBoolean(a)) ? 1 : 0;
    case 'OR':
      return args.some(a => toBoolean(a)) ? 1 : 0;
    case 'NOT':
      return toBoolean(args[0]) ? 0 : 1;

    // Information functions
    case 'ISBLANK':
      return args[0] === null || args[0] === undefined || args[0] === '' ? 1 : 0;
    case 'ISNUMBER':
      return typeof args[0] === 'number' ? 1 : 0;
    case 'ISTEXT':
      return typeof args[0] === 'string' && !isNaN(toNumber(args[0])) ? 1 : 0;
    case 'ISERROR':
      return isError(args[0]) ? 1 : 0;
    case 'N':
      return toNumber(args[0]);
    case 'T':
      return typeof args[0] === 'string' ? args[0] : '';

    // Lookup functions
    case 'CHOOSE':
      const idx = toNumber(args[0]);
      return args[idx] ?? null;
    case 'INDEX':
      // INDEX(array, row_num, [col_num])
      const arr = args[0];
      if (Array.isArray(arr)) {
        const rowNum = toNumber(args[1]) || 1;
        const colNum = toNumber(args[2]) || 1;
        const cols = Math.max(...arr.map((_, i) => i % 10 + 1)); // Estimate cols
        const idx = (rowNum - 1) * cols + (colNum - 1);
        return arr[idx] ?? null;
      }
      return null;

    // Financial functions
    case 'PV':
      return pv(toNumber(args[0]), toNumber(args[1]), toNumber(args[2]));
    case 'FV':
      return fv(toNumber(args[0]), toNumber(args[1]), toNumber(args[2]));

    default:
      return `#NAME?`;
  }
}

// Helper functions

function toNumber(value: string | number | null | unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}

function toBoolean(value: string | number | null | unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    if (lower === 'yes') return true;
    if (lower === 'no') return false;
  }
  return toNumber(value) !== 0;
}

function compareValues(left: unknown, right: unknown, op: string): number {
  const leftNum = toNumber(left);
  const rightNum = toNumber(right);

  switch (op) {
    case '=':
    case '==':
      return left === right ? 1 : 0;
    case '!=':
    case '<>':
      return left !== right ? 1 : 0;
    case '<':
      return leftNum < rightNum ? 1 : 0;
    case '>':
      return leftNum > rightNum ? 1 : 0;
    case '<=':
      return leftNum <= rightNum ? 1 : 0;
    case '>=':
      return leftNum >= rightNum ? 1 : 0;
    default:
      return 0;
  }
}

function sum(values: (string | number | null)[]): number {
  return values.reduce<number>((acc, v) => acc + toNumber(v), 0);
}

function average(values: (string | number | null)[]): number {
  const nums = values.map(toNumber);
  const nonEmpty = nums.filter(v => v !== 0 || values[nums.indexOf(v)] !== null);
  if (nonEmpty.length === 0) return 0;
  return sum(values) / nonEmpty.length;
}

function count(values: (string | number | null)[]): number {
  return values.filter(v => typeof v === 'number' && !isNaN(v as number)).length;
}

function countA(values: (string | number | null)[]): number {
  return values.filter(v => v !== null && v !== undefined && v !== '').length;
}

function max(values: (string | number | null)[]): number {
  const nums = values.map(toNumber);
  return Math.max(...nums, -Infinity);
}

function min(values: (string | number | null)[]): number {
  const nums = values.map(toNumber);
  return Math.min(...nums, Infinity);
}

function round(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function roundUp(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.ceil(value * factor) / factor;
}

function roundDown(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.floor(value * factor) / factor;
}

function mod(a: number, b: number): number {
  if (b === 0) return 0;
  return a % b;
}

function sumIf(args: unknown[], context: EvaluateContext): number {
  // SUMIF(range, criteria, [sum_range])
  const range = args[0];
  const criteria = args[1];
  const sumRange = args[2] || range;

  if (!Array.isArray(range) || !Array.isArray(sumRange)) return 0;

  let total = 0;
  for (let i = 0; i < range.length; i++) {
    if (matchesCriteria(range[i], criteria)) {
      total += toNumber(sumRange[i]);
    }
  }
  return total;
}

function countIf(args: unknown[], context: EvaluateContext): number {
  // COUNTIF(range, criteria)
  const range = args[0];
  const criteria = args[1];

  if (!Array.isArray(range)) return 0;

  let count = 0;
  for (const value of range) {
    if (matchesCriteria(value, criteria)) {
      count++;
    }
  }
  return count;
}

function matchesCriteria(value: unknown, criteria: unknown): boolean {
  if (typeof criteria === 'string') {
    const crit = criteria.replace(/^=+/, '');
    if (crit.startsWith('>')) {
      return toNumber(value) > toNumber(crit.slice(1));
    }
    if (crit.startsWith('<')) {
      return toNumber(value) < toNumber(crit.slice(1));
    }
    if (crit.startsWith('>=')) {
      return toNumber(value) >= toNumber(crit.slice(2));
    }
    if (crit.startsWith('<=')) {
      return toNumber(value) <= toNumber(crit.slice(2));
    }
    if (crit.startsWith('<>') || crit.startsWith('!=')) {
      return String(value) !== crit.slice(2);
    }
    if (crit.startsWith('*') && crit.endsWith('*')) {
      return String(value).toLowerCase().includes(crit.slice(1, -1).toLowerCase());
    }
    return String(value).toLowerCase() === crit.toLowerCase();
  }
  return toNumber(value) === toNumber(criteria);
}

function isError(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return ['#DIV/0!', '#N/A', '#NAME?', '#NULL!', '#NUM!', '#REF!', '#VALUE!'].includes(value);
}

function isNA(value: unknown): boolean {
  return value === '#N/A';
}

function formatNumber(value: number, format: string): string {
  try {
    // Simple format patterns
    if (format.includes('0.00')) {
      return value.toFixed(2);
    }
    if (format.includes('0')) {
      return Math.round(value).toString();
    }
    return value.toString();
  } catch {
    return String(value);
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function pv(rate: number, nper: number, pmt: number): number {
  if (rate === 0) return -pmt * nper;
  return -pmt * (1 - Math.pow(1 + rate, -nper)) / rate;
}

function fv(rate: number, nper: number, pmt: number): number {
  if (rate === 0) return pmt * nper;
  return pmt * (Math.pow(1 + rate, nper) - 1) / rate;
}

// Main evaluation function
export function evaluateFormula(
  formula: string,
  sheetData: (string | number | null)[][],
  getCell?: CellAccessor
): EvalValue {
  // Import parser dynamically to avoid circular dependency
  const { parseFormula, isFormula } = require('./formulaParser');

  if (!isFormula(formula)) {
    return formula;
  }

  const result = parseFormula(formula);
  if (result.error || !result.ast) {
    return formula; // Return original if parse fails
  }

  const cellAccessor: CellAccessor = getCell || ((r, c) => {
    const row = sheetData[r];
    if (!row) return null;
    return row[c] ?? null;
  });

  const context: EvaluateContext = {
    getCell: cellAccessor,
    getRange: (startR, startC, endR, endC) => {
      const values: (string | number | null)[] = [];
      for (let r = startR; r <= endR; r++) {
        for (let c = startC; c <= endC; c++) {
          values.push(cellAccessor(r, c));
        }
      }
      return values;
    },
    sheetData,
  };

  try {
    const resultValue = evaluateAST(result.ast, context);
    // If result is an array (from range), convert to string or first element
    if (Array.isArray(resultValue)) {
      return resultValue.length > 0 ? resultValue[0] : '';
    }
    return resultValue;
  } catch {
    return '#ERROR!';
  }
}

// Check if a value is an error
export function isErrorValue(value: unknown): boolean {
  return isError(value);
}

// Get error message
export function getErrorMessage(error: string | null | unknown): string {
  if (!error) return '';
  if (typeof error === 'string' && error.endsWith('!')) {
    return error;
  }
  return '';
}

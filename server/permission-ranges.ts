const MAX_EXCEL_ROW = 1_048_576;
const MAX_EXCEL_COLUMN = 16_384;

export type StructureChange = {
  axis: "row" | "column";
  action: "insert" | "delete";
  index: number;
};

function columnToNumber(column: string): number {
  let value = 0;
  for (const char of column.toUpperCase()) {
    value = value * 26 + char.charCodeAt(0) - 64;
  }
  return value;
}

function numberToColumn(value: number): string {
  let column = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function parseCellRef(reference: string): { column: number; row: number } | null {
  const match = /^\$?([A-Za-z]{1,3})\$?([1-9]\d*)$/.exec(reference);
  if (!match) return null;

  const column = columnToNumber(match[1]);
  const row = Number(match[2]);
  if (column > MAX_EXCEL_COLUMN || row > MAX_EXCEL_ROW) return null;
  return { column, row };
}

function parseColumnRef(reference: string): number | null {
  const match = /^\$?([A-Za-z]{1,3})$/.exec(reference);
  if (!match) return null;

  const column = columnToNumber(match[1]);
  return column <= MAX_EXCEL_COLUMN ? column : null;
}

function parseRowRef(reference: string): number | null {
  const match = /^\$?([1-9]\d*)$/.exec(reference);
  if (!match) return null;

  const row = Number(match[1]);
  return row <= MAX_EXCEL_ROW ? row : null;
}

export function isValidCellRef(cellRef: string): boolean {
  return parseCellRef(cellRef) !== null;
}

export function isCellWithinRange(cellRef: string, rangeRef: string): boolean {
  const cell = parseCellRef(cellRef);
  if (!cell) return false;

  let normalizedRange: string;
  try {
    normalizedRange = normalizeRangeRef(rangeRef);
  } catch {
    return false;
  }

  if (normalizedRange === "*") return true;

  const [start, end = start] = normalizedRange.split(":");
  const startCell = parseCellRef(start);
  if (startCell) {
    const endCell = parseCellRef(end);
    return !!endCell &&
      cell.column >= startCell.column && cell.column <= endCell.column &&
      cell.row >= startCell.row && cell.row <= endCell.row;
  }

  const startColumn = parseColumnRef(start);
  if (startColumn !== null) {
    const endColumn = parseColumnRef(end);
    return endColumn !== null && cell.column >= startColumn && cell.column <= endColumn;
  }

  const startRow = parseRowRef(start);
  if (startRow !== null) {
    const endRow = parseRowRef(end);
    return endRow !== null && cell.row >= startRow && cell.row <= endRow;
  }

  return false;
}

function rangeBounds(rangeRef: string): [number, number, number, number] | null {
  const normalized = normalizeRangeRef(rangeRef);
  if (normalized === "*") return [1, 1, MAX_EXCEL_COLUMN, MAX_EXCEL_ROW];
  const [start, end = start] = normalized.split(":");
  const startCell = parseCellRef(start);
  if (startCell) {
    const endCell = parseCellRef(end);
    if (!endCell) return null;
    return [startCell.column, startCell.row, endCell.column, endCell.row];
  }

  const startColumn = parseColumnRef(start);
  const endColumn = parseColumnRef(end);
  if (startColumn !== null && endColumn !== null) {
    return [startColumn, 1, endColumn, MAX_EXCEL_ROW];
  }

  const startRow = parseRowRef(start);
  const endRow = parseRowRef(end);
  if (startRow !== null && endRow !== null) {
    return [1, startRow, MAX_EXCEL_COLUMN, endRow];
  }

  return null;
}

export function isRangeWithinRange(targetRef: string, permittedRef: string): boolean {
  try {
    const target = rangeBounds(targetRef);
    const permitted = rangeBounds(permittedRef);
    return !!target && !!permitted &&
      target[0] >= permitted[0] && target[1] >= permitted[1] &&
      target[2] <= permitted[2] && target[3] <= permitted[3];
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

export function rangesOverlap(firstRef: string, secondRef: string): boolean {
  try {
    const first = rangeBounds(firstRef);
    const second = rangeBounds(secondRef);
    return !!first && !!second &&
      first[0] <= second[2] && first[2] >= second[0] &&
      first[1] <= second[3] && first[3] >= second[1];
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

export function normalizeRangeRef(rangeRef: string): string {
  // Store one normalized A1 area per permission row; "*" represents the whole sheet.
  const reference = rangeRef.trim();
  if (reference === "*") return "*";
  if (!reference || reference.includes(",")) {
    throw new RangeError("A range_ref must contain exactly one A1 area.");
  }

  const cellRange = /^([^:]+)(?::([^:]+))?$/.exec(reference);
  if (!cellRange) {
    throw new RangeError(`Invalid A1 range: ${rangeRef}`);
  }

  const startCell = parseCellRef(cellRange[1]);
  if (startCell) {
    const endCell = cellRange[2] ? parseCellRef(cellRange[2]) : startCell;
    if (!endCell) throw new RangeError(`Invalid A1 range: ${rangeRef}`);

    const startColumn = Math.min(startCell.column, endCell.column);
    const endColumn = Math.max(startCell.column, endCell.column);
    const startRow = Math.min(startCell.row, endCell.row);
    const endRow = Math.max(startCell.row, endCell.row);
    const normalizedStart = `${numberToColumn(startColumn)}${startRow}`;
    if (startColumn === endColumn && startRow === endRow) return normalizedStart;
    return `${normalizedStart}:${numberToColumn(endColumn)}${endRow}`;
  }

  if (!cellRange[2]) {
    const column = parseColumnRef(cellRange[1]);
    if (column !== null) {
      const normalizedColumn = numberToColumn(column);
      return `${normalizedColumn}:${normalizedColumn}`;
    }
  }

  if (cellRange[2]) {
    const startColumn = parseColumnRef(cellRange[1]);
    const endColumn = parseColumnRef(cellRange[2]);
    if (startColumn !== null && endColumn !== null) {
      const left = Math.min(startColumn, endColumn);
      const right = Math.max(startColumn, endColumn);
      return `${numberToColumn(left)}:${numberToColumn(right)}`;
    }

    const startRow = parseRowRef(cellRange[1]);
    const endRow = parseRowRef(cellRange[2]);
    if (startRow !== null && endRow !== null) {
      return `${Math.min(startRow, endRow)}:${Math.max(startRow, endRow)}`;
    }
  }

  throw new RangeError(`Invalid A1 range: ${rangeRef}`);
}

export function transformRangeForStructureChange(
  rangeRef: string,
  change: StructureChange,
): string | null {
  const normalized = normalizeRangeRef(rangeRef);
  if (normalized === "*") return normalized;

  const [startRef, endRef = startRef] = normalized.split(":");
  const startCell = parseCellRef(startRef);
  const endCell = parseCellRef(endRef);
  const startColumn = startCell?.column ?? parseColumnRef(startRef);
  const endColumn = endCell?.column ?? parseColumnRef(endRef);
  const startRow = startCell?.row ?? parseRowRef(startRef);
  const endRow = endCell?.row ?? parseRowRef(endRef);

  let first: number;
  let last: number;
  if (change.axis === "row" && startRow !== null && endRow !== null) {
    first = startRow;
    last = endRow;
  } else if (change.axis === "column" && startColumn !== null && endColumn !== null) {
    first = startColumn;
    last = endColumn;
  } else {
    return normalized;
  }

  if (change.action === "insert") {
    if (change.index <= first) {
      first += 1;
      last += 1;
    } else if (change.index <= last) {
      last += 1;
    }
  } else if (change.index < first) {
    first -= 1;
    last -= 1;
  } else if (change.index <= last) {
    last -= 1;
    if (first > last) return null;
  }

  if (startCell && endCell) {
    if (change.axis === "row") {
      return normalizeRangeRef(`${numberToColumn(startCell.column)}${first}:${numberToColumn(endCell.column)}${last}`);
    }
    return normalizeRangeRef(`${numberToColumn(first)}${startCell.row}:${numberToColumn(last)}${endCell.row}`);
  }

  if (change.axis === "row") {
    return first === last ? String(first) : `${first}:${last}`;
  }
  const firstColumn = numberToColumn(first);
  const lastColumn = numberToColumn(last);
  return firstColumn === lastColumn ? `${firstColumn}:${firstColumn}` : `${firstColumn}:${lastColumn}`;
}

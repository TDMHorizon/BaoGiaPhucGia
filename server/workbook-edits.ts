import ExcelJS from "exceljs";
import { isCellWithinRange } from "./permission-ranges";

function parseCellValue(value: string): string | number | { formula: string } {
  if (value.startsWith("=") && value.length > 1) return { formula: value.slice(1) };
  const trimmed = value.trim();
  const number = Number(value);
  return trimmed !== "" && Number.isFinite(number) ? number : value;
}

export async function applyCellEditToWorkbookBuffer(
  source: Buffer,
  sheetName: string,
  cellRef: string,
  value: string,
): Promise<{ buffer: Buffer; oldValue: string }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(source);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" was not found in the workbook.`);
  }

  const cell = worksheet.getCell(cellRef);
  const targetCell = cell.isMerged ? cell.master : cell;
  const currentValue = targetCell.value;
  const oldValue =
    currentValue && typeof currentValue === "object" && "formula" in currentValue
      ? currentValue.result === undefined
        ? `=${currentValue.formula}`
        : String(currentValue.result)
      : currentValue instanceof Date
        ? currentValue.toISOString()
        : String(currentValue ?? "");
  targetCell.value = parseCellValue(value);
  workbook.calcProperties.fullCalcOnLoad = true;

  const updated = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(updated), oldValue };
}

export async function getCellEditAffectedRange(
  source: Buffer,
  sheetName: string,
  cellRef: string,
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(source);
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) throw new Error(`Worksheet "${sheetName}" was not found in the workbook.`);

  return worksheet.model.merges.find((merge) => isCellWithinRange(cellRef, merge)) ?? cellRef;
}

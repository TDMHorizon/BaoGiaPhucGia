import ExcelJS from "exceljs";
import { isCellWithinRange, isRangeWithinRange, rangesOverlap } from "./permission-ranges";
import type { ProjectPermissionGrant } from "./permissions";

const CELL_OR_RANGE_REFERENCE =
  /(?<![A-Z0-9_.])(?:(?:'((?:[^']|'')+)'|([A-Z_][A-Z0-9_.]*))!)?(\$?[A-Z]{1,3}\$?[1-9]\d*|\$?[A-Z]{1,3}|\$?[1-9]\d*)(?::(\$?[A-Z]{1,3}\$?[1-9]\d*|\$?[A-Z]{1,3}|\$?[1-9]\d*))?(?![A-Z0-9_(])/gi;

function formulaIsReadable(
  formula: string,
  currentSheet: string,
  grantsBySheet: Map<string, string[]>,
  hiddenBySheet: Map<string, string[]>,
): boolean {
  if (/\b(?:INDIRECT|OFFSET)\s*\(/i.test(formula)) return false;

  const formulaWithoutStrings = formula.replace(/"(?:[^"]|"")*"/g, '""');
  const remaining = formulaWithoutStrings.replace(
    CELL_OR_RANGE_REFERENCE,
    (reference, quotedSheet: string | undefined, unquotedSheet: string | undefined, first: string, second: string | undefined) => {
      const sheetName = (quotedSheet?.replace(/''/g, "'") || unquotedSheet || currentSheet).trim();
      const grants = grantsBySheet.get(sheetName) || [];
      const referencedRange = second ? `${first}:${second}` : first;
      if (
        !grants.some((grant) => isRangeWithinRange(referencedRange, grant)) ||
        (hiddenBySheet.get(sheetName) || []).some((hidden) => rangesOverlap(referencedRange, hidden))
      ) return "\u0000";
      return "";
    },
  );

  if (remaining.includes("\u0000")) return false;
  const withoutFunctions = remaining
    .replace(/\b[A-Z_][A-Z0-9_.]*(?=\s*\()/gi, "")
    .replace(/\b(?:TRUE|FALSE)\b/gi, "")
    .replace(/""/g, "");
  if (/[^\s\d.+\-*/^%(),;<>!=&]/.test(withoutFunctions)) return false;
  return true;
}

export async function createReadableWorkbookBuffer(
  source: Buffer,
  grants: ProjectPermissionGrant[],
  hiddenRanges: Array<{ sheetName: string; rangeRef: string }> = [],
): Promise<{ buffer: Buffer; sheetNames: string[] }> {
  const grantsBySheet = new Map<string, string[]>();
  for (const grant of grants) {
    if (!grant.canRead) continue;
    const sheetGrants = grantsBySheet.get(grant.sheetName) ?? [];
    sheetGrants.push(grant.rangeRef);
    grantsBySheet.set(grant.sheetName, sheetGrants);
  }
  const hiddenBySheet = new Map<string, string[]>();
  for (const hidden of hiddenRanges) {
    const sheetRanges = hiddenBySheet.get(hidden.sheetName) ?? [];
    sheetRanges.push(hidden.rangeRef);
    hiddenBySheet.set(hidden.sheetName, sheetRanges);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(source);
  const sheetNames = workbook.worksheets
    .map((worksheet) => worksheet.name)
    .filter((sheetName) => (grantsBySheet.get(sheetName)?.length ?? 0) > 0);
  const allowedSheets = new Set(sheetNames);

  for (const worksheet of [...workbook.worksheets]) {
    if (!allowedSheets.has(worksheet.name)) {
      workbook.removeWorksheet(worksheet.id);
      continue;
    }

    worksheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const address = cell.address;
        const cellGrants = grantsBySheet.get(worksheet.name) ?? [];
        const hidden = hiddenBySheet.get(worksheet.name) ?? [];
        if (
          !cellGrants.some((range) => isRangeWithinRange(address, range)) ||
          hidden.some((range) => isCellWithinRange(address, range))
        ) {
          cell.value = null;
          return;
        }

        const value = cell.value;
        if (
          value &&
          typeof value === "object" &&
          "formula" in value &&
          !formulaIsReadable(String(value.formula), worksheet.name, grantsBySheet, hiddenBySheet)
        ) {
          cell.value = null;
        }
      });
    });
  }

  if (workbook.worksheets.length === 0) {
    workbook.addWorksheet("Không có quyền xem");
    if (sheetNames.length === 0) sheetNames.push("Không có quyền xem");
  }

  const output = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(output), sheetNames };
}

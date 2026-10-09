import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { createReadableWorkbookBuffer } from "./workbook-access";

describe("readable workbook filtering", () => {
  it("removes ungranted sheets and cells before serializing the workbook", async () => {
    const workbook = new ExcelJS.Workbook();
    const visible = workbook.addWorksheet("Visible");
    visible.getCell("A1").value = "allowed value";
    visible.getCell("B1").value = "restricted value";
    visible.getCell("C1").value = { formula: "B1*2", result: 246 };
    visible.getCell("D1").value = { formula: "A1&\"!\"", result: "allowed value!" };
    visible.getCell("E1").value = { formula: "SUM(A1:A2)", result: 3 };
    visible.getCell("F1").value = { formula: "Other!A1", result: "cross-sheet secret" };
    visible.getCell("G1").value = { formula: "B1*2", result: 246 };
    visible.getCell("H1").value = { formula: 'INDIRECT("B1")', result: "dynamic reference secret" };
    visible.getCell("I1").value = { formula: "OFFSET(A1,0,1)", result: "offset reference secret" };
    workbook.addWorksheet("Other").getCell("A1").value = "cross-sheet secret";
    const source = Buffer.from(await workbook.xlsx.writeBuffer());

    const readable = await createReadableWorkbookBuffer(source, [
      { sheetName: "Visible", rangeRef: "A1:A2", canRead: true, canEdit: false },
      { sheetName: "Visible", rangeRef: "B1", canRead: true, canEdit: false },
      { sheetName: "Visible", rangeRef: "D1:E2", canRead: true, canEdit: false },
      { sheetName: "Visible", rangeRef: "G1", canRead: true, canEdit: false },
      { sheetName: "Visible", rangeRef: "H1:I1", canRead: true, canEdit: false },
    ], [{ sheetName: "Visible", rangeRef: "B1" }]);
    const filtered = new ExcelJS.Workbook();
    await filtered.xlsx.load(readable.buffer);
    const sheet = filtered.getWorksheet("Visible")!;

    expect(readable.sheetNames).toEqual(["Visible"]);
    expect(filtered.worksheets.map((worksheet) => worksheet.name)).toEqual(["Visible"]);
    expect(sheet.getCell("A1").value).toBe("allowed value");
    expect(sheet.getCell("B1").value).toBeNull();
    expect(sheet.getCell("C1").value).toBeNull();
    expect(sheet.getCell("D1").value).toEqual({ formula: 'A1&"!"', result: "allowed value!" });
    expect(sheet.getCell("E1").value).toEqual({ formula: "SUM(A1:A2)", result: 3 });
    expect(sheet.getCell("F1").value).toBeNull();
    expect(sheet.getCell("G1").value).toBeNull();
    expect(sheet.getCell("H1").value).toBeNull();
    expect(sheet.getCell("I1").value).toBeNull();
  });

  it("returns an empty placeholder workbook when the employee has no read grants", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Secret").getCell("A1").value = "private";
    const source = Buffer.from(await workbook.xlsx.writeBuffer());

    const readable = await createReadableWorkbookBuffer(source, []);
    const filtered = new ExcelJS.Workbook();
    await filtered.xlsx.load(readable.buffer);

    expect(readable.sheetNames).toEqual(["Không có quyền xem"]);
    expect(filtered.worksheets.map((worksheet) => worksheet.name)).toEqual(["Không có quyền xem"]);
    expect(filtered.getWorksheet("Không có quyền xem")!.getCell("A1").value).toBeNull();
  });

  it("clears formula results when they depend on a hidden cell on another sheet", async () => {
    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet("Summary");
    summary.getCell("A1").value = { formula: "Private!A1*2", result: 200 };
    const privateSheet = workbook.addWorksheet("Private");
    privateSheet.getCell("A1").value = 100;
    const source = Buffer.from(await workbook.xlsx.writeBuffer());

    const readable = await createReadableWorkbookBuffer(source, [
      { sheetName: "Summary", rangeRef: "A1", canRead: true, canEdit: false },
      { sheetName: "Private", rangeRef: "A1", canRead: true, canEdit: false },
    ], [{ sheetName: "Private", rangeRef: "A1" }]);
    const filtered = new ExcelJS.Workbook();
    await filtered.xlsx.load(readable.buffer);

    expect(filtered.getWorksheet("Private")!.getCell("A1").value).toBeNull();
    expect(filtered.getWorksheet("Summary")!.getCell("A1").value).toBeNull();
  });
});

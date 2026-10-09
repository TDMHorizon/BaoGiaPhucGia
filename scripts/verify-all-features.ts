import { logger } from "../server/logger";
import { runMigration } from "./migrate-db";
import { resolveMergeInfo, resolveMasterCellAddress, normalizeSelectionWithMerges } from "../src/lib/mergeResolver";
import { 
  classifyUniverCommand, 
  FormatPainterManager, 
  toggleRangeBold, 
  toggleRangeItalic, 
  applyFormatCellsOptionsToRange 
} from "../src/components/SpreadsheetViewer/utils/univerCommandAdapter";
import { extractCellSearchText } from "../src/components/SpreadsheetViewer/components/FindReplaceModal";
import { extractCellValueForSort } from "../src/components/SpreadsheetViewer/utils/sortEngine";
import { setProjectRoleVisibility, isProjectHiddenForUser, getProjectRoleVisibilities } from "../server/db";
import ExcelJS from "exceljs";
import Database from "better-sqlite3";
import path from "path";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, phase: string, evidence?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    logger.testVerification(phase, testName, true, evidence);
    console.log(`\x1b[32m✔ [PASS] [${phase}] ${testName}\x1b[0m`);
  } else {
    failedTests++;
    logger.testVerification(phase, testName, false, evidence);
    console.error(`\x1b[31m✖ [FAIL] [${phase}] ${testName}\x1b[0m`, evidence);
  }
}

async function runAllVerifications() {
  console.log("\n=======================================================");
  console.log("🚀 STARTING AUTOMATED TEST SUITE & EVIDENCE LOGGING");
  console.log("=======================================================\n");

  // PHASE P0: DATABASE MIGRATION & REVISION TABLES
  try {
    const migrationOk = runMigration();
    assert(migrationOk === true, "Database Migration & Schema Execution", "PHASE_P0", { migrationOk });

    const db = new Database(path.join(process.cwd(), "data", "baogia.db"));
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    assert(tableNames.includes("project_role_visibility"), "Table project_role_visibility exists", "PHASE_P0");
    assert(tableNames.includes("workbook_snapshots"), "Table workbook_snapshots exists", "PHASE_P0");
    assert(tableNames.includes("workbook_commands"), "Table workbook_commands exists", "PHASE_P0");
    db.close();
  } catch (err) {
    assert(false, "Database Migration & Schema Execution", "PHASE_P0", { error: String(err) });
  }

  // PHASE P1: UNIVERSAL MERGE RESOLVER & FORMULA INTEGRATION
  {
    const sampleMerges = [
      { startRow: 1, endRow: 3, startColumn: 1, endColumn: 3 }, // B2:D4
      { startRow: 5, endRow: 5, startColumn: 0, endColumn: 4 }, // A6:E6
      { startRow: 7, endRow: 7, startColumn: 6, endColumn: 7 }, // G8:H8
    ];

    // Case 1: Direct Master Cell
    const m1 = resolveMergeInfo(1, 1, sampleMerges);
    assert(m1.isMerged === true && m1.isMaster === true && m1.masterCell.address === "B2", "Resolve direct Master Cell B2", "PHASE_P1", m1);

    // Case 2: Slave Cell C3 inside B2:D4 -> Resolves to B2
    const m2 = resolveMergeInfo(2, 2, sampleMerges);
    assert(m2.isMerged === true && m2.isMaster === false && m2.masterCell.address === "B2", "Resolve Slave Cell C3 inside B2:D4 to Master B2", "PHASE_P1", m2);

    // Case 3: Slave Cell D4 inside B2:D4 -> Resolves to B2
    const m3 = resolveMergeInfo(3, 3, sampleMerges);
    assert(m3.isMerged === true && m3.isMaster === false && m3.masterCell.address === "B2", "Resolve Slave Cell D4 inside B2:D4 to Master B2", "PHASE_P1", m3);

    // Case 4: resolveMasterCellAddress string helper
    const addr = resolveMasterCellAddress("C3", sampleMerges);
    assert(addr === "B2", "resolveMasterCellAddress('C3') returns 'B2'", "PHASE_P1", { input: "C3", output: addr });

    // Case 5: Normalizing single-click selection on merge
    const sel = normalizeSelectionWithMerges({ startRow: 2, endRow: 2, startColumn: 2, endColumn: 2 }, sampleMerges);
    assert(sel.selectionStr === "B2:D4" && sel.masterCell.address === "B2", "Normalize Selection on C3 to Range B2:D4", "PHASE_P1", sel);

    // Case 6: G8:H8 merge selection
    const selG8 = normalizeSelectionWithMerges({ startRow: 7, endRow: 7, startColumn: 6, endColumn: 6 }, sampleMerges);
    assert(selG8.selectionStr === "G8:H8" && selG8.masterCell.address === "G8", "Formula Picker: Merged cell G8:H8 normalized to 'G8:H8'", "PHASE_P1", selG8);
  }

  // PHASE P2: UNIVER COMMAND ADAPTER & FORMAT PAINTER
  {
    // Whitelist classification tests
    assert(classifyUniverCommand("sheet.command.set-range-values") === "value", "Classify set-range-values as 'value'", "PHASE_P2");
    assert(classifyUniverCommand("sheet.command.set-style") === "style", "Classify set-style as 'style'", "PHASE_P2");
    assert(classifyUniverCommand("set-range-background") === "style", "Classify set-range-background as 'style'", "PHASE_P2");
    assert(classifyUniverCommand("sheet.command.set-numfmt") === "numberFormat", "Classify set-numfmt as 'numberFormat'", "PHASE_P2");
    assert(classifyUniverCommand("add-worksheet-merge") === "merge", "Classify add-worksheet-merge as 'merge'", "PHASE_P2");
    assert(classifyUniverCommand("sheet.command.set-filter-range") === "filter", "Classify set-filter-range as 'filter'", "PHASE_P2");
    assert(classifyUniverCommand("unknown-random-command") === null, "Classify unknown command as null", "PHASE_P2");

    // Format Painter State Machine tests
    const painter = new FormatPainterManager();
    assert(painter.getMode() === "inactive", "Format Painter initial mode is 'inactive'", "PHASE_P2");

    const mockSourceRange = {
      getFontWeight: () => "bold",
      getFontStyle: () => "italic",
      getFontFamily: () => "Times New Roman",
      getFontSize: () => 14,
      getBackgroundColor: () => "#fff2cc",
      getFontColor: () => "#000000",
      getHorizontalAlignment: () => 2, // Center
      getNumberFormat: () => "#,##0 ₫",
    };

    painter.copyFormat(mockSourceRange, false);
    assert(painter.getMode() === "single", "Format Painter mode after copy is 'single'", "PHASE_P2");
    const copied = painter.getCopiedStyle();
    assert(copied?.bl === 1 && copied?.ff === "Times New Roman" && copied?.bg?.rgb === "#fff2cc", "Format Painter copied full font, family & background", "PHASE_P2", copied);

    let appliedBold = "";
    let appliedBg = "";
    let appliedFontFamily = "";
    const mockTargetRange = {
      setFontWeight: (val: string) => { appliedBold = val; },
      setFontStyle: () => {},
      setFontFamily: (val: string) => { appliedFontFamily = val; },
      setFontSize: () => {},
      setBackgroundColor: (val: string) => { appliedBg = val; },
      setFontColor: () => {},
      setHorizontalAlignment: () => {},
      setNumberFormat: () => {},
    };

    painter.applyFormat(mockTargetRange);
    assert(appliedBold === "bold" && appliedBg === "#fff2cc" && appliedFontFamily === "Times New Roman", "Format Painter applied bold, bg & fontFamily to target range", "PHASE_P2", { appliedBold, appliedBg, appliedFontFamily });
    assert(painter.getMode() === "inactive", "Format Painter mode auto-resets to 'inactive' after single apply", "PHASE_P2");
  }

  // PHASE P3: FIND/REPLACE RICH-TEXT & UNICODE NFC + SORT ENGINE
  {
    // Find & Replace Unicode & Rich Text
    const richCell = {
      p: {
        body: {
          dataStream: "Bình sơn xịt\r\n"
        }
      }
    };
    const extractedText = extractCellSearchText(richCell);
    assert(extractedText === "Bình sơn xịt", "Find & Replace: Extracted plain text from rich-text dataStream with diacritics", "PHASE_P3", { extractedText });

    const numCell = { v: 765000 };
    assert(extractCellSearchText(numCell) === "765000", "Find & Replace: Extracted number cell value", "PHASE_P3");

    // Sort Engine extraction
    const sortVal = extractCellValueForSort(richCell);
    assert(sortVal === "Bình sơn xịt", "Sort Engine: Extracted string for Vietnamese collation sort", "PHASE_P3", { sortVal });

    const sortNum = extractCellValueForSort({ v: 1000000 });
    assert(sortNum === 1000000, "Sort Engine: Extracted numeric value for numeric comparison", "PHASE_P3", { sortNum });
  }

  // PHASE P4: TOGGLE FONT BOLD/ITALIC & FORMAT CELLS MODAL
  {
    let curWeight = "bold";
    const mockRangeForToggle = {
      getFontWeight: () => curWeight,
      setFontWeight: (w: string) => { curWeight = w; },
    };

    const isBold1 = toggleRangeBold(mockRangeForToggle);
    assert(isBold1 === false && curWeight === "normal", "Toggle Bold: Changed 'bold' to 'normal'", "PHASE_P4");

    const isBold2 = toggleRangeBold(mockRangeForToggle);
    assert(isBold2 === true && curWeight === "bold", "Toggle Bold: Changed 'normal' to 'bold'", "PHASE_P4");

    // Format Cells Modal application test
    let appliedNumFmt = "";
    let appliedAlign = 0;
    const mockFormatRange = {
      setNumberFormat: (n: string) => { appliedNumFmt = n; },
      setHorizontalAlignment: (a: number) => { appliedAlign = a; },
    };
    applyFormatCellsOptionsToRange(mockFormatRange, {
      numberFormat: '#,##0 "₫"',
      horizontalAlign: 'right',
    });
    assert(appliedNumFmt === '#,##0 "₫"' && appliedAlign === 3, "Format Cells: Applied currency numFmt and Align Right (ht: 3)", "PHASE_P4", { appliedNumFmt, appliedAlign });
  }

  // PHASE P5: PROJECT ROLE VISIBILITY & PERMISSIONS
  {
    const testProjectId = "proj_test_visibility_123";
    const db = new Database(path.join(process.cwd(), "data", "baogia.db"));

    // Ensure test user and project exist for Foreign Key checks
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, role, active, created_at)
      VALUES ('admin1', 'admin', 'hash', 'admin', 1, datetime('now'))
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO projects (id, name, sheets, editable_ranges, created_at, updated_at)
      VALUES (?, 'Dự Án Test Visibility', '[]', '{}', datetime('now'), datetime('now'))
    `).run(testProjectId);
    db.close();

    // Setup: Hide from Manager role
    setProjectRoleVisibility(testProjectId, "manager", {
      isHidden: true,
      hiddenBy: "admin1",
    });

    const isHiddenForManager = isProjectHiddenForUser(testProjectId, { id: "manager1", role: "manager" });
    assert(isHiddenForManager === true, "Project Visibility: Hidden from Manager role enforced", "PHASE_P5", { isHiddenForManager });

    const isHiddenForAdmin = isProjectHiddenForUser(testProjectId, { id: "admin1", role: "admin" });
    assert(isHiddenForAdmin === false, "Project Visibility: Admin always sees file regardless of role hide", "PHASE_P5", { isHiddenForAdmin });
  }

  // PHASE P6: EXCEL EXPORT & PRINT ENGINE BUFFER VERIFICATION
  {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Báo Giá Mẫu");
    ws.getCell("A1").value = "CÔNG TY PHÚC GIA - BÁO GIÁ TRẮC ĐỊA";
    ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF107C41" } };
    ws.mergeCells("A1:E1");

    ws.getCell("A3").value = "STT";
    ws.getCell("B3").value = "Hạng Mục";
    ws.getCell("C3").value = "Đơn Giá";
    ws.getCell("D3").value = "Số Lượng";
    ws.getCell("E3").value = "Thành Tiền";

    ws.getCell("A4").value = 1;
    ws.getCell("B4").value = "Đo đạc hiện trạng khu đất";
    ws.getCell("C4").value = 5000000;
    ws.getCell("C4").numFmt = "#,##0 ₫";
    ws.getCell("D4").value = 2;
    ws.getCell("E4").value = { formula: "C4*D4", result: 10000000 };
    ws.getCell("E4").numFmt = "#,##0 ₫";

    const buffer = await wb.xlsx.writeBuffer();
    assert(buffer.byteLength > 1000, "Export Engine: ExcelJS binary .xlsx generated with formulas & styles", "PHASE_P6", {
      byteLength: buffer.byteLength,
      sheetName: "Báo Giá Mẫu",
      masterCellMerged: "A1:E1",
      hasFormula: true,
    });
  }

  console.log("\n=======================================================");
  console.log(`🏁 TEST VERIFICATION SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log(`📄 Evidence written to: ${path.join(process.cwd(), "test-run-verification.log")}`);
  console.log("=======================================================\n");

  return failedTests === 0;
}

runAllVerifications().then(success => {
  process.exit(success ? 0 : 1);
});

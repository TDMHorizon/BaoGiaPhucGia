import ExcelJS from "exceljs";

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const base64Clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = atob(base64Clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function workbookToBase64(workbook: ExcelJS.Workbook): Promise<string> {
  const buffer = await workbook.xlsx.writeBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
}

export async function loadExcelJSWorkbook(base64: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const arrBuf = base64ToArrayBuffer(base64);
  await workbook.xlsx.load(arrBuf);
  return workbook;
}

export async function applyEditsWithExcelJS(
  base64: string,
  edits: any[]
): Promise<string> {
  const workbook = await loadExcelJSWorkbook(base64);
  edits.forEach((edit) => {
    // ExcelJS getWorksheet can accept sheet name or 1-based index.
    const ws = workbook.getWorksheet(edit.sheetName);
    if (ws) {
      updateMergedCellInExcelJS(ws, edit.cell, edit.newValue);
    }
  });
  return workbookToBase64(workbook);
}

export async function insertRowWithExcelJS(
  base64: string,
  sheetName: string,
  rowIndex: number // 0-based from UI
): Promise<string> {
  const workbook = await loadExcelJSWorkbook(base64);
  const ws = workbook.getWorksheet(sheetName);
  if (ws) {
    const excelRowIndex = rowIndex + 1; // Convert to 1-based for ExcelJS
    
    // Shift row heights of subsequent rows down
    const lastRowIndex = ws.actualRowCount;
    for (let r = lastRowIndex; r >= excelRowIndex; r--) {
      const currentRow = ws.getRow(r);
      const nextRow = ws.getRow(r + 1);
      if (currentRow && nextRow) {
        if (currentRow.height !== undefined && currentRow.height !== null) {
          nextRow.height = currentRow.height;
        }
      }
    }

    ws.insertRow(excelRowIndex, []);

    // Copy style from adjacent row
    const sourceRowIndex = excelRowIndex > 1 ? excelRowIndex - 1 : excelRowIndex + 1;
    const sourceRow = ws.getRow(sourceRowIndex);
    const newRow = ws.getRow(excelRowIndex);
    
    if (sourceRow && newRow) {
      if (sourceRow.height !== undefined && sourceRow.height !== null) {
        newRow.height = sourceRow.height;
      }
      sourceRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const targetCell = newRow.getCell(colNumber);
        targetCell.style = JSON.parse(JSON.stringify(cell.style || {}));
      });
    }
  }
  return workbookToBase64(workbook);
}

export async function deleteRowWithExcelJS(
  base64: string,
  sheetName: string,
  rowIndex: number // 0-based from UI
): Promise<string> {
  const workbook = await loadExcelJSWorkbook(base64);
  const ws = workbook.getWorksheet(sheetName);
  if (ws) {
    const excelRowIndex = rowIndex + 1;
    const lastRowIndex = ws.actualRowCount;

    // Shift row heights of subsequent rows up
    for (let r = excelRowIndex; r < lastRowIndex; r++) {
      const currentRow = ws.getRow(r);
      const nextRow = ws.getRow(r + 1);
      if (currentRow && nextRow) {
        if (nextRow.height !== undefined && nextRow.height !== null) {
          currentRow.height = nextRow.height;
        } else {
          currentRow.height = undefined as any;
        }
      }
    }

    ws.spliceRows(excelRowIndex, 1);
  }
  return workbookToBase64(workbook);
}

export async function insertColWithExcelJS(
  base64: string,
  sheetName: string,
  colIndex: number // 0-based from UI
): Promise<string> {
  const workbook = await loadExcelJSWorkbook(base64);
  const ws = workbook.getWorksheet(sheetName);
  if (ws) {
    const excelColIndex = colIndex + 1;

    // Shift column widths of subsequent columns right
    const lastColIndex = ws.columnCount;
    for (let c = lastColIndex; c >= excelColIndex; c--) {
      const currentCol = ws.getColumn(c);
      const nextCol = ws.getColumn(c + 1);
      if (currentCol && nextCol) {
        if (currentCol.width !== undefined && currentCol.width !== null) {
          nextCol.width = currentCol.width;
        }
      }
    }

    ws.spliceColumns(excelColIndex, 0, []);

    // Copy style details and width
    const sourceColIndex = excelColIndex > 1 ? excelColIndex - 1 : excelColIndex + 1;
    const sourceCol = ws.getColumn(sourceColIndex);
    const newCol = ws.getColumn(excelColIndex);
    if (sourceCol && newCol) {
      if (sourceCol.width !== undefined && sourceCol.width !== null) {
        newCol.width = sourceCol.width;
      }
    }

    ws.eachRow({ includeEmpty: true }, (row) => {
      const sourceCell = row.getCell(sourceColIndex);
      const targetCell = row.getCell(excelColIndex);
      if (sourceCell) {
        targetCell.style = JSON.parse(JSON.stringify(sourceCell.style || {}));
      }
    });
  }
  return workbookToBase64(workbook);
}

export async function deleteColWithExcelJS(
  base64: string,
  sheetName: string,
  colIndex: number // 0-based from UI
): Promise<string> {
  const workbook = await loadExcelJSWorkbook(base64);
  const ws = workbook.getWorksheet(sheetName);
  if (ws) {
    const excelColIndex = colIndex + 1;
    const lastColIndex = ws.columnCount;

    // Shift column widths of subsequent columns left
    for (let c = excelColIndex; c < lastColIndex; c++) {
      const currentCol = ws.getColumn(c);
      const nextCol = ws.getColumn(c + 1);
      if (currentCol && nextCol) {
        if (nextCol.width !== undefined && nextCol.width !== null) {
          currentCol.width = nextCol.width;
        } else {
          currentCol.width = undefined as any;
        }
      }
    }

    ws.spliceColumns(excelColIndex, 1);
  }
  return workbookToBase64(workbook);
}

export function updateMergedCellInExcelJS(ws: any, cellRef: string, value: any) {
  const cell = ws.getCell(cellRef);
  
  const valStr = value === null || value === undefined ? "" : String(value);
  const isNum = !isNaN(Number(valStr)) && valStr.trim() !== "";
  const typedVal = isNum ? Number(valStr) : valStr;

  // In ExcelJS, if a cell is part of a merge range, cell.master holds the actual (top-left) cell.
  // Setting the value of the master cell directly updates the merged value without unmerging or duplicating cell values.
  if (cell.master) {
    cell.master.value = typedVal;
  } else {
    cell.value = typedVal;
  }
}

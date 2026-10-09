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

const NODE_WATERMARK_PNG_BASE64 =
  "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";

/**
 * UC17: Tạo ảnh PNG Watermark chữ chìm "BẢN DỰ THẢO - CHƯA DUYỆT"
 * Sử dụng HTML5 Canvas để tạo ảnh có độ trong suốt và xoay nghiêng chuẩn xác khi chạy trên trình duyệt,
 * hoặc sử dụng chuỗi Base64 PNG chuẩn khi chạy phía Node.js / Server Export.
 */
export function createDraftWatermarkImageBase64(text = "BẢN DỰ THẢO - CHƯA DUYỆT"): string {
  if (typeof document === "undefined") {
    return NODE_WATERMARK_PNG_BASE64;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 650;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-32 * Math.PI) / 180);

  // Viền khung cảnh báo bản nháp
  ctx.strokeStyle = "rgba(239, 68, 68, 0.28)";
  ctx.lineWidth = 4;
  ctx.strokeRect(-280, -45, 560, 90);

  // Chữ watermark chính
  ctx.font = "bold 32px 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "rgba(220, 38, 38, 0.24)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, -8);

  // Phụ đề ngày xuất & mã bảo mật
  ctx.font = "italic 13px 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "rgba(100, 116, 139, 0.35)";
  ctx.fillText("PHÚC GIA SURVEY - BẢN THẢO NỘI BỘ KHÔNG CÓ GIÁ TRỊ PHÁP LÝ", 0, 22);

  ctx.restore();
  return canvas.toDataURL("image/png");
}

/**
 * UC17: Áp dụng Watermark dự thảo vào tất cả các Worksheet trong ExcelJS Workbook
 * Bao gồm hình nền chìm (background watermark) và Header/Footer in ấn A4.
 */
export function applyDraftWatermarkToWorkbook(
  workbook: ExcelJS.Workbook,
  watermarkText = "BẢN DỰ THẢO - CHƯA DUYỆT"
): void {
  const dataUrl = createDraftWatermarkImageBase64(watermarkText);
  let imageId: number | undefined;
  if (dataUrl) {
    const cleanBase64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    try {
      imageId = workbook.addImage({
        base64: cleanBase64,
        extension: "png",
      });
    } catch (err) {
      console.warn("[ExcelJS] Không thể nhúng ảnh watermark vào workbook:", err);
    }
  }

  workbook.eachSheet((ws) => {
    // 1. Áp watermark ảnh nền chìm toàn bộ bảng tính
    if (imageId !== undefined) {
      try {
        ws.addBackgroundImage(imageId);
      } catch (err) {
        console.warn("[ExcelJS] Không thể đặt addBackgroundImage cho sheet:", ws.name, err);
      }

      // 2. Thêm hình watermark nổi (Floating Drawing) hiển thị trực tiếp ở chế độ xem Normal View
      try {
        ws.addImage(imageId, {
          tl: { col: 1, row: 1 },
          ext: { width: 520, height: 260 },
          editAs: "oneCell",
        });
      } catch (err) {
        console.warn("[ExcelJS] Không thể nhúng floating watermark vào sheet:", ws.name, err);
      }
    }

    // 3. Cấu hình Header & Footer in ấn A4 chuẩn (bắt buộc theo đặc tả UC17)
    if (!ws.headerFooter) {
      (ws as any).headerFooter = {};
    }
    ws.headerFooter.oddHeader = `&C&"Arial,Bold"&22&KDC2626 *** ${watermarkText} ***`;
    ws.headerFooter.evenHeader = `&C&"Arial,Bold"&22&KDC2626 *** ${watermarkText} ***`;
    ws.headerFooter.oddFooter = `&R&"Arial,Italic"&10&K64748B Báo giá Phúc Gia - ${watermarkText} | Trang &P/&N`;
    ws.headerFooter.evenFooter = `&R&"Arial,Italic"&10&K64748B Báo giá Phúc Gia - ${watermarkText} | Trang &P/&N`;

    // 4. Đảm bảo hiển thị lưới khi in và cấu hình trang A4 chuẩn (bắt buộc theo đặc tả UC17 [P1-14])
    if (!ws.pageSetup) {
      (ws as any).pageSetup = {};
    }
    ws.pageSetup.paperSize = 9; // 9 = A4 paper size in Excel OpenXML
    ws.pageSetup.fitToPage = true;
    ws.pageSetup.showGridLines = true;
  });
}

/**
 * Clone một workbook độc lập để tránh làm bẩn workbook gốc đang mở trên editor
 */
export async function cloneExcelJSWorkbook(workbook: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const buffer = await workbook.xlsx.writeBuffer();
  const cloned = new ExcelJS.Workbook();
  await cloned.xlsx.load(buffer as any);
  return cloned;
}

import * as XLSX from "xlsx";

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

export function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
}

export function parseExcel(base64: string) {
  const file = base64ToFile(base64, "temp.xlsx");
  return new Promise<XLSX.WorkBook>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { 
        type: "array", 
        cellStyles: true, 
        cellNF: true, 
        cellDates: true, 
        cellFormula: true 
      });
      resolve(workbook);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function generateExcelBase64(workbook: XLSX.WorkBook): string {
  const wbout = XLSX.write(workbook, { 
    bookType: "xlsx", 
    type: "base64", 
    cellStyles: true 
  });
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbout}`;
}

export function findSheetByName(workbook: XLSX.WorkBook, name: string): XLSX.WorkSheet | null {
  if (!workbook || !workbook.Sheets || !name) return null;
  if (workbook.Sheets[name]) return workbook.Sheets[name];
  const target = name.trim().toLowerCase();
  for (const k of Object.keys(workbook.Sheets)) {
    if (k.trim().toLowerCase() === target) {
      return workbook.Sheets[k];
    }
  }
  return null;
}

export function getSheetData(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = findSheetByName(workbook, sheetName);
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
}

export function applyEditToSheetWithMergeClearing(sheet: XLSX.WorkSheet, cellRef: string, newValue: string) {
  const cell = XLSX.utils.decode_cell(cellRef);
  const valStr = newValue === null || newValue === undefined ? "" : String(newValue);
  const isNum = !isNaN(Number(valStr)) && valStr.trim() !== "";
  const typedVal = isNum ? Number(valStr) : valStr;
  const typeCode = isNum ? 'n' : 's';

  // Ensure sheet !ref encompasses this cell so sheet_to_json never truncates edited cells
  if (sheet['!ref']) {
    try {
      const range = XLSX.utils.decode_range(sheet['!ref']);
      if (cell.r > range.e.r) range.e.r = cell.r;
      if (cell.c > range.e.c) range.e.c = cell.c;
      if (cell.r < range.s.r) range.s.r = cell.r;
      if (cell.c < range.s.c) range.s.c = cell.c;
      sheet['!ref'] = XLSX.utils.encode_range(range);
    } catch {
      sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(50, cell.r), c: Math.max(30, cell.c) } });
    }
  }

  // Find if this cell is part of any merged range
  let foundMerge: any = null;
  if (sheet['!merges']) {
    for (const merge of sheet['!merges']) {
      if (cell.r >= merge.s.r && cell.r <= merge.e.r && cell.c >= merge.s.c && cell.c <= merge.e.c) {
        foundMerge = merge;
        break;
      }
    }
  }

  if (foundMerge) {
    // Set the master cell (top-left) of the merge
    const masterRef = XLSX.utils.encode_cell(foundMerge.s);
    if (!sheet[masterRef]) {
      sheet[masterRef] = { t: typeCode, v: typedVal };
    } else {
      const cObj = sheet[masterRef];
      cObj.t = typeCode;
      cObj.v = typedVal;
      delete cObj.w;
      delete cObj.r;
      delete cObj.f;
    }

    // Completely clear all other cells in the merged range to avoid duplicates
    for (let r = foundMerge.s.r; r <= foundMerge.e.r; r++) {
      for (let c = foundMerge.s.c; c <= foundMerge.e.c; c++) {
        if (r === foundMerge.s.r && c === foundMerge.s.c) continue; // skip master
        const otherRef = XLSX.utils.encode_cell({ r, c });
        delete sheet[otherRef];
      }
    }
  } else {
    // Standard unmerged cell edit
    if (!sheet[cellRef]) {
      sheet[cellRef] = { t: typeCode, v: typedVal };
    } else {
      const cObj = sheet[cellRef];
      cObj.t = typeCode;
      cObj.v = typedVal;
      delete cObj.w;
      delete cObj.r;
      delete cObj.f;
    }
  }
}

export function applyEditsToWorkbook(workbook: XLSX.WorkBook, edits: any[]) {
  edits.forEach(edit => {
    const sheet = findSheetByName(workbook, edit.sheetName);
    if (sheet) {
      applyEditToSheetWithMergeClearing(sheet, edit.cell, edit.newValue);
    }
  });
  return workbook;
}

export function downloadBase64File(base64: string, filename: string) {
  try {
    const base64Clean = base64.includes(",") ? base64.split(",")[1] : base64;
    const binaryString = atob(base64Clean);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) {
    console.error("Lỗi khi tải file base64:", e);
    // Fallback if Blob fails
    const link = document.createElement("a");
    link.href = base64;
    link.download = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

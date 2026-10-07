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

export function getSheetData(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
}

export function applyEditToSheetWithMergeClearing(sheet: XLSX.WorkSheet, cellRef: string, newValue: string) {
  const cell = XLSX.utils.decode_cell(cellRef);
  const valStr = newValue === null || newValue === undefined ? "" : String(newValue);
  const isNum = !isNaN(Number(valStr)) && valStr.trim() !== "";
  const typedVal = isNum ? Number(valStr) : valStr;
  const typeCode = isNum ? 'n' : 's';

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
    const sheet = workbook.Sheets[edit.sheetName];
    if (sheet) {
      applyEditToSheetWithMergeClearing(sheet, edit.cell, edit.newValue);
    }
  });
  return workbook;
}

export function downloadBase64File(base64: string, filename: string) {
  const link = document.createElement("a");
  link.href = base64;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

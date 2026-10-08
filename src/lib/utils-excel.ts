import * as XLSX from "xlsx";

export interface MergeInfo {
  shouldSkip: boolean;
  rowSpan?: number;
  colSpan?: number;
}

export function getCellMergeInfo(
  ws: XLSX.WorkSheet | undefined,
  r: number,
  c: number,
  ejWs?: any
): MergeInfo {
  // 1. Try SheetJS !merges first (highly accurate, flat list of merged coordinate ranges)
  if (ws && ws['!merges']) {
    for (const merge of ws['!merges']) {
      // Check if (r, c) is inside the merged range
      if (r >= merge.s.r && r <= merge.e.r && c >= merge.s.c && c <= merge.e.c) {
        // If it's the top-left cell of the merged range
        if (r === merge.s.r && c === merge.s.c) {
          return {
            shouldSkip: false,
            rowSpan: (merge.e.r - merge.s.r) + 1,
            colSpan: (merge.e.c - merge.s.c) + 1
          };
        } else {
          // It's part of the merged range but not the main cell, so we should skip rendering it
          return { shouldSkip: true };
        }
      }
    }
  }

  // 2. Fallback to ExcelJS isMerged check if SheetJS is missing merge details
  if (ejWs) {
    try {
      const cell = ejWs.getCell(r + 1, c + 1);
      if (cell && cell.isMerged) {
        const master = cell.master;
        if (master && master.address !== cell.address) {
          return { shouldSkip: true };
        }
        
        // Find rowSpan and colSpan from the worksheet merges model
        const merges = ejWs.model?.merges;
        if (merges && Array.isArray(merges)) {
          for (const mergeStr of merges) {
            const [startStr, endStr] = mergeStr.split(':');
            const startCell = decodeExcelJSAddress(startStr);
            const endCell = decodeExcelJSAddress(endStr);
            if (r >= startCell.r && r <= endCell.r && c >= startCell.c && c <= endCell.c) {
              return {
                shouldSkip: false,
                rowSpan: (endCell.r - startCell.r) + 1,
                colSpan: (endCell.c - startCell.c) + 1
              };
            }
          }
        }
        return { shouldSkip: false, rowSpan: 1, colSpan: 1 };
      }
    } catch (e) {
      console.error("Error calculating ExcelJS merge info:", e);
    }
  }

  return { shouldSkip: false };
}

function decodeExcelJSAddress(addr: string): { r: number; c: number } {
  const match = addr.match(/^([A-Z]+)([0-9]+)$/i);
  if (!match) return { r: 0, c: 0 };
  const colStr = match[1].toUpperCase();
  const rowStr = match[2];
  
  let c = 0;
  for (let i = 0; i < colStr.length; i++) {
    c = c * 26 + (colStr.charCodeAt(i) - 64);
  }
  c = c - 1; // 0-based
  const r = parseInt(rowStr, 10) - 1; // 0-based
  return { r, c };
}

export function getColumnWidth(ejWs: any, ws: XLSX.WorkSheet | undefined, c: number): number {
  // 1. Try ExcelJS first
  if (ejWs) {
    try {
      const col = ejWs.getColumn(c + 1);
      if (col && col.width !== undefined && col.width !== null) {
        // ExcelJS width is character count. Normal scale is width * 8 or 8.5px
        return Math.max(80, col.width * 8.5 + 10);
      }
    } catch (e) {
      console.error("Error reading col width from ExcelJS:", e);
    }
  }

  // 2. Fallback to SheetJS
  if (ws && ws['!cols'] && ws['!cols'][c]) {
    const colProps = ws['!cols'][c];
    if (colProps.wpx) return colProps.wpx;
    if (colProps.wch) return colProps.wch * 8.5 + 10;
    if (colProps.width) return colProps.width * 8.5 + 10;
  }

  return 150; // default column width representing clean grid
}

export function getRowHeight(ejWs: any, ws: XLSX.WorkSheet | undefined, r: number): number | undefined {
  // 1. Try ExcelJS first
  if (ejWs) {
    try {
      const row = ejWs.getRow(r + 1);
      if (row && row.height !== undefined && row.height !== null) {
        // ExcelJS height is program height in points. 1 point = 1.33 px.
        return row.height * 1.33;
      }
    } catch (e) {
      console.error("Error reading row height from ExcelJS:", e);
    }
  }

  // 2. Fallback to SheetJS
  if (ws && ws['!rows'] && ws['!rows'][r]) {
    const rowProps = ws['!rows'][r];
    if (rowProps.hpx) return rowProps.hpx;
    if (rowProps.hpt) return rowProps.hpt * 1.33;
  }

  return undefined; // default CSS behavior
}

export function isCellInRange(cellRef: string, rangeStr: string): boolean {
  if (!rangeStr?.trim()) return false;
  try {
    const ranges = rangeStr.split(',').map(r => r.trim()).filter(Boolean);
    if (ranges.length === 0) return false;

    const cell = XLSX.utils.decode_cell(cellRef);

    return ranges.some(rStr => {
      if (rStr === '*') return true;

      // Handle full column ranges like "A:A" or "A:C"
      if (/^[A-Za-z]+:[A-Za-z]+$/.test(rStr)) {
        const [startCol, endCol] = rStr.split(':');
        const sColIdx = XLSX.utils.decode_col(startCol);
        const eColIdx = XLSX.utils.decode_col(endCol);
        return cell.c >= sColIdx && cell.c <= eColIdx;
      }

      // Handle full row ranges like "1:1" or "1:5"
      if (/^[1-9]\d*:[1-9]\d*$/.test(rStr)) {
        const [startRow, endRow] = rStr.split(':').map(Number);
        return cell.r >= Math.min(startRow, endRow) - 1 &&
          cell.r <= Math.max(startRow, endRow) - 1;
      }

      // Handle single column like "A"
      if (/^[A-Za-z]+$/.test(rStr)) {
        const colIdx = XLSX.utils.decode_col(rStr);
        return cell.c === colIdx;
      }

      const range = XLSX.utils.decode_range(rStr);
      return (
        cell.r >= range.s.r &&
        cell.r <= range.e.r &&
        cell.c >= range.s.c &&
        cell.c <= range.e.c
      );
    });
  } catch (e) {
    return false;
  }
}

export function insertRowInSheet(ws: XLSX.WorkSheet, rowIndex: number): void {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const R_max = range.e.r;

  // Map to a temporary array of cell updates to avoid overwrite midway
  const cellKeys = Object.keys(ws).filter(k => k[0] !== '!');
  const cellsData: { [key: string]: any } = {};

  cellKeys.forEach(key => {
    const cellRef = XLSX.utils.decode_cell(key);
    if (cellRef.r >= rowIndex) {
      const newKey = XLSX.utils.encode_cell({ r: cellRef.r + 1, c: cellRef.c });
      cellsData[newKey] = ws[key];
      delete ws[key];
    } else {
      cellsData[key] = ws[key];
      delete ws[key];
    }
  });

  Object.assign(ws, cellsData);

  // Update ref
  range.e.r = R_max + 1;
  ws['!ref'] = XLSX.utils.encode_range(range);

  // Update merges
  if (ws['!merges']) {
    ws['!merges'] = ws['!merges'].map(m => {
      const s = m.s;
      const e = m.e;
      let newS_r = s.r;
      let newE_r = e.r;
      if (s.r >= rowIndex) newS_r = s.r + 1;
      if (e.r >= rowIndex) newE_r = e.r + 1;
      return { s: { r: newS_r, c: s.c }, e: { r: newE_r, c: e.c } };
    });
  }

  // Update row heights
  if (ws['!rows']) {
    ws['!rows'].splice(rowIndex, 0, ws['!rows'][rowIndex] ? { ...ws['!rows'][rowIndex] } : {});
  }
}

export function deleteRowInSheet(ws: XLSX.WorkSheet, rowIndex: number): void {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const R_max = range.e.r;

  const cellKeys = Object.keys(ws).filter(k => k[0] !== '!');
  const cellsData: { [key: string]: any } = {};

  cellKeys.forEach(key => {
    const cellRef = XLSX.utils.decode_cell(key);
    if (cellRef.r === rowIndex) {
      delete ws[key];
    } else if (cellRef.r > rowIndex) {
      const newKey = XLSX.utils.encode_cell({ r: cellRef.r - 1, c: cellRef.c });
      cellsData[newKey] = ws[key];
      delete ws[key];
    } else {
      cellsData[key] = ws[key];
      delete ws[key];
    }
  });

  Object.assign(ws, cellsData);

  if (R_max > 0) {
    range.e.r = R_max - 1;
    ws['!ref'] = XLSX.utils.encode_range(range);
  }

  if (ws['!merges']) {
    ws['!merges'] = ws['!merges']
      .filter(m => !(m.s.r === rowIndex && m.e.r === rowIndex))
      .map(m => {
        const s = m.s;
        const e = m.e;
        let newS_r = s.r;
        let newE_r = e.r;
        if (s.r > rowIndex) {
          newS_r = s.r - 1;
        } else if (s.r === rowIndex) {
          newS_r = Math.max(0, s.r - 1);
        }
        if (e.r >= rowIndex) {
          newE_r = Math.max(0, e.r - 1);
        }
        return { s: { r: newS_r, c: s.c }, e: { r: newE_r, c: e.c } };
      });
  }

  if (ws['!rows']) {
    ws['!rows'].splice(rowIndex, 1);
  }
}

export function insertColInSheet(ws: XLSX.WorkSheet, colIndex: number): void {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const C_max = range.e.c;

  const cellKeys = Object.keys(ws).filter(k => k[0] !== '!');
  const cellsData: { [key: string]: any } = {};

  cellKeys.forEach(key => {
    const cellRef = XLSX.utils.decode_cell(key);
    if (cellRef.c >= colIndex) {
      const newKey = XLSX.utils.encode_cell({ r: cellRef.r, c: cellRef.c + 1 });
      cellsData[newKey] = ws[key];
      delete ws[key];
    } else {
      cellsData[key] = ws[key];
      delete ws[key];
    }
  });

  Object.assign(ws, cellsData);

  range.e.c = C_max + 1;
  ws['!ref'] = XLSX.utils.encode_range(range);

  if (ws['!merges']) {
    ws['!merges'] = ws['!merges'].map(m => {
      const s = m.s;
      const e = m.e;
      let newS_c = s.c;
      let newE_c = e.c;
      if (s.c >= colIndex) newS_c = s.c + 1;
      if (e.c >= colIndex) newE_c = e.c + 1;
      return { s: { r: s.r, c: newS_c }, e: { r: e.r, c: newE_c } };
    });
  }

  if (ws['!cols']) {
    ws['!cols'].splice(colIndex, 0, ws['!cols'][colIndex] ? { ...ws['!cols'][colIndex] } : {});
  }
}

export function deleteColInSheet(ws: XLSX.WorkSheet, colIndex: number): void {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const C_max = range.e.c;

  const cellKeys = Object.keys(ws).filter(k => k[0] !== '!');
  const cellsData: { [key: string]: any } = {};

  cellKeys.forEach(key => {
    const cellRef = XLSX.utils.decode_cell(key);
    if (cellRef.c === colIndex) {
      delete ws[key];
    } else if (cellRef.c > colIndex) {
      const newKey = XLSX.utils.encode_cell({ r: cellRef.r, c: cellRef.c - 1 });
      cellsData[newKey] = ws[key];
      delete ws[key];
    } else {
      cellsData[key] = ws[key];
      delete ws[key];
    }
  });

  Object.assign(ws, cellsData);

  if (C_max > 0) {
    range.e.c = C_max - 1;
    ws['!ref'] = XLSX.utils.encode_range(range);
  }

  if (ws['!merges']) {
    ws['!merges'] = ws['!merges']
      .filter(m => !(m.s.c === colIndex && m.e.c === colIndex))
      .map(m => {
        const s = m.s;
        const e = m.e;
        let newS_c = s.c;
        let newE_c = e.c;
        if (s.c > colIndex) {
          newS_c = s.c - 1;
        } else if (s.c === colIndex) {
          newS_c = Math.max(0, s.c - 1);
        }
        if (e.c >= colIndex) {
          newE_c = Math.max(0, e.c - 1);
        }
        return { s: { r: s.r, c: newS_c }, e: { r: e.r, c: newE_c } };
      });
  }

  if (ws['!cols']) {
    ws['!cols'].splice(colIndex, 1);
  }
}

export function getCellExcelJSStyle(ejWs: any, r: number, c: number): Record<string, any> {
  const style: Record<string, any> = {};
  if (!ejWs) return style;

  try {
    const cell = ejWs.getCell(r + 1, c + 1);
    if (cell) {
      // Font properties
      if (cell.font) {
        if (cell.font.bold) style.fontWeight = 'bold';
        if (cell.font.italic) style.fontStyle = 'italic';
        if (cell.font.color?.argb) {
          style.color = argbToCssHex(cell.font.color.argb);
        }
        if (cell.font.size) {
          style.fontSize = `${Math.max(10, cell.font.size * 1.15)}px`;
        }
        
        let textDec = '';
        if (cell.font.underline) textDec += 'underline ';
        if (cell.font.strike) textDec += 'line-through ';
        if (textDec.trim()) style.textDecoration = textDec.trim();
      }

      // Fill background color
      if (cell.fill && cell.fill.type === 'pattern' && cell.fill.pattern === 'solid') {
        const fgColor = cell.fill.fgColor;
        if (fgColor?.argb) {
          style.backgroundColor = argbToCssHex(fgColor.argb);
        }
      }

      // Alignments
      if (cell.alignment) {
        const align = cell.alignment;
        if (align.horizontal) {
          if (align.horizontal === 'left') style.textAlign = 'left';
          else if (align.horizontal === 'center') style.textAlign = 'center';
          else if (align.horizontal === 'right') style.textAlign = 'right';
          else if (align.horizontal === 'justify') style.textAlign = 'justify';
        }
        
        if (align.vertical) {
          if (align.vertical === 'top') style.verticalAlign = 'top';
          else if (align.vertical === 'middle') style.verticalAlign = 'middle';
          else if (align.vertical === 'bottom') style.verticalAlign = 'bottom';
        }

        if (align.wrapText) {
          style.whiteSpace = 'pre-wrap';
          style.wordBreak = 'break-word';
        }

        // Text Orientation / Rotation
        const rot = align.textRotation;
        if (rot !== undefined && rot !== null) {
          if (rot === 'vertical' || rot === 255) {
            style.writingMode = 'vertical-lr';
            style.textOrientation = 'upright';
            style.display = 'inline-flex';
            style.alignItems = 'center';
            style.justifyContent = 'center';
          } else if (rot === 90) {
            style.writingMode = 'vertical-rl';
            style.transform = 'rotate(180deg)';
            style.display = 'inline-flex';
            style.alignItems = 'center';
            style.justifyContent = 'center';
          } else if (rot === -90) {
            style.writingMode = 'vertical-rl';
            style.display = 'inline-flex';
            style.alignItems = 'center';
            style.justifyContent = 'center';
          } else if (typeof rot === 'number' && rot !== 0) {
            style.transform = `rotate(${-rot}deg)`;
            style.display = 'inline-block';
            style.transformOrigin = 'center';
          }
        }
      }
    }
  } catch (error) {
    console.error("Lỗi khi đọc CSS từ cell ExcelJS:", error);
  }

  return style;
}

function argbToCssHex(argbObj: any): string | undefined {
  if (typeof argbObj === 'string') {
    let raw = argbObj;
    if (raw.length === 8) {
      return `#${raw.substring(2)}`;
    } else if (raw.length === 6) {
      return `#${raw}`;
    }
  }
  if (argbObj && typeof argbObj === 'object' && argbObj.argb) {
    let raw = String(argbObj.argb);
    if (raw.length === 8) return `#${raw.substring(2)}`;
    if (raw.length === 6) return `#${raw}`;
  }
  return undefined;
}

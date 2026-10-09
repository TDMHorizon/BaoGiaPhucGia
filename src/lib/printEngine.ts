import { clientLogger } from './logger';

export interface PrintOptions {
  univerAPI: any;
  activeSheet: string;
  orientation?: 'portrait' | 'landscape';
  title?: string;
}

/**
 * Render bảng tính thành HTML Table chuẩn khổ in ấn A4 (Dọc/Ngang) và gọi window.print()
 */
export function printSpreadsheetDirectly(options: PrintOptions) {
  const { univerAPI, activeSheet, orientation = 'portrait', title = 'Bảng Báo Giá Phúc Gia' } = options;
  clientLogger.action("PRINT_ENGINE", "START_PRINT_PREPARATION", { activeSheet, orientation });

  try {
    const fWorkbook = univerAPI?.getActiveWorkbook?.();
    const ws = fWorkbook?.getSheetByName(activeSheet) || fWorkbook?.getActiveSheet();

    if (!ws) {
      alert("Không tìm thấy dữ liệu sheet để in ấn.");
      return;
    }

    const snapshot = ws.getSnapshot?.() || {};
    const cellData = snapshot.cellData || {};
    const mergeData = snapshot.mergeData || [];

    // Tìm bounds dữ liệu
    const rowKeys = Object.keys(cellData).map(k => parseInt(k, 10)).sort((a, b) => a - b);
    if (rowKeys.length === 0) {
      alert("Bảng tính rỗng, không có dữ liệu để in.");
      return;
    }

    const maxRow = Math.max(...rowKeys);
    let maxCol = 0;
    rowKeys.forEach(r => {
      const colKeys = Object.keys(cellData[r]).map(k => parseInt(k, 10));
      if (colKeys.length > 0) {
        maxCol = Math.max(maxCol, ...colKeys);
      }
    });

    // Map các ô merge để tính rowSpan / colSpan / skip
    const mergeMap = new Map<string, { rowSpan?: number; colSpan?: number; skip?: boolean }>();
    mergeData.forEach((m: any) => {
      const masterKey = `${m.startRow}_${m.startColumn}`;
      mergeMap.set(masterKey, {
        rowSpan: m.endRow - m.startRow + 1,
        colSpan: m.endColumn - m.startColumn + 1,
      });

      for (let r = m.startRow; r <= m.endRow; r++) {
        for (let c = m.startColumn; c <= m.endColumn; c++) {
          if (r !== m.startRow || c !== m.startColumn) {
            mergeMap.set(`${r}_${c}`, { skip: true });
          }
        }
      }
    });

    // Render HTML Table rows
    let tableRowsHtml = '';
    for (let r = 0; r <= maxRow; r++) {
      const rowObj = cellData[r] || {};
      let rowCellsHtml = '';

      for (let c = 0; c <= maxCol; c++) {
        const mInfo = mergeMap.get(`${r}_${c}`);
        if (mInfo?.skip) continue;

        const cell = rowObj[c];
        const val = cell?.v !== undefined ? String(cell.v) : '';
        const s = cell?.s || {};

        const boldStyle = s.bl ? 'font-weight: bold;' : '';
        const italicStyle = s.it ? 'font-style: italic;' : '';
        const alignStyle = s.ht === 2 ? 'text-align: center;' : s.ht === 3 ? 'text-align: right;' : 'text-align: left;';
        const bgStyle = s.bg?.rgb ? `background-color: ${s.bg.rgb};` : '';
        const colorStyle = s.cl?.rgb ? `color: ${s.cl.rgb};` : '';
        const borderStyle = 'border: 1px solid #cbd5e1;';
        const paddingStyle = 'padding: 4px 6px;';

        const rowSpanAttr = mInfo?.rowSpan && mInfo.rowSpan > 1 ? ` rowspan="${mInfo.rowSpan}"` : '';
        const colSpanAttr = mInfo?.colSpan && mInfo.colSpan > 1 ? ` colspan="${mInfo.colSpan}"` : '';

        rowCellsHtml += `<td${rowSpanAttr}${colSpanAttr} style="${borderStyle} ${paddingStyle} ${boldStyle} ${italicStyle} ${alignStyle} ${bgStyle} ${colorStyle}">${val || '&nbsp;'}</td>`;
      }

      tableRowsHtml += `<tr>${rowCellsHtml}</tr>`;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Vui lòng cho phép mở popup để in ấn.");
      return;
    }

    const pageCss = orientation === 'landscape'
      ? '@page { size: A4 landscape; margin: 10mm; }'
      : '@page { size: A4 portrait; margin: 10mm; }';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${activeSheet}</title>
          <style>
            ${pageCss}
            * { box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              font-size: 10.5pt;
              line-height: 1.3;
              margin: 0;
              padding: 0;
              color: #1e293b;
            }
            .header-banner {
              text-align: center;
              margin-bottom: 12px;
              border-bottom: 2px solid #107c41;
              padding-bottom: 8px;
            }
            .header-banner h1 {
              font-size: 14pt;
              margin: 0 0 4px 0;
              color: #107c41;
              text-transform: uppercase;
            }
            .header-banner .sheet-name {
              font-size: 10pt;
              font-weight: 600;
              color: #64748b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            tfoot {
              display: table-footer-group;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <h1>Công Ty Phúc Gia - Bảng Báo Giá</h1>
            <div class="sheet-name">Biểu mẫu: ${activeSheet}</div>
          </div>
          <table>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      clientLogger.action("PRINT_ENGINE", "TRIGGER_WINDOW_PRINT_SUCCESS");
    }, 500);

  } catch (error) {
    clientLogger.error("PRINT_ENGINE", "PRINT_FAILED", error);
    alert("Có lỗi khi chuẩn bị bản in.");
  }
}

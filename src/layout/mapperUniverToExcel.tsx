import * as ExcelJS from 'exceljs';

// Hàm chuyển đổi mã màu HEX (của Univer: #FF0000) sang ARGB (của ExcelJS: FFFF0000)
const hexToArgb = (hex: string) => {
  if (!hex) return undefined;
  const cleanHex = hex.replace('#', '');
  return cleanHex.length === 6 ? `FF${cleanHex}` : cleanHex;
};

export const syncUniverToExcelJS = (univerSnapshot: any, exceljsWorkbook: ExcelJS.Workbook) => {
  // Lấy danh sách các style dùng chung trong Univer
  const styles = univerSnapshot.styles || {};

  Object.values(univerSnapshot.sheets).forEach((univerSheet: any) => {
    const ws = exceljsWorkbook.getWorksheet(univerSheet.name);
    if (!ws) return;

    const cellData = univerSheet.cellData;
    if (!cellData) return;

    // Duyệt qua từng hàng và từng ô trong Univer
    Object.keys(cellData).forEach((rowStr) => {
      const rowIndex = parseInt(rowStr);
      const rowCols = cellData[rowStr];

      Object.keys(rowCols).forEach((colStr) => {
        const colIndex = parseInt(colStr);
        const cell = rowCols[colStr];
        
        // ExcelJS tính index bắt đầu từ 1, Univer bắt đầu từ 0
        const excelCell = ws.getCell(rowIndex + 1, colIndex + 1);

        // Cập nhật giá trị
        if (cell.v !== undefined) {
          excelCell.value = cell.v;
        }

        // Cập nhật định dạng (nếu ô có style)
        if (cell.s) {
          // Lấy object style từ ID hoặc trực tiếp từ ô
          const styleObj = typeof cell.s === 'string' ? styles[cell.s] : cell.s;
          
          if (styleObj) {
            excelCell.font = excelCell.font || {};
            
            // 1. Chỉnh cỡ chữ (Font Size) - Univer dùng thuộc tính 'fs'
            if (styleObj.fs) {
              excelCell.font.size = styleObj.fs;
            }
            
            // 2. Chỉnh màu chữ (Color) - Univer dùng thuộc tính 'cl'
            if (styleObj.cl?.rgb) {
              excelCell.font.color = { argb: hexToArgb(styleObj.cl.rgb) };
            }
            
            // 3. Chỉnh in đậm (Bold) - Univer dùng thuộc tính 'bl'
            if (styleObj.bl === 1) {
              excelCell.font.bold = true;
            }
            
            // 4. Chỉnh màu nền (Background) - Univer dùng 'bg'
            if (styleObj.bg?.rgb) {
              excelCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: hexToArgb(styleObj.bg.rgb) }
              };
            }
          }
        }
      });
    });
  });

  return exceljsWorkbook;
};
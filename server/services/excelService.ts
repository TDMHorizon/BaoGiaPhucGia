import fs from "fs";
import ExcelJS from "exceljs";
import { AppError } from "../utils/AppError";
import { LIMITS } from "../config";
import { projectFilePath, readProjectFileBuffer, stripDataUrl } from "../files";
import { parseCellRef, formatCellRef, parseRangeToken, type CellAddress } from "../../src/lib/editableRange";
import {
  applyEditToWorksheet,
  cellValueToString,
  freezeExternalLinkFormulas,
} from "../../src/lib/excelCore";

/* ----------------------------- Upload validation ----------------------------- */

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export async function loadWorkbookFromBuffer(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  return wb;
}

/**
 * Kiểm tra dữ liệu upload là một file .xlsx thật:
 * chuỗi base64 hợp lệ, không quá lớn, đúng chữ ký ZIP và ExcelJS mở được.
 * Danh sách sheet LUÔN lấy từ file ở server, không tin mảng `sheets` do client gửi.
 */
export async function validateXlsxUpload(fileBase64: unknown): Promise<{ buffer: Buffer; sheetNames: string[] }> {
  if (typeof fileBase64 !== "string" || fileBase64.length === 0) {
    throw new AppError("Thiếu file Excel", 400);
  }
  const approxBytes = Math.floor((fileBase64.length * 3) / 4);
  if (approxBytes > LIMITS.maxExcelBytes * 1.05) {
    throw new AppError(`File quá lớn (tối đa ${Math.floor(LIMITS.maxExcelBytes / 1024 / 1024)}MB)`, 413);
  }
  const buffer = stripDataUrl(fileBase64);
  if (buffer.length === 0 || buffer.length > LIMITS.maxExcelBytes) {
    throw new AppError("File Excel rỗng hoặc quá lớn", 400);
  }
  if (!ZIP_MAGIC.every((b, i) => buffer[i] === b)) {
    throw new AppError("File không phải định dạng .xlsx hợp lệ", 400);
  }
  let wb: ExcelJS.Workbook;
  try {
    wb = await loadWorkbookFromBuffer(buffer);
  } catch {
    throw new AppError("Không đọc được file Excel (file hỏng hoặc không đúng định dạng .xlsx)", 400);
  }
  const sheetNames = wb.worksheets.map((w) => w.name);
  if (sheetNames.length === 0) throw new AppError("File Excel không có sheet nào", 400);
  return { buffer, sheetNames };
}

/* --------------------------- Workbook meta (cached) -------------------------- */

type MergeBox = { r1: number; r2: number; c1: number; c2: number };

export interface WorkbookMeta {
  sheetNames: string[];
  /** Tìm tên sheet chuẩn (chấp nhận khác biệt Unicode NFC/NFD, vd "Bảng giá trị"). */
  resolveSheetName(name: string): string | null;
  /** Địa chỉ ô đại diện (góc trên-trái) nếu ô nằm trong vùng gộp, ngược lại trả về chính nó. */
  resolveMasterCell(sheetName: string, cell: CellAddress): CellAddress;
  /** Giá trị ban đầu của ô (chuỗi) trong workbook nền. */
  getBaseValue(sheetName: string, cell: CellAddress): string;
}

function buildMeta(wb: ExcelJS.Workbook): WorkbookMeta {
  const sheetNames = wb.worksheets.map((w) => w.name);
  const byNormalized = new Map(sheetNames.map((n) => [n.normalize("NFC"), n]));
  const merges = new Map<string, MergeBox[]>();

  for (const ws of wb.worksheets) {
    const boxes: MergeBox[] = [];
    for (const m of (ws.model as any).merges || []) {
      const [a, b] = String(m).split(":");
      const rule = parseRangeToken(`${a}:${b ?? a}`);
      if (rule) boxes.push(rule);
    }
    merges.set(ws.name, boxes);
  }

  return {
    sheetNames,
    resolveSheetName(name: string) {
      if (sheetNames.includes(name)) return name;
      return byNormalized.get(String(name).normalize("NFC")) ?? null;
    },
    resolveMasterCell(sheetName, cell) {
      for (const b of merges.get(sheetName) || []) {
        if (cell.r >= b.r1 && cell.r <= b.r2 && cell.c >= b.c1 && cell.c <= b.c2) {
          return { r: b.r1, c: b.c1 };
        }
      }
      return cell;
    },
    getBaseValue(sheetName, cell) {
      const ws = wb.getWorksheet(sheetName);
      if (!ws) return "";
      // findCell KHÔNG tạo ô mới (khác getCell) nên không làm bẩn workbook trong cache.
      const c = ws.findCell(cell.r + 1, cell.c + 1);
      return c ? cellValueToString(c.value) : "";
    },
  };
}

const CACHE_MAX = 12;
const metaCache = new Map<string, WorkbookMeta>();

/**
 * Meta của workbook nền (đã cấu hình) của project. Cache theo (id, mtime, size) nên tự mất hiệu lực
 * khi file nền bị thay. Workbook trong cache chỉ để ĐỌC.
 */
export async function getWorkbookMeta(projectId: string): Promise<WorkbookMeta> {
  const p = projectFilePath(projectId);
  let st: fs.Stats;
  try {
    st = await fs.promises.stat(p);
  } catch {
    throw new AppError("Không tìm thấy file Excel của báo giá trên server", 500);
  }
  const key = `${projectId}:${st.mtimeMs}:${st.size}`;
  const hit = metaCache.get(key);
  if (hit) {
    metaCache.delete(key);
    metaCache.set(key, hit); // LRU
    return hit;
  }
  const buf = await readProjectFileBuffer(projectId);
  if (!buf) throw new AppError("Không tìm thấy file Excel của báo giá trên server", 500);
  const meta = buildMeta(await loadWorkbookFromBuffer(buf));

  for (const k of metaCache.keys()) if (k.startsWith(`${projectId}:`)) metaCache.delete(k);
  metaCache.set(key, meta);
  while (metaCache.size > CACHE_MAX) metaCache.delete(metaCache.keys().next().value as string);
  return meta;
}

export function invalidateWorkbookMeta(projectId: string) {
  for (const k of metaCache.keys()) if (k.startsWith(`${projectId}:`)) metaCache.delete(k);
}

/** Meta dựng thẳng từ buffer (dùng khi cần so sánh/validate trước khi lưu). */
export async function buildMetaFromBuffer(buf: Buffer): Promise<WorkbookMeta> {
  return buildMeta(await loadWorkbookFromBuffer(buf));
}

/* ------------------------------ Build final file ----------------------------- */

export interface EditForReplay {
  sheet_name: string;
  cell: string;
  new_value: string | null;
  sequence: number;
}

export interface FinancialMetadataForReplay {
  otHours?: number;
  otRate?: number;
  vatRate?: number;
  discountAmount?: number;
  financialConfig?: any;
}

/**
 * Dựng file Excel hoàn chỉnh = workbook nền + các edit đã được server chấp nhận,
 * áp dụng theo `sequence` TĂNG DẦN (cũ -> mới) để giá trị cuối cùng là giá trị mới nhất.
 * Đồng thời ánh xạ các giá trị tài chính & OT (UC05/UC06) vào các ô đã cấu hình.
 */
export async function buildFinalWorkbookBuffer(
  baseBuffer: Buffer,
  edits: EditForReplay[],
  financialMetadata?: FinancialMetadataForReplay
): Promise<{ buffer: Buffer; applied: number; frozenExternalFormulas: number }> {
  const wb = await loadWorkbookFromBuffer(baseBuffer);
  const meta = buildMeta(wb);
  const ordered = [...edits].sort((a, b) => a.sequence - b.sequence);

  let applied = 0;
  for (const e of ordered) {
    const sheetName = meta.resolveSheetName(e.sheet_name);
    const addr = parseCellRef(e.cell);
    if (!sheetName || !addr) {
      throw new AppError(`Edit #${e.sequence} tham chiếu vị trí không tồn tại (${e.sheet_name}!${e.cell})`, 500);
    }
    const ws = wb.getWorksheet(sheetName)!;
    applyEditToWorksheet(ws, formatCellRef(meta.resolveMasterCell(sheetName, addr)), e.new_value ?? "");
    applied++;
  }

  // [P0-01] Ánh xạ siêu dữ liệu tài chính & OT (UC05 & UC06) vào workbook trước khi xuất
  if (financialMetadata) {
    let cfg = financialMetadata.financialConfig;
    if (typeof cfg === "string") {
      try {
        cfg = JSON.parse(cfg);
      } catch {}
    }
    const mapping = cfg?.cellMapping;
    if (mapping) {
      const targetSheetName = meta.resolveSheetName(mapping.sheetName || "") || wb.worksheets[0]?.name;
      if (targetSheetName) {
        const ws = wb.getWorksheet(targetSheetName);
        if (ws) {
          const editedCells = new Set(
            ordered.map((e) => `${meta.resolveSheetName(e.sheet_name)}!${e.cell.toUpperCase()}`)
          );

          const otHours = Number(financialMetadata.otHours ?? 0);
          const otRate = Number(financialMetadata.otRate ?? 505000);
          const otAmount = otHours * otRate;
          const vatRate = Number(financialMetadata.vatRate ?? 8);
          const discount = Number(financialMetadata.discountAmount ?? 0);

          if (mapping.otHoursCell && !editedCells.has(`${targetSheetName}!${mapping.otHoursCell.toUpperCase()}`)) {
            const addr = parseCellRef(mapping.otHoursCell);
            if (addr) {
              applyEditToWorksheet(ws, formatCellRef(meta.resolveMasterCell(targetSheetName, addr)), String(otHours));
              applied++;
            }
          }
          if (mapping.otAmountCell && !editedCells.has(`${targetSheetName}!${mapping.otAmountCell.toUpperCase()}`)) {
            const addr = parseCellRef(mapping.otAmountCell);
            if (addr) {
              applyEditToWorksheet(ws, formatCellRef(meta.resolveMasterCell(targetSheetName, addr)), String(otAmount));
              applied++;
            }
          }
          if (mapping.vatRateCell && !editedCells.has(`${targetSheetName}!${mapping.vatRateCell.toUpperCase()}`)) {
            const addr = parseCellRef(mapping.vatRateCell);
            if (addr) {
              applyEditToWorksheet(ws, formatCellRef(meta.resolveMasterCell(targetSheetName, addr)), String(vatRate));
              applied++;
            }
          }
          if (mapping.discountCell && !editedCells.has(`${targetSheetName}!${mapping.discountCell.toUpperCase()}`)) {
            const addr = parseCellRef(mapping.discountCell);
            if (addr) {
              applyEditToWorksheet(ws, formatCellRef(meta.resolveMasterCell(targetSheetName, addr)), String(discount));
              applied++;
            }
          }
        }
      }
    }
  }

  // ExcelJS không tự tính lại công thức: yêu cầu Excel tính lại toàn bộ khi mở file.
  wb.calcProperties.fullCalcOnLoad = true;
  const frozenExternalFormulas = freezeExternalLinkFormulas(wb);

  const out = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(out as ArrayBuffer), applied, frozenExternalFormulas };
}

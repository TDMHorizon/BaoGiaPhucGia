import fs from "fs";
import fsPromises from "fs/promises";
import type { FileHandle } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { dataDir } from "./config";

/**
 * Bố cục thư mục lưu trữ (mục 10.4 của tài liệu):
 *  originals/  file upload nguyên bản - BẤT BIẾN
 *  files/      workbook nền đã cấu hình cho project (nhân viên điền dữ liệu lên trên file này dưới dạng edit)
 *  versions/   snapshot báo giá hoàn chỉnh theo từng version - BẤT BIẾN
 *  templates/  mẫu báo giá dùng chung
 */
const dirs = () => {
  const root = dataDir();
  return {
    root,
    originals: path.join(root, "originals"),
    files: path.join(root, "files"),
    versions: path.join(root, "versions"),
    templates: path.join(root, "templates"),
  };
};

export function ensureDataDirs() {
  const d = dirs();
  for (const dir of [d.root, d.originals, d.files, d.versions, d.templates]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function stripDataUrl(base64: string): Buffer {
  const idx = base64.indexOf("base64,");
  const raw = idx >= 0 ? base64.slice(idx + 7) : base64;
  return Buffer.from(raw, "base64");
}

export function toDataUrl(buf: Buffer): string {
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buf.toString("base64")}`;
}

function tmpPathFor(target: string) {
  return `${target}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
}

/** Ghi file an toàn: ghi ra file tạm + fsync, sau đó rename đè lên file chính. Không bao giờ để lại file ghi dở. */
export async function writeFileAtomic(target: string, data: Buffer): Promise<void> {
  await fsPromises.mkdir(path.dirname(target), { recursive: true });
  const tmp = tmpPathFor(target);
  let fh: FileHandle | null = null;
  try {
    fh = await fsPromises.open(tmp, "w");
    await fh.writeFile(data);
    await fh.sync();
    await fh.close();
    fh = null;
    await fsPromises.rename(tmp, target);
  } catch (err) {
    if (fh) await fh.close().catch(() => {});
    await fsPromises.unlink(tmp).catch(() => {});
    throw err;
  }
}

/** Ghi file CHỈ KHI chưa tồn tại (dùng cho snapshot bất biến). Ném lỗi code EEXIST nếu đã có. */
export async function writeFileExclusive(target: string, data: Buffer): Promise<void> {
  await fsPromises.mkdir(path.dirname(target), { recursive: true });
  const tmp = tmpPathFor(target);
  try {
    const fh = await fsPromises.open(tmp, "w");
    try {
      await fh.writeFile(data);
      await fh.sync();
    } finally {
      await fh.close();
    }
    try {
      await fsPromises.link(tmp, target); // atomic, thất bại với EEXIST nếu đã tồn tại
    } catch (err: any) {
      if (err?.code === "EEXIST") throw err;
      // hệ thống file không hỗ trợ hard link: kiểm tra tồn tại rồi rename
      if (fs.existsSync(target)) {
        const e: any = new Error("File đã tồn tại");
        e.code = "EEXIST";
        throw e;
      }
      await fsPromises.rename(tmp, target);
      return;
    }
  } finally {
    await fsPromises.unlink(tmp).catch(() => {});
  }
}

async function readIfExists(p: string): Promise<Buffer | null> {
  try {
    return await fsPromises.readFile(p);
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

async function removeIfExists(p: string) {
  await fsPromises.unlink(p).catch((err: any) => {
    if (err?.code !== "ENOENT") throw err;
  });
}

/* ------------------------------- Project ------------------------------- */

export const originalFilePath = (id: string) => path.join(dirs().originals, `${id}.xlsx`);
export const projectFilePath = (id: string) => path.join(dirs().files, `${id}.xlsx`);
export const versionDir = (projectId: string) => path.join(dirs().versions, projectId);
export const versionFilePath = (projectId: string, version: number) =>
  path.join(versionDir(projectId), `v${version}.xlsx`);

export async function saveOriginalFile(id: string, data: Buffer | string) {
  ensureDataDirs();
  const buf = typeof data === "string" ? stripDataUrl(data) : data;
  await writeFileAtomic(originalFilePath(id), buf);
}

export async function saveProjectFile(id: string, data: Buffer | string) {
  ensureDataDirs();
  const buf = typeof data === "string" ? stripDataUrl(data) : data;
  await writeFileAtomic(projectFilePath(id), buf);
}

export async function readProjectFileBuffer(id: string): Promise<Buffer | null> {
  return readIfExists(projectFilePath(id));
}

export async function readOriginalFileBuffer(id: string): Promise<Buffer | null> {
  return readIfExists(originalFilePath(id));
}

export async function readProjectFile(id: string): Promise<string | null> {
  const buf = await readProjectFileBuffer(id);
  return buf ? toDataUrl(buf) : null;
}

/** Xóa vĩnh viễn toàn bộ file của một project (chỉ dùng khi hard-delete). */
export async function deleteProjectFiles(id: string) {
  await removeIfExists(projectFilePath(id));
  await removeIfExists(originalFilePath(id));
  await fsPromises.rm(versionDir(id), { recursive: true, force: true });
}

/** Xóa file nền + bản gốc (dùng để dọn khi tạo project thất bại giữa chừng). */
export async function deleteProjectBaseFiles(id: string) {
  await removeIfExists(projectFilePath(id)).catch(() => {});
  await removeIfExists(originalFilePath(id)).catch(() => {});
}

/* ------------------------------- Versions ------------------------------ */

export async function saveVersionSnapshot(projectId: string, version: number, data: Buffer | string) {
  ensureDataDirs();
  const buf = typeof data === "string" ? stripDataUrl(data) : data;
  await writeFileExclusive(versionFilePath(projectId, version), buf);
}

export async function readVersionSnapshotBuffer(projectId: string, version: number): Promise<Buffer | null> {
  return readIfExists(versionFilePath(projectId, version));
}

export async function readVersionSnapshot(projectId: string, version: number): Promise<string | null> {
  const buf = await readVersionSnapshotBuffer(projectId, version);
  return buf ? toDataUrl(buf) : null;
}

export async function versionSnapshotExists(projectId: string, version: number): Promise<boolean> {
  return fs.existsSync(versionFilePath(projectId, version));
}

export async function deleteVersionSnapshot(projectId: string, version: number) {
  await removeIfExists(versionFilePath(projectId, version));
}

/* ------------------------------- Templates ----------------------------- */

const templatePath = (id: string) => path.join(dirs().templates, `${id}.xlsx`);

export async function saveTemplateFile(id: string, data: Buffer | string) {
  ensureDataDirs();
  const buf = typeof data === "string" ? stripDataUrl(data) : data;
  await writeFileAtomic(templatePath(id), buf);
}

export async function readTemplateFileBuffer(id: string): Promise<Buffer | null> {
  return readIfExists(templatePath(id));
}

export async function readTemplateFile(id: string): Promise<string | null> {
  const buf = await readTemplateFileBuffer(id);
  return buf ? toDataUrl(buf) : null;
}

export async function deleteTemplateFile(id: string) {
  await removeIfExists(templatePath(id));
}

/* ------------------------------- Migration ----------------------------- */

/**
 * Project cũ (trước khi có originals/) chưa có bản gốc bất biến.
 * Sao chép file nền hiện tại sang originals/ để từ nay có một bản lưu bất biến.
 * Trả về số file đã bổ sung.
 */
export async function backfillOriginals(projectIds: string[]): Promise<number> {
  ensureDataDirs();
  let count = 0;
  for (const id of projectIds) {
    if (fs.existsSync(originalFilePath(id))) continue;
    const base = await readIfExists(projectFilePath(id));
    if (!base) continue;
    await writeFileAtomic(originalFilePath(id), base);
    count++;
  }
  return count;
}

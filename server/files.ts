import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const FILES_DIR = path.join(DATA_DIR, "files");
const VERSIONS_DIR = path.join(DATA_DIR, "versions");
const TEMPLATES_DIR = path.join(DATA_DIR, "templates");

export function ensureDataDirs() {
  for (const dir of [DATA_DIR, FILES_DIR, VERSIONS_DIR, TEMPLATES_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function stripDataUrl(base64: string): Buffer {
  const idx = base64.indexOf("base64,");
  const raw = idx >= 0 ? base64.slice(idx + 7) : base64;
  return Buffer.from(raw, "base64");
}

function toDataUrl(buf: Buffer): string {
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buf.toString("base64")}`;
}

export function projectFilePath(id: string) {
  return path.join(FILES_DIR, `${id}.xlsx`);
}

export function saveProjectFile(id: string, fileBase64: string) {
  ensureDataDirs();
  fs.writeFileSync(projectFilePath(id), stripDataUrl(fileBase64));
}

export function readProjectFile(id: string): string | null {
  const p = projectFilePath(id);
  if (!fs.existsSync(p)) return null;
  return toDataUrl(fs.readFileSync(p));
}

export function deleteProjectFile(id: string) {
  const p = projectFilePath(id);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  const vDir = path.join(VERSIONS_DIR, id);
  if (fs.existsSync(vDir)) fs.rmSync(vDir, { recursive: true, force: true });
}

export function saveVersionSnapshot(projectId: string, version: number, fileBase64: string) {
  ensureDataDirs();
  const dir = path.join(VERSIONS_DIR, projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `v${version}.xlsx`), stripDataUrl(fileBase64));
}

export function readVersionSnapshot(projectId: string, version: number): string | null {
  const p = path.join(VERSIONS_DIR, projectId, `v${version}.xlsx`);
  if (!fs.existsSync(p)) return null;
  return toDataUrl(fs.readFileSync(p));
}

export function saveTemplateFile(id: string, fileBase64: string) {
  ensureDataDirs();
  fs.writeFileSync(path.join(TEMPLATES_DIR, `${id}.xlsx`), stripDataUrl(fileBase64));
}

export function readTemplateFile(id: string): string | null {
  const p = path.join(TEMPLATES_DIR, `${id}.xlsx`);
  if (!fs.existsSync(p)) return null;
  return toDataUrl(fs.readFileSync(p));
}

export function deleteTemplateFile(id: string) {
  const p = path.join(TEMPLATES_DIR, `${id}.xlsx`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

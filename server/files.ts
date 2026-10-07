import fs from "fs";
import fsPromises from "fs/promises";
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

export async function saveProjectFile(id: string, fileBase64: string) {
  ensureDataDirs();
  console.time(`saveProjectFile-${id}`);
  await fsPromises.writeFile(projectFilePath(id), stripDataUrl(fileBase64));
  console.timeEnd(`saveProjectFile-${id}`);
}

export async function readProjectFile(id: string): Promise<string | null> {
  const p = projectFilePath(id);
  if (!fs.existsSync(p)) return null;
  console.time(`readProjectFile-${id}`);
  const buf = await fsPromises.readFile(p);
  const data = toDataUrl(buf);
  console.timeEnd(`readProjectFile-${id}`);
  return data;
}

export async function deleteProjectFile(id: string) {
  const p = projectFilePath(id);
  if (fs.existsSync(p)) await fsPromises.unlink(p);
  const vDir = path.join(VERSIONS_DIR, id);
  if (fs.existsSync(vDir)) await fsPromises.rm(vDir, { recursive: true, force: true });
}

export async function saveVersionSnapshot(projectId: string, version: number, fileBase64: string) {
  ensureDataDirs();
  const dir = path.join(VERSIONS_DIR, projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  console.time(`saveVersionSnapshot-${projectId}-v${version}`);
  await fsPromises.writeFile(path.join(dir, `v${version}.xlsx`), stripDataUrl(fileBase64));
  console.timeEnd(`saveVersionSnapshot-${projectId}-v${version}`);
}

export async function readVersionSnapshot(projectId: string, version: number): Promise<string | null> {
  const p = path.join(VERSIONS_DIR, projectId, `v${version}.xlsx`);
  if (!fs.existsSync(p)) return null;
  console.time(`readVersionSnapshot-${projectId}-v${version}`);
  const buf = await fsPromises.readFile(p);
  const data = toDataUrl(buf);
  console.timeEnd(`readVersionSnapshot-${projectId}-v${version}`);
  return data;
}

export async function saveTemplateFile(id: string, fileBase64: string) {
  ensureDataDirs();
  console.time(`saveTemplateFile-${id}`);
  await fsPromises.writeFile(path.join(TEMPLATES_DIR, `${id}.xlsx`), stripDataUrl(fileBase64));
  console.timeEnd(`saveTemplateFile-${id}`);
}

export async function readTemplateFile(id: string): Promise<string | null> {
  const p = path.join(TEMPLATES_DIR, `${id}.xlsx`);
  if (!fs.existsSync(p)) return null;
  console.time(`readTemplateFile-${id}`);
  const buf = await fsPromises.readFile(p);
  const data = toDataUrl(buf);
  console.timeEnd(`readTemplateFile-${id}`);
  return data;
}

export async function deleteTemplateFile(id: string) {
  const p = path.join(TEMPLATES_DIR, `${id}.xlsx`);
  if (fs.existsSync(p)) await fsPromises.unlink(p);
}

import fs from "fs";
import path from "path";
import crypto from "crypto";

/** Giá trị fallback cũ từng nằm trong source - tuyệt đối không chấp nhận làm secret thật. */
const LEGACY_DEFAULT_SECRETS = new Set(["baogia-phucgia-dev-secret-change-me", "change-me", "secret"]);

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Thư mục dữ liệu (SQLite + file Excel). Có thể đổi bằng biến môi trường DATA_DIR. */
export function dataDir(): string {
  return process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");
}

let cachedSecret: string | null = null;

/**
 * JWT secret.
 *  - Production: BẮT BUỘC đặt JWT_SECRET (>= 32 ký tự), không có fallback.
 *  - Dev/test: nếu không đặt thì tự sinh ngẫu nhiên và lưu vào data/.jwt-secret (không nằm trong git).
 */
export function getJwtSecret(): string {
  if (cachedSecret) return cachedSecret;

  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) {
    if (LEGACY_DEFAULT_SECRETS.has(fromEnv)) {
      throw new Error("JWT_SECRET đang dùng giá trị mặc định không an toàn. Hãy đặt một chuỗi ngẫu nhiên dài.");
    }
    if (isProduction() && fromEnv.length < 32) {
      throw new Error("JWT_SECRET phải dài ít nhất 32 ký tự khi chạy production.");
    }
    cachedSecret = fromEnv;
    return cachedSecret;
  }

  if (isProduction()) {
    throw new Error("Thiếu JWT_SECRET. Hãy đặt biến môi trường JWT_SECRET (>= 32 ký tự) trước khi chạy production.");
  }

  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, ".jwt-secret");
  if (fs.existsSync(file)) {
    cachedSecret = fs.readFileSync(file, "utf8").trim();
  }
  if (!cachedSecret) {
    cachedSecret = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(file, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

/** Dành cho test: xoá cache để đọc lại biến môi trường. */
export function resetConfigCache() {
  cachedSecret = null;
}

export const LIMITS = {
  /** Kích thước tối đa của file Excel upload (byte). */
  maxExcelBytes: 25 * 1024 * 1024,
  maxCellTextLength: 32767,
  maxEditsPerBatch: 2000,
};

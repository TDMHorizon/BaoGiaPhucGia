import type { Request, Response, NextFunction } from "express";

type Entry = { count: number; firstAt: number; lockedUntil: number };

/**
 * Giới hạn đăng nhập sai (in-memory, đủ cho hệ thống nội bộ 1 tiến trình).
 * Quá `maxFailures` lần sai trong `windowMs` thì khóa `lockMs`, tính theo cặp IP + username.
 */
export function createLoginLimiter(options: { maxFailures?: number; windowMs?: number; lockMs?: number } = {}) {
  const maxFailures = options.maxFailures ?? 8;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const lockMs = options.lockMs ?? 15 * 60 * 1000;
  const entries = new Map<string, Entry>();

  const keyOf = (req: Request) => {
    const username = String(req.body?.username ?? "").trim().toLowerCase();
    return `${req.ip || req.socket.remoteAddress || "unknown"}|${username}`;
  };

  function sweep(now: number) {
    if (entries.size < 500) return;
    for (const [k, e] of entries) {
      if (e.lockedUntil < now && now - e.firstAt > windowMs) entries.delete(k);
    }
  }

  return {
    /** Middleware chặn request khi đang bị khóa. */
    guard(req: Request, res: Response, next: NextFunction) {
      const now = Date.now();
      sweep(now);
      const e = entries.get(keyOf(req));
      if (e && e.lockedUntil > now) {
        const seconds = Math.ceil((e.lockedUntil - now) / 1000);
        res.setHeader("Retry-After", String(seconds));
        return res.status(429).json({ error: `Đăng nhập sai quá nhiều lần. Thử lại sau ${Math.ceil(seconds / 60)} phút.` });
      }
      next();
    },
    recordFailure(req: Request) {
      const now = Date.now();
      const key = keyOf(req);
      let e = entries.get(key);
      if (!e || now - e.firstAt > windowMs) {
        e = { count: 0, firstAt: now, lockedUntil: 0 };
        entries.set(key, e);
      }
      e.count++;
      if (e.count >= maxFailures) e.lockedUntil = now + lockMs;
    },
    recordSuccess(req: Request) {
      entries.delete(keyOf(req));
    },
    reset() {
      entries.clear();
    },
  };
}

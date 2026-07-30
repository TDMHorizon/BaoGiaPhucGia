import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { getDb, publicUser, type UserRow } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "baogia-phucgia-dev-secret-change-me";
const TOKEN_TTL = "7d";

export type AuthUser = { id: string; username: string; role: "admin" | "manager" | "user" };

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function authenticateUser(username: string, password: string): AuthUser | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
  if (!row || !row.active) return null;
  if (!bcrypt.compareSync(password, row.password_hash)) return null;
  return { id: row.id, username: row.username, role: row.role };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const user = verifyToken(header.slice(7));
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as UserRow | undefined;
  if (!row || !row.active) return res.status(401).json({ error: "User inactive" });

  req.user = publicUser(row) as AuthUser;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

export function requireAdminOrManager(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return res.status(403).json({ error: "Admin or Manager only" });
  }
  next();
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

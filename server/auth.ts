import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { getDb, publicUser, recordAuditLog, getMemberCustomRanges, toPermProject, type UserRow, type ProjectRow } from "./db";
import { getJwtSecret } from "./config";
import { canManageQuotation, canManageUsers, canEditProjectCells } from "../src/lib/permissions";
import { isCellInRange } from "../src/lib/editableRange";

const TOKEN_TTL = "7d";

export type AuthUser = {
  id: string;
  username: string;
  role: "admin" | "manager" | "user";
  tokenVersion: number;
  fullName?: string;
  email?: string;
  active?: boolean;
};

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      tokenVersion: user.tokenVersion || 1,
    },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

export function verifyToken(token: string): (AuthUser & { tokenVersion: number }) | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthUser & { tokenVersion: number };
  } catch {
    return null;
  }
}

export function decodeTokenIgnoreExpiry(token: string): (AuthUser & { tokenVersion: number }) | null {
  try {
    const payload = jwt.decode(token) as (AuthUser & { tokenVersion: number }) | null;
    return payload && payload.id ? payload : null;
  } catch {
    return null;
  }
}

/** Hash giả để thời gian xử lý khi sai username ≈ khi sai password (chống timing attack). */
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

export function authenticateUser(
  username: string,
  password: string,
  reqInfo?: { ip?: string; userAgent?: string }
): AuthUser | null {
  const db = getDb();
  const cleanUsername = String(username || "").trim();
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(cleanUsername) as UserRow | undefined;
  if (!row) {
    bcrypt.compareSync(String(password ?? ""), DUMMY_HASH);
    recordAuditLog({
      action: "AUTH_LOGIN_FAILED",
      resource: "users",
      username: cleanUsername,
      ipAddress: reqInfo?.ip,
      userAgent: reqInfo?.userAgent,
      detail: { reason: "User not found" },
    });
    return null;
  }
  if (!bcrypt.compareSync(String(password ?? ""), row.password_hash)) {
    recordAuditLog({
      action: "AUTH_LOGIN_FAILED",
      resource: "users",
      userId: row.id,
      username: row.username,
      ipAddress: reqInfo?.ip,
      userAgent: reqInfo?.userAgent,
      detail: { reason: "Incorrect password" },
    });
    return null;
  }
  if (!row.active) {
    recordAuditLog({
      action: "AUTH_LOGIN_BLOCKED",
      resource: "users",
      userId: row.id,
      username: row.username,
      ipAddress: reqInfo?.ip,
      userAgent: reqInfo?.userAgent,
      detail: { reason: "User inactive" },
    });
    return null;
  }

  recordAuditLog({
    action: "AUTH_LOGIN_SUCCESS",
    resource: "users",
    userId: row.id,
    username: row.username,
    ipAddress: reqInfo?.ip,
    userAgent: reqInfo?.userAgent,
    detail: { role: row.role },
  });

  return publicUser(row) as AuthUser;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Vui lòng đăng nhập" });
  }
  const decoded = verifyToken(header.slice(7));
  if (!decoded) {
    return res.status(401).json({ error: "Phiên làm việc không hợp lệ hoặc đã hết hạn" });
  }

  // Luôn đọc lại user và kiểm tra token_version từ DB:
  // Đổi quyền, đổi mật khẩu hoặc khoá tài khoản sẽ có hiệu lực ngay lập tức!
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id) as UserRow | undefined;
  if (!row || !row.active) {
    return res.status(401).json({ error: "Tài khoản của bạn đã bị khóa hoặc vô hiệu hoá. Vui lòng liên hệ Admin để xử lý!", code: "ACCOUNT_LOCKED" });
  }

  if (row.token_version !== decoded.tokenVersion) {
    return res.status(401).json({ error: "Phiên làm việc đã bị thu hồi hoặc mật khẩu đã đổi. Vui lòng đăng nhập lại.", code: "TOKEN_REVOKED" });
  }

  req.user = publicUser(row) as AuthUser;
  next();
}

/** Chỉ Admin: quản trị tài khoản hệ thống. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user || !canManageUsers(user.role)) {
    return res.status(403).json({ error: "Quyền truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền này." });
  }
  next();
}

/** Admin hoặc Manager: quản lý nghiệp vụ báo giá. */
export function requireAdminOrManager(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user || !canManageQuotation(user.role)) {
    return res.status(403).json({ error: "Quyền truy cập bị từ chối: Chỉ Admin hoặc Quản lý (Manager) mới có quyền này." });
  }
  next();
}

/**
 * Kiểm tra quyền chỉnh sửa ô (Default Deny - Phân quyền chặt chẽ cấp Backend).
 * Chống triệt để việc nhân viên dùng Postman bắn request sửa ô ngoài phạm vi cho phép.
 */
export function checkCellPermission(
  user: AuthUser,
  project: ProjectRow,
  sheetName: string,
  cell: string
): { allowed: boolean; reason?: string } {
  // 1. Admin có toàn quyền sửa/xóa mọi ô trên mọi sheet
  if (user.role === "admin") {
    return { allowed: true };
  }

  // Parse cấu hình tài chính & phân vùng ô (nếu có)
  let finCfg: any = {};
  try {
    finCfg = project.financial_config ? JSON.parse(project.financial_config) : {};
  } catch {
    finCfg = {};
  }
  const financialRanges: Record<string, string> = finCfg.financialRanges || {};
  const finSheetRange = financialRanges[sheetName];
  const isFinancialCell = finSheetRange ? isCellInRange(cell, finSheetRange) : false;

  // Lấy vùng kỹ thuật (khối lượng)
  const projectRanges: Record<string, string> = JSON.parse(project.editable_ranges || "{}");
  const techSheetRange = projectRanges[sheetName];
  const isTechnicalCell = techSheetRange ? isCellInRange(cell, techSheetRange) : false;

  // 2. Phân quyền cho Kế toán (Manager) - UC05 & UC04
  if (user.role === "manager") {
    // Tình huống 10 (UC05): Kế toán KHÔNG ĐƯỢC PHÉP sửa ô khối lượng kỹ thuật
    if (isTechnicalCell && !isFinancialCell) {
      return {
        allowed: false,
        reason: "Kế toán không có quyền chỉnh sửa số liệu khối lượng kỹ thuật (UC04/UC05).",
      };
    }
    // Kế toán được phép sửa các ô tài chính (đơn giá, VAT, chiết khấu, phụ cấp)
    return { allowed: true };
  }

  // 3. Phân quyền cho Nhân viên kỹ thuật (User) - UC04 & UC05 & UC06
  // Kiểm tra trạng thái dự án (phải là dang_lam) và user phải được phân công
  if (!canEditProjectCells(user, toPermProject(project))) {
    return {
      allowed: false,
      reason: "Báo giá hiện không ở trạng thái cho phép nhập liệu hoặc bạn chưa được phân công vào báo giá này.",
    };
  }

  // Tình huống 09 (UC05): Nhân viên kỹ thuật KHÔNG ĐƯỢC PHÉP sửa ô đơn giá, VAT, chiết khấu
  if (isFinancialCell) {
    // Ngoại lệ: Nếu ô này được ánh xạ cụ thể là ô số giờ OT (UC06) thì nhân viên được sửa
    const isOtHoursCell = finCfg.cellMapping?.otHoursCell && finCfg.cellMapping.otHoursCell.toUpperCase() === cell.toUpperCase();
    if (!isOtHoursCell) {
      return {
        allowed: false,
        reason: "Nhân viên kỹ thuật không có quyền chỉnh sửa đơn giá, thuế VAT hoặc chiết khấu tài chính (UC05).",
      };
    }
  }

  // Kiểm tra quyền riêng theo nhân viên trong project_member_permissions (Chương 11)
  const customRanges = getMemberCustomRanges(project.id, user.id, sheetName);
  if (customRanges !== null) {
    if (!isCellInRange(cell, customRanges)) {
      return {
        allowed: false,
        reason: `Ô ${cell} trên sheet "${sheetName}" nằm ngoài phạm vi được cấp quyền cho bạn (${customRanges || "không có ô nào"}).`,
      };
    }
    return { allowed: true };
  }

  // Nếu không có cấu hình riêng, kiểm tra theo editableRanges chung của project
  if (!techSheetRange || !isCellInRange(cell, techSheetRange)) {
    // Cho phép sửa nếu là ô số giờ OT đã được ánh xạ cho nhân viên
    const isOtHoursCell = finCfg.cellMapping?.otHoursCell && finCfg.cellMapping.otHoursCell.toUpperCase() === cell.toUpperCase();
    if (isOtHoursCell) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Ô ${cell} trên sheet "${sheetName}" nằm ngoài phạm vi được phép chỉnh sửa của báo giá này.`,
    };
  }

  return { allowed: true };
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

import { AppError } from "./server/utils/AppError";
import { catchAsync } from "./server/utils/catchAsync";
import { z } from "zod";
import { validate } from "./server/middlewares/validate";
import express from "express";
import { createServer as createHttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import {
  initDb,
  getDb,
  projectToJson,
  editToJson,
  getProjectMembers,
  getProjectsWithMembers,
  setProjectMembers,
  userCanAccessProject,
  isProjectLocked,
  publicUser,
  incrementUserTokenVersion,
  recordAuditLog,
  getCellValue,
  getAllCellValuesForProject,
  getProjectMemberPermissions,
  setProjectMemberPermissions,
  countActiveAdmins,
  userHasProjectOrEditReferences,
  type ProjectRow,
  type UserRow,
  type TrangThai,
  type EditRow,
  type VersionRow,
  type TemplateRow,
  isCellDisabled,
  updateProjectDisabledRange
} from "./server/db";
import {
  authenticateUser,
  signToken,
  verifyToken,
  decodeTokenIgnoreExpiry,
  authMiddleware,
  requireAdmin,
  requireAdminOrManager,
  hashPassword,
  checkCellPermission
} from "./server/auth";
import {
  ensureDataDirs,
  saveProjectFile,
  readProjectFile,
  readVersionSnapshot,
  saveTemplateFile,
  readTemplateFile,
  deleteTemplateFile,
  deleteProjectFiles,
  toDataUrl,
} from "./server/files";
import * as XLSX from "xlsx";

/** Bản gốc không bị ghi đè. User chỉ điền ô được phép rồi tải Excel gửi khách. */
const USER_TRANSITIONS: Record<string, TrangThai[]> = {
  nhap: ["dang_lam"],
  dang_lam: ["da_gui"],
  // legacy statuses from older builds
  cho_duyet: ["da_gui", "dang_lam"],
  da_duyet: ["da_gui", "dang_lam"],
  da_gui: [],
};

const ADMIN_TRANSITIONS: Record<string, TrangThai[]> = {
  nhap: ["dang_lam", "da_gui"],
  dang_lam: ["da_gui", "nhap"],
  cho_duyet: ["dang_lam", "da_gui", "nhap"],
  da_duyet: ["dang_lam", "da_gui", "nhap"],
  da_gui: ["dang_lam", "nhap"],
};

function now() {
  return new Date().toISOString();
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeBlankWorkbookBase64(): string {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["BẢNG BÁO GIÁ ĐO ĐẠC KHẢO SÁT TRẮC ĐỊA PHÚC GIA", "", "", "", ""],
    ["STT", "Nội dung công việc", "ĐVT", "Khối lượng", "Ghi chú"],
    ["1", "Khảo sát trắc địa", "Điểm", "0", ""],
    ["2", "Đo vẽ bình đồ địa hình", "Ha", "0", ""],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "BaoGia");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return toDataUrl(buf);
}

function loadProject(id: string, includeDeleted = false): ProjectRow | undefined {
  const query = includeDeleted
    ? "SELECT * FROM projects WHERE id = ? AND isDelete = 1"
    : "SELECT * FROM projects WHERE id = ? AND isDelete = 0";
  return getDb().prepare(query).get(id) as ProjectRow | undefined;
}

async function purgeExpiredDeletedProjects() {
  const expiredProjects = getDb()
    .prepare(
      `SELECT id FROM projects
       WHERE isDelete = 1
         AND deleted_at IS NOT NULL
         AND datetime(deleted_at) <= datetime('now', '-30 days')`
    )
    .all() as { id: string }[];

  for (const project of expiredProjects) {
    await deleteProjectFiles(project.id);
    getDb().prepare("DELETE FROM projects WHERE id = ? AND isDelete = 1").run(project.id);
  }
}

async function projectWithFile(p: ProjectRow) {
  const members = getProjectMembers(p.id);
  const json = projectToJson(p, members);
  const fileBase64 = await readProjectFile(p.id);
  return { ...json, fileBase64 };
}

function listSummary(p: ProjectRow, membersByProjectId?: Map<string, string[]>) {
  const members = membersByProjectId ? membersByProjectId.get(p.id) || [] : getProjectMembers(p.id);
  return projectToJson(p, members);
}

async function startServer() {
  ensureDataDirs();
  initDb();
  await purgeExpiredDeletedProjects();
  const purgeInterval = setInterval(() => {
    purgeExpiredDeletedProjects().catch((error) => console.error("Failed to purge expired projects", error));
  }, 24 * 60 * 60 * 1000);
  purgeInterval.unref();

  const app = express();
  const httpServer = createHttpServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8,
  });

  io.on("connection", (socket) => {
    socket.on("identify_user", (userId: string) => {
      if (userId) socket.join(`user:${userId}`);
    });
    socket.on("join_project", (projectId: string) => {
      if (projectId) socket.join(`project:${projectId}`);
    });
    socket.on("leave_project", (projectId: string) => {
      if (projectId) socket.leave(`project:${projectId}`);
    });

    // Realtime Collaborative Presence: Nhân viên focus/bắt đầu sửa ô (UC07)
    socket.on("cell_focus", (data: { projectId: string; sheetName: string; r: number; c: number; cell: string; user: { id: string; username: string; color?: string } }) => {
      if (data?.projectId) {
        socket.to(`project:${data.projectId}`).emit("cell_focused", data);
      }
    });

    // Realtime Collaborative Presence: Nhân viên rời ô / kết thúc sửa (UC07)
    socket.on("cell_blur", (data: { projectId: string; sheetName: string; r: number; c: number; cell: string; userId: string }) => {
      if (data?.projectId) {
        socket.to(`project:${data.projectId}`).emit("cell_blurred", data);
      }
    });
  });

  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, env: process.env.NODE_ENV || "development" });
  });

  app.get("/api/config", (_req, res) => {
    res.json({
      allowQuickLogin: process.env.NODE_ENV !== "production",
      statuses: ["nhap", "dang_lam", "da_gui"],
    });
  });

  // Auth
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body || {};
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const user = authenticateUser(username, password, { ip, userAgent });
    if (!user) return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không chính xác" });
    const token = signToken(user);
    res.json({ ...user, token });
  });

  // Refresh Token (UC19 - Tự động cấp lại token mới khi đổi quyền hoặc khi token hết hạn)
  app.post("/api/auth/refresh", (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.token as string | undefined);
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const decoded = verifyToken(token) || decodeTokenIgnoreExpiry(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: "Token không hợp lệ", code: "INVALID_TOKEN" });
    }

    const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(decoded.id) as UserRow | undefined;
    if (!row || !row.active) {
      return res.status(401).json({
        error: "Tài khoản nhân viên của bạn đã bị khoá. Vui lòng liên hệ Admin để xử lý!",
        code: "ACCOUNT_LOCKED",
      });
    }

    if (row.token_version !== decoded.tokenVersion) {
      return res.status(401).json({
        error: "Phiên làm việc đã bị thu hồi hoặc mật khẩu đã đổi. Vui lòng đăng nhập lại.",
        code: "TOKEN_REVOKED",
      });
    }

    const userObj = publicUser(row) as any;
    const newToken = signToken(userObj);
    res.json({
      ok: true,
      token: newToken,
      user: userObj,
    });
  });

  app.get("/api/me", authMiddleware, (req, res) => {
    res.json(req.user!);
  });

  // Users (admin)
  app.get("/api/users", authMiddleware, requireAdmin, (_req, res) => {
    const rows = getDb().prepare("SELECT * FROM users ORDER BY username").all() as UserRow[];
    res.json(rows.map(publicUser));
  });

  app.get("/api/users/active", authMiddleware, (_req, res) => {
    const rows = getDb()
      .prepare("SELECT * FROM users WHERE active = 1 AND role = 'user' ORDER BY username")
      .all() as UserRow[];
    res.json(rows.map(publicUser));
  });

  app.post("/api/users", authMiddleware, requireAdmin, (req, res) => {
    const { username, password, role, fullName, email } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    const r = role === "admin" ? "admin" : role === "manager" ? "manager" : "user";
    const id = newId();
    try {
      getDb()
        .prepare("INSERT INTO users (id, username, password_hash, role, active, token_version, full_name, email, created_at) VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?)")
        .run(id, username.trim(), hashPassword(password), r, fullName?.trim() || null, email?.trim() || null, now());
      
      recordAuditLog({
        userId: req.user!.id,
        username: req.user!.username,
        action: "USER_CREATED",
        resource: "users",
        resourceId: id,
        detail: { createdUsername: username.trim(), role: r }
      });

      const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
      res.json(publicUser(row));
    } catch {
      res.status(400).json({ error: "Username already exists" });
    }
  });

  app.patch("/api/users/:id", authMiddleware, (req, res) => {
    const requester = req.user!;
    if (requester.role !== "admin" && requester.id !== req.params.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as UserRow | undefined;
    if (!row) return res.status(404).json({ error: "User not found" });

    const { username, password, role, active, fullName, email } = req.body || {};
    const nextUsername = username?.trim() || row.username;
    const nextRole = requester.role === "admin" && (role === "admin" || role === "manager" || role === "user") ? role : row.role;
    const nextActive = requester.role === "admin"
      ? (typeof active === "boolean"
          ? (active ? 1 : 0)
          : (typeof active === "number" ? (active === 1 ? 1 : 0) : row.active))
      : row.active;
    const nextHash = password ? hashPassword(password) : row.password_hash;
    const nextFullName = fullName !== undefined ? fullName : (row.full_name || null);
    const nextEmail = email !== undefined ? email : (row.email || null);

    // Kiểm tra cấm khóa hoặc hạ quyền Admin duy nhất còn hoạt động
    if (row.role === "admin" && row.active === 1 && (nextRole !== "admin" || nextActive === 0)) {
      if (countActiveAdmins() <= 1) {
        return res.status(400).json({ error: "Không thể khóa tài khoản hoặc hạ quyền của Quản trị viên (Admin) duy nhất còn hoạt động." });
      }
    }

    // Thu hồi ngay lập tức mọi phiên làm việc cũ khi đổi mật khẩu hoặc khóa tài khoản
    if (password || active === false || nextActive === 0) {
      incrementUserTokenVersion(row.id);
    }

    try {
      getDb()
        .prepare("UPDATE users SET username = ?, password_hash = ?, role = ?, active = ?, full_name = ?, email = ? WHERE id = ?")
        .run(nextUsername, nextHash, nextRole, nextActive, nextFullName, nextEmail, row.id);

      recordAuditLog({
        userId: req.user!.id,
        username: req.user!.username,
        action: "USER_UPDATED",
        resource: "users",
        resourceId: row.id,
        detail: { nextRole, nextActive, passwordChanged: !!password }
      });

      const updated = getDb().prepare("SELECT * FROM users WHERE id = ?").get(row.id) as UserRow;

      // UC19 - Tình huống 3: Thông báo realtime khi tài khoản bị khóa
      if (nextActive === 0) {
        io.to(`user:${row.id}`).emit("account.locked", {
          userId: row.id,
          message: "Tài khoản nhân viên của bạn đã bị khoá. Vui lòng liên hệ Admin để xử lý!",
        });
        io.emit("account.locked", {
          userId: row.id,
          message: "Tài khoản nhân viên của bạn đã bị khoá. Vui lòng liên hệ Admin để xử lý!",
        });
      }

      // UC19 - Tình huống 5: Thông báo realtime khi đổi vai trò (role) để client refresh token
      if (nextRole !== row.role) {
        io.to(`user:${row.id}`).emit("account.role_updated", {
          userId: row.id,
          oldRole: row.role,
          newRole: nextRole,
          message: `Vai trò của bạn đã được cập nhật thành ${nextRole === "manager" ? "Kế toán / Quản lý" : nextRole === "admin" ? "Quản trị viên" : "Nhân viên"}.`,
        });
        io.emit("account.role_updated", {
          userId: row.id,
          oldRole: row.role,
          newRole: nextRole,
        });
      }

      res.json(publicUser(updated));
    } catch {
      res.status(400).json({ error: "Update failed" });
    }
  });

  app.delete("/api/users/:id", authMiddleware, requireAdmin, (req, res) => {
    const user = req.user!;
    if (user.id === req.params.id) return res.status(400).json({ error: "Cannot delete yourself" });
    const target = getDb().prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as UserRow | undefined;
    if (!target) return res.status(404).json({ error: "User not found" });

    // Kiểm tra không xóa admin cuối cùng
    if (target.role === "admin" && target.active === 1 && countActiveAdmins() <= 1) {
      return res.status(400).json({ error: "Không thể xóa Quản trị viên (Admin) duy nhất còn hoạt động trong hệ thống." });
    }

    // Kiểm tra ràng buộc tham chiếu trước khi xóa
    const refCheck = userHasProjectOrEditReferences(target.id);
    if (refCheck.hasReferences) {
      return res.status(400).json({
        error: `Không thể xóa tài khoản: ${refCheck.reason}. Vui lòng chuyển giao dự án hoặc khóa tài khoản (active=0) thay vì xóa vĩnh viễn.`
      });
    }

    const result = getDb().prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: "User not found" });

    recordAuditLog({
      userId: user.id,
      username: user.username,
      action: "USER_DELETED",
      resource: "users",
      resourceId: req.params.id,
      detail: { deletedUsername: target.username }
    });

    res.json({ ok: true });
  });

  // Audit Logs (admin)
  app.get("/api/audit-logs", authMiddleware, requireAdmin, (req, res) => {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const rows = getDb().prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?").all(limit);
    res.json(rows);
  });

  // Projects list
  app.get("/api/projects", authMiddleware, (req, res) => {
    const user = req.user!;
    const q = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim();
    const assignee = String(req.query.assignee || "").trim();

    const { projects: rawProjects, membersByProjectId } = getProjectsWithMembers();

    let rows = Array.from(
      new Map(rawProjects.map((p) => [p.id, p])).values()
    );

    if (user.role !== "admin" && user.role !== "manager") {
      rows = rows.filter((p) => {
        if (p.nguoi_phu_trach_id === user.id) return true;
        return (membersByProjectId.get(p.id) || []).includes(user.id);
      });
    }

    if (status) rows = rows.filter((p) => p.trang_thai === status);
    if (assignee) {
      rows = rows.filter((p) => {
        if (p.nguoi_phu_trach_id === assignee) return true;
        return (membersByProjectId.get(p.id) || []).includes(assignee);
      });
    }
    if (q) {
      rows = rows.filter((p) => {
        const hay = `${p.name} ${p.so_bao_gia} ${p.ten_khach_hang} ${p.ghi_chu}`.toLowerCase();
        return hay.includes(q);
      });
    }

    res.json(rows.map((p) => listSummary(p, membersByProjectId)));
  });

  app.get("/api/projects/pending-count", authMiddleware, requireAdminOrManager, (_req, res) => {
    const row = getDb()
      .prepare("SELECT COUNT(*) as c FROM projects WHERE isDelete = 0 AND trang_thai IN ('dang_lam', 'cho_duyet')")
      .get() as { c: number };
    res.json({ count: row.c });
  });

  app.get("/api/projects/me", authMiddleware, (req, res) => {
    const user = req.user!;
    const q = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim();

    const { projects, membersByProjectId } = getProjectsWithMembers();

    const uniqueProjects = Array.from(
      new Map(projects.map((p) => [p.id, p])).values()
    );

    const rows = uniqueProjects.filter((project) => {
      const isAssigned = project.nguoi_phu_trach_id === user.id
        || (membersByProjectId.get(project.id) || []).includes(user.id);

      if (!isAssigned) return false;
      if (status && project.trang_thai !== status) return false;
      if (!q) return true;

      const haystack = `${project.name} ${project.so_bao_gia} ${project.ten_khach_hang} ${project.ghi_chu}`.toLowerCase();
      return haystack.includes(q);
    });

    res.json(rows.map((project) => listSummary(project, membersByProjectId)));
  });

  app.post("/api/projects", authMiddleware, catchAsync(async (req, res) => {
    const user = req.user!;
    const {
      name,
      fileBase64,
      sheets,
      editableRanges,
      soBaoGia,
      tenKhachHang,
      nguoiPhuTrachId,
      memberIds,
      ghiChu,
      mode,
    } = req.body || {};

    let actualFile = fileBase64;
    let actualSheets = sheets;

    if (!actualFile && (mode === "blank" || !actualFile)) {
      actualFile = makeBlankWorkbookBase64();
      actualSheets = ["BaoGia"];
    }

    if (!name || !actualFile) return res.status(400).json({ error: "Missing name or file" });

    const id = newId();
    const ts = now();
    const ownerId = (user.role === "admin" || user.role === "manager") ? nguoiPhuTrachId || null : user.id;
    const members: string[] = (user.role === "admin" && Array.isArray(memberIds)) ? memberIds : [];

    getDb()
      .prepare(
        `INSERT INTO projects
        (id, name, sheets, editable_ranges, so_bao_gia, ten_khach_hang, nguoi_phu_trach_id, trang_thai, ghi_chu, version, project_revision, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'nhap', ?, 1, 0, ?, ?)`
      )
      .run(
        id,
        name,
        JSON.stringify(actualSheets || []),
        JSON.stringify(editableRanges || {}),
        soBaoGia || "",
        tenKhachHang || "",
        ownerId,
        ghiChu || "",
        ts,
        ts
      );

    if (members.length) setProjectMembers(id, members);
    await saveProjectFile(id, actualFile);

    const project = loadProject(id)!;
    res.json(await projectWithFile(project));
  }));

  app.get("/api/projects/deleted", authMiddleware, requireAdminOrManager, (_req, res) => {
    const { projects: rows, membersByProjectId } = getProjectsWithMembers(true);
    res.json(rows.map((p) => listSummary(p, membersByProjectId)));
  });

  app.get("/api/projects/deleted/:id", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {
    const project = loadProject(req.params.id, true);
    if (!project) return res.status(404).json({ error: "Deleted project not found" });
    res.json(await projectWithFile(project));
  }));

  app.get("/api/projects/:id", authMiddleware, catchAsync(async (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });
    res.json(await projectWithFile(project));
  }));

  app.patch("/api/projects/:id", authMiddleware, catchAsync(async (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (user.role !== "admin" && user.role !== "manager" && !userCanAccessProject(user, project)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const body = req.body || {};
    let name = project.name;
    let soBaoGia = project.so_bao_gia;
    let tenKhachHang = project.ten_khach_hang;
    let nguoiPhuTrachId = project.nguoi_phu_trach_id;
    let ghiChu = project.ghi_chu;
    let editableRanges = project.editable_ranges;
    let sheets = project.sheets;

    if (user.role === "admin" || user.role === "manager") {
      if (body.name !== undefined) name = body.name;
      if (body.soBaoGia !== undefined) soBaoGia = body.soBaoGia;
      if (body.tenKhachHang !== undefined) tenKhachHang = body.tenKhachHang;
      if (body.nguoiPhuTrachId !== undefined) nguoiPhuTrachId = body.nguoiPhuTrachId;
      if (body.ghiChu !== undefined) ghiChu = body.ghiChu;
      if (body.editableRanges !== undefined) editableRanges = JSON.stringify(body.editableRanges);
      if (body.sheets !== undefined) sheets = JSON.stringify(body.sheets);
      // Chỉ Admin mới được cập nhật thành viên qua PATCH
      if (user.role === "admin" && Array.isArray(body.memberIds)) {
        const oldMembers = getProjectMembers(project.id);
        const memberIdList = (body.memberIds as any[]).map(String);
        const uniqueMembers = Array.from(new Set(memberIdList));
        const removed = oldMembers.filter((m) => !uniqueMembers.includes(m));
        setProjectMembers(project.id, uniqueMembers);

        if (removed.length > 0) {
          for (const remId of removed) {
            io.to(`user:${remId}`).emit("project.membership_revoked", {
              projectId: project.id,
              userId: remId,
              message: "Bạn không còn được phân công trong files báo giá này!",
            });
          }
          io.to(`project:${project.id}`).emit("project.membership_revoked", {
            projectId: project.id,
            removedUserIds: removed,
            message: "Bạn không còn được phân công trong files báo giá này!",
          });
        }
      }
    } else {
      if (body.ghiChu !== undefined) ghiChu = body.ghiChu;
    }

    getDb()
      .prepare(
        `UPDATE projects SET name = ?, so_bao_gia = ?, ten_khach_hang = ?, nguoi_phu_trach_id = ?,
         ghi_chu = ?, editable_ranges = ?, sheets = ?, updated_at = ? WHERE id = ?`
      )
      .run(name, soBaoGia, tenKhachHang, nguoiPhuTrachId, ghiChu, editableRanges, sheets, now(), project.id);

    io.to(`project:${project.id}`).emit("project.updated", {
      projectId: project.id,
      updatedBy: user.username,
    });

    res.json(await projectWithFile(loadProject(project.id)!));
  }));

  // Phân công thành viên chuyên biệt (Admin-only - UC07)
  app.put("/api/projects/:id/members", authMiddleware, requireAdmin, catchAsync(async (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { memberIds, nguoiPhuTrachId } = req.body || {};
    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ error: "memberIds phải là một danh sách mảng" });
    }

    // Kiểm tra tất cả user được gán phải tồn tại và đang active
    const db = getDb();
    for (const mId of memberIds) {
      const u = db.prepare("SELECT active FROM users WHERE id = ?").get(mId) as { active: number } | undefined;
      if (!u || !u.active) {
        return res.status(400).json({ error: `Người dùng ${mId} không tồn tại hoặc đã bị khóa.` });
      }
    }

    let nextOwner = project.nguoi_phu_trach_id;
    if (nguoiPhuTrachId !== undefined) {
      if (nguoiPhuTrachId) {
        const u = db.prepare("SELECT active FROM users WHERE id = ?").get(nguoiPhuTrachId) as { active: number } | undefined;
        if (!u || !u.active) {
          return res.status(400).json({ error: "Người phụ trách không hợp lệ hoặc đã bị khóa." });
        }
        nextOwner = nguoiPhuTrachId;
      } else {
        nextOwner = null;
      }
    }

    const oldMembers = getProjectMembers(project.id);
    const uniqueMembers = Array.from(new Set(memberIds));
    const removedMembers = oldMembers.filter((m) => !uniqueMembers.includes(m));
    const ts = now();
    db.transaction(() => {
      setProjectMembers(project.id, uniqueMembers);
      if (nextOwner !== project.nguoi_phu_trach_id) {
        db.prepare("UPDATE projects SET nguoi_phu_trach_id = ?, updated_at = ? WHERE id = ?").run(nextOwner, ts, project.id);
      }
    })();

    recordAuditLog({
      userId: req.user!.id,
      username: req.user!.username,
      action: "PROJECT_MEMBERS_ASSIGNED",
      resource: "projects",
      resourceId: project.id,
      detail: { memberIds: uniqueMembers, nguoiPhuTrachId: nextOwner },
    });

    io.to(`project:${project.id}`).emit("members.updated", {
      projectId: project.id,
      memberIds: uniqueMembers,
      nguoiPhuTrachId: nextOwner,
      updatedBy: req.user!.username,
    });

    // UC07 - Tình huống 3 & 7: Khi nhân viên bị gỡ khỏi phân công, đẩy thông báo realtime và thu hồi quyền
    if (removedMembers.length > 0) {
      for (const rId of removedMembers) {
        io.to(`user:${rId}`).emit("project.membership_revoked", {
          projectId: project.id,
          userId: rId,
          message: "Bạn không còn được phân công trong files báo giá này!",
        });
      }
      io.to(`project:${project.id}`).emit("project.membership_revoked", {
        projectId: project.id,
        removedUserIds: removedMembers,
        message: "Bạn không còn được phân công trong files báo giá này!",
      });
    }

    res.json({ ok: true, memberIds: uniqueMembers, nguoiPhuTrachId: nextOwner });
  }));

  app.delete("/api/projects/:id", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const deletedAt = now();
    getDb().prepare("UPDATE projects SET isDelete = 1, deleted_at = ?, updated_at = ? WHERE id = ?").run(deletedAt, deletedAt, project.id);
    const permanentlyDeletedAt = new Date(Date.parse(deletedAt) + 30 * 24 * 60 * 60 * 1000).toISOString();
    res.json({ ok: true, isDelete: true, deletedAt, permanentlyDeletedAt });
  }));

  app.post("/api/projects/:id/restore", authMiddleware, requireAdminOrManager, (req, res) => {
    const project = loadProject(req.params.id, true);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!project.isDelete) return res.status(400).json({ error: "Project is not deleted" });
    const restoredAt = now();
    getDb().prepare("UPDATE projects SET isDelete = 0, deleted_at = NULL, updated_at = ? WHERE id = ?").run(restoredAt, project.id);
    res.json(listSummary(loadProject(project.id)!));
  });

  app.put("/api/projects/:id/ranges", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const updatedRanges = req.body.editableRanges || {};
    getDb()
        .prepare("UPDATE projects SET editable_ranges = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(updatedRanges), now(), project.id);

    io.to(`project:${project.id}`).emit("ranges.updated", {
      projectId: project.id,
      editableRanges: updatedRanges,
      updatedBy: req.user!.username,
    });

    res.json({ success: true, editableRanges: updatedRanges });
  }));

  // Chỉ admin/manager được cập nhật file gốc (cấu trúc sheet). Nhân viên không ghi đè.
  app.put("/api/projects/:id/file", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { fileBase64, sheets } = req.body || {};
    if (!fileBase64) return res.status(400).json({ error: "Missing file" });

    await saveProjectFile(project.id, fileBase64);
    if (sheets) {
      getDb()
        .prepare("UPDATE projects SET sheets = ?, project_revision = project_revision + 1, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(sheets), now(), project.id);
    } else {
      getDb().prepare("UPDATE projects SET project_revision = project_revision + 1, updated_at = ? WHERE id = ?").run(now(), project.id);
    }

    io.to(`project:${project.id}`).emit("structure.updated", {
      projectId: project.id,
      updatedBy: req.user!.username,
    });

    res.json(await projectWithFile(loadProject(project.id)!));
  }));

  // Status workflow
  app.post("/api/projects/:id/status", authMiddleware, catchAsync(async (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });

    const nextStatus = req.body?.trangThai as TrangThai;
    const allowed =
      (user.role === "admin" || user.role === "manager")
        ? ADMIN_TRANSITIONS[project.trang_thai]
        : USER_TRANSITIONS[project.trang_thai];

    if (!allowed?.includes(nextStatus)) {
      return res.status(400).json({ error: "Invalid status transition" });
    }

    getDb()
      .prepare("UPDATE projects SET trang_thai = ?, updated_at = ? WHERE id = ?")
      .run(nextStatus, now(), project.id);

    io.to(`project:${project.id}`).emit("status.updated", {
      projectId: project.id,
      status: nextStatus,
      updatedBy: user.username,
    });

    res.json(await projectWithFile(loadProject(project.id)!));
  }));

  // Member permissions (Chương 11 - Phân quyền từng nhân viên theo sheet)
  app.get("/api/projects/:id/member-permissions", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });
    res.json(getProjectMemberPermissions(project.id));
  });

  app.put("/api/projects/:id/member-permissions", authMiddleware, requireAdminOrManager, (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
    setProjectMemberPermissions(project.id, permissions);

    io.to(`project:${project.id}`).emit("member_permissions.updated", {
      projectId: project.id,
      permissions,
      updatedBy: req.user!.username,
    });

    res.json({ ok: true, permissions });
  });

  // Current Cell Values (Chương 7 - State chung của toàn Project)
  app.get("/api/projects/:id/cell-values", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });
    res.json(getAllCellValuesForProject(project.id));
  });

  // Alias theo chuẩn đặc tả (Chương 7 & Docs Tối ưu)
  app.get("/api/projects/:id/cell-states", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });
    res.json(getAllCellValuesForProject(project.id));
  });

  // Tách tải file riêng (Tránh overfetch Base64 trong metadata)
  app.get("/api/projects/:id/file", authMiddleware, catchAsync(async (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });
    const fileBase64 = await readProjectFile(project.id);
    if (!fileBase64) return res.status(404).json({ error: "File báo giá không tồn tại" });
    res.json({ id: project.id, fileBase64 });
  }));

  // Versions
  app.get("/api/projects/:id/versions", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });

    const rows = getDb()
      .prepare("SELECT * FROM versions WHERE project_id = ? ORDER BY version DESC")
      .all(project.id) as VersionRow[];

    res.json(
      rows.map((v) => ({
        id: v.id,
        projectId: v.project_id,
        version: v.version,
        note: v.note,
        createdBy: v.created_by,
        createdAt: v.created_at,
      }))
    );
  });

  app.get("/api/projects/:id/versions/:version", authMiddleware, catchAsync(async (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });

    const version = Number(req.params.version);
    const fileBase64 = await readVersionSnapshot(project.id, version);
    if (!fileBase64) return res.status(404).json({ error: "Version not found" });
    res.json({ version, fileBase64 });
  }));

  // Lấy cấu hình các vùng đã bị vô hiệu hóa (disabled_ranges - UC04 Tình huống 10)
  app.get("/api/projects/:id/disabled-ranges", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });

    let disabledRanges = {};
    try {
      disabledRanges = project.disabled_ranges ? JSON.parse(project.disabled_ranges) : {};
    } catch {
      disabledRanges = {};
    }
    res.json({ projectId: project.id, disabledRanges });
  });

  // Vô hiệu hóa logic ô, dòng, cột (UC04 Tình huống 10 - Cell-Range Deactivation)
  app.post("/api/projects/:id/disable-range", authMiddleware, requireAdminOrManager, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { sheetName, type, target } = req.body || {};
    if (!sheetName || !type || target === undefined || target === null) {
      return res.status(400).json({ error: "Thiếu thông tin: sheetName, type (CELL/ROW/COLUMN) hoặc target" });
    }

    const normType = String(type).toUpperCase();
    if (!["CELL", "ROW", "COLUMN"].includes(normType)) {
      return res.status(400).json({ error: "Type phải là CELL, ROW hoặc COLUMN" });
    }

    try {
      const updatedConfig = updateProjectDisabledRange(project.id, sheetName, "disable", normType as any, target);
      const timestamp = now();

      const payload = {
        projectId: project.id,
        sheetName,
        type: normType,
        target,
        disabledRanges: updatedConfig,
        updatedBy: user.username,
        timestamp,
      };

      io.to(`project:${project.id}`).emit("range.disabled", payload);
      io.to(`project:${project.id}`).emit("project:range:disabled", payload);

      res.json({
        success: true,
        disabledRanges: updatedConfig,
        sheetName,
        type: normType,
        target,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Lỗi cập nhật vô hiệu hóa vùng" });
    }
  });

  // Khôi phục ô, dòng, cột đã bị vô hiệu hóa
  app.post("/api/projects/:id/enable-range", authMiddleware, requireAdminOrManager, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { sheetName, type, target } = req.body || {};
    if (!sheetName || !type || target === undefined || target === null) {
      return res.status(400).json({ error: "Thiếu thông tin: sheetName, type (CELL/ROW/COLUMN) hoặc target" });
    }

    const normType = String(type).toUpperCase();
    if (!["CELL", "ROW", "COLUMN"].includes(normType)) {
      return res.status(400).json({ error: "Type phải là CELL, ROW hoặc COLUMN" });
    }

    try {
      const updatedConfig = updateProjectDisabledRange(project.id, sheetName, "enable", normType as any, target);
      const timestamp = now();

      const payload = {
        projectId: project.id,
        sheetName,
        type: normType,
        target,
        disabledRanges: updatedConfig,
        updatedBy: user.username,
        timestamp,
      };

      io.to(`project:${project.id}`).emit("range.enabled", payload);
      io.to(`project:${project.id}`).emit("project:range:enabled", payload);

      res.json({
        success: true,
        disabledRanges: updatedConfig,
        sheetName,
        type: normType,
        target,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Lỗi khôi phục vùng vô hiệu hóa" });
    }
  });

  // Edits - Dùng chung Edit Service cho Admin, Manager và Employee (Chương 8, 12, 13, 15, 16, 21, 22)
  app.post("/api/projects/:id/edits", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });
    if (user.role !== "admin" && user.role !== "manager" && isProjectLocked(project.trang_thai)) {
      return res.status(403).json({ error: "Báo giá đã bị khóa, không thể chỉnh sửa." });
    }

    const { sheetName, cell, newValue } = req.body || {};
    if (!sheetName || !cell) {
      return res.status(400).json({ error: "Thiếu sheetName hoặc cell" });
    }

    // 0. Kiểm tra vô hiệu hóa ô, dòng, cột (UC04 Tình huống 10 - Logical Deletion)
    if (isCellDisabled(sheetName, cell, project.disabled_ranges)) {
      return res.status(403).json({
        error: `Ô ${cell} đã bị Admin vô hiệu hóa, không thể chỉnh sửa.`,
        code: "CELL_DISABLED",
        cell,
        sheetName,
      });
    }

    // 1. Phân quyền cấp ô nghiêm ngặt (Default Deny - Chống bypass Postman)
    const permCheck = checkCellPermission(user, project, sheetName, cell);
    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.reason || "Bạn không có quyền chỉnh sửa ô này." });
    }

    // 2. Cell-level Optimistic Concurrency Control (Chương 12 & 13)
    const currentCell = getCellValue(project.id, sheetName, cell);
    const currentRevision = currentCell ? currentCell.revision : 0;
    const expectedRev = req.body.expectedRevision;
    if (expectedRev !== undefined && expectedRev !== null && Number(expectedRev) !== currentRevision) {
      return res.status(409).json({
        error: `Xung đột dữ liệu: Ô ${cell} vừa được cập nhật bởi ${currentCell?.updated_by || "người khác"}.`,
        conflict: true,
        cell,
        sheetName,
        latestValue: currentCell ? currentCell.value : "",
        latestRevision: currentRevision,
        updatedBy: currentCell ? currentCell.updated_by : "",
      });
    }

    // 3. Thực thi Transaction nguyên tử trong SQLite WAL (Chương 15 & 16)
    const nextRev = currentRevision + 1;
    const id = newId();
    const timestamp = now();
    const val = newValue !== undefined && newValue !== null ? String(newValue) : "";
    const oldVal = currentCell ? currentCell.value : (req.body.oldValue ? String(req.body.oldValue) : "");

    let nextSeq = 1;
    getDb().transaction(() => {
      const maxSeqRow = getDb().prepare("SELECT COALESCE(MAX(sequence), 0) AS m FROM edits WHERE project_id = ?").get(project.id) as { m: number };
      nextSeq = maxSeqRow.m + 1;

      // Lưu lịch sử chỉnh sửa (Audit Trail)
      getDb()
        .prepare(
          `INSERT INTO edits (id, project_id, user_id, username, sheet_name, cell, old_value, new_value, sequence, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(id, project.id, user.id, user.username, sheetName, cell, oldVal, val, nextSeq, timestamp);

      // Lưu/Cập nhật trạng thái ô hiện tại (Current Cell State)
      getDb()
        .prepare(
          `INSERT INTO project_cell_values (project_id, sheet_name, cell, value, revision, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(project_id, sheet_name, cell) DO UPDATE SET
             value = excluded.value,
             revision = excluded.revision,
             updated_by = excluded.updated_by,
             updated_at = excluded.updated_at`
        )
        .run(project.id, sheetName, cell, val, nextRev, user.username, timestamp);

      getDb().prepare("UPDATE projects SET project_revision = project_revision + 1, updated_at = ? WHERE id = ?").run(timestamp, project.id);
    })();

    // 4. Realtime Broadcast tới Room Project sau khi COMMIT thành công (Chương 21 & 22)
    io.to(`project:${project.id}`).emit("cell.updated", {
      projectId: project.id,
      sheetName,
      cell,
      oldValue: oldVal,
      newValue: val,
      revision: nextRev,
      sequence: nextSeq,
      updatedBy: user.username,
      userId: user.id,
      timestamp,
    });

    res.json({
      id,
      projectId: project.id,
      userId: user.id,
      username: user.username,
      sheetName,
      cell,
      oldValue: oldVal,
      newValue: val,
      revision: nextRev,
      sequence: nextSeq,
      timestamp,
    });
  });

  // Batch Edits (Lưu hàng loạt ô trong 1 transaction duy nhất - chống N+1 request)
  app.post("/api/projects/:id/edits/batch", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });
    if (user.role !== "admin" && user.role !== "manager" && isProjectLocked(project.trang_thai)) {
      return res.status(403).json({ error: "Báo giá đã bị khóa, không thể chỉnh sửa." });
    }

    const editsList = req.body?.edits;
    if (!Array.isArray(editsList) || editsList.length === 0) {
      return res.status(400).json({ error: "Danh sách edits không hợp lệ hoặc rỗng." });
    }

    // 0. Kiểm tra vô hiệu hóa ô, dòng, cột (UC04 Tình huống 10 - Logical Deletion)
    for (const item of editsList) {
      if (isCellDisabled(item.sheetName, item.cell, project.disabled_ranges)) {
        return res.status(403).json({
          error: `Ô ${item.cell} trên sheet "${item.sheetName}" đã bị Admin vô hiệu hóa.`,
          code: "CELL_DISABLED",
          cell: item.cell,
          sheetName: item.sheetName,
        });
      }
    }

    // 1. Phân quyền từng ô trong batch (Default Deny)
    for (const item of editsList) {
      const { sheetName, cell } = item;
      if (!sheetName || !cell) {
        return res.status(400).json({ error: "Mỗi mục phải có sheetName và cell" });
      }
      const permCheck = checkCellPermission(user, project, sheetName, cell);
      if (!permCheck.allowed) {
        return res.status(403).json({ error: permCheck.reason || `Bạn không có quyền sửa ô ${cell} trên sheet "${sheetName}".` });
      }
    }

    // 2. Kiểm tra OCC cho từng ô nếu có expectedRevision
    for (const item of editsList) {
      const { sheetName, cell, expectedRevision } = item;
      if (expectedRevision !== undefined && expectedRevision !== null) {
        const currentCell = getCellValue(project.id, sheetName, cell);
        const currentRevision = currentCell ? currentCell.revision : 0;
        if (Number(expectedRevision) !== currentRevision) {
          return res.status(409).json({
            error: `Xung đột dữ liệu tại ô ${cell}: vừa được cập nhật bởi ${currentCell?.updated_by || "người khác"}.`,
            conflict: true,
            cell,
            sheetName,
            latestValue: currentCell ? currentCell.value : "",
            latestRevision: currentRevision,
            updatedBy: currentCell ? currentCell.updated_by : "",
          });
        }
      }
    }

    // 3. Thực thi Transaction nguyên tử trong SQLite WAL
    const timestamp = now();
    const results: any[] = [];
    let nextSeq = 1;

    getDb().transaction(() => {
      const maxSeqRow = getDb().prepare("SELECT COALESCE(MAX(sequence), 0) AS m FROM edits WHERE project_id = ?").get(project.id) as { m: number };
      nextSeq = maxSeqRow.m;

      const insertEdit = getDb().prepare(
        `INSERT INTO edits (id, project_id, user_id, username, sheet_name, cell, old_value, new_value, sequence, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const upsertCell = getDb().prepare(
        `INSERT INTO project_cell_values (project_id, sheet_name, cell, value, revision, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, sheet_name, cell) DO UPDATE SET
           value = excluded.value,
           revision = excluded.revision,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at`
      );

      for (const item of editsList) {
        nextSeq++;
        const editId = newId();
        const currentCell = getCellValue(project.id, item.sheetName, item.cell);
        const currentRevision = currentCell ? currentCell.revision : 0;
        const nextRev = currentRevision + 1;
        const val = item.newValue !== undefined && item.newValue !== null ? String(item.newValue) : "";
        const oldVal = currentCell ? currentCell.value : (item.oldValue ? String(item.oldValue) : "");

        insertEdit.run(editId, project.id, user.id, user.username, item.sheetName, item.cell, oldVal, val, nextSeq, timestamp);
        upsertCell.run(project.id, item.sheetName, item.cell, val, nextRev, user.username, timestamp);

        results.push({
          id: editId,
          projectId: project.id,
          userId: user.id,
          username: user.username,
          sheetName: item.sheetName,
          cell: item.cell,
          oldValue: oldVal,
          newValue: val,
          revision: nextRev,
          sequence: nextSeq,
          timestamp,
        });
      }

      getDb().prepare("UPDATE projects SET project_revision = project_revision + ?, updated_at = ? WHERE id = ?").run(editsList.length, timestamp, project.id);
    })();

    // 4. Realtime Broadcast tới Room Project sau khi COMMIT thành công
    io.to(`project:${project.id}`).emit("cells.batch_updated", {
      projectId: project.id,
      edits: results,
      updatedBy: user.username,
      userId: user.id,
      timestamp,
    });

    res.json({ ok: true, count: results.length, edits: results });
  });

  app.get("/api/projects/:id/edits", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });

    const pageParam = req.query.page ? Number(req.query.page) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : 50;

    if (pageParam !== undefined) {
      const page = Math.max(1, pageParam);
      const limit = Math.max(1, Math.min(200, limitParam));
      const offset = (page - 1) * limit;

      const totalRow = getDb().prepare("SELECT COUNT(*) as c FROM edits WHERE project_id = ?").get(project.id) as { c: number };
      const total = totalRow.c;
      const totalPages = Math.ceil(total / limit);

      const rows = getDb()
        .prepare("SELECT * FROM edits WHERE project_id = ? ORDER BY sequence DESC, timestamp DESC LIMIT ? OFFSET ?")
        .all(project.id, limit, offset) as EditRow[];

      return res.json({
        items: rows.map(editToJson),
        total,
        page,
        limit,
        totalPages,
      });
    }

    // Trả về toàn bộ edits của dự án theo thứ tự chấp nhận sequence ASC, timestamp ASC
    const rows = getDb()
      .prepare("SELECT * FROM edits WHERE project_id = ? ORDER BY sequence ASC, timestamp ASC")
      .all(project.id) as EditRow[];

    res.json(rows.map(editToJson));
  });

  // Templates
  app.get("/api/templates", authMiddleware, (_req, res) => {
    const rows = getDb().prepare("SELECT * FROM templates ORDER BY created_at DESC").all() as TemplateRow[];
    res.json(
      rows.map((t) => ({
        id: t.id,
        name: t.name,
        sheets: JSON.parse(t.sheets || "[]"),
        editableRanges: JSON.parse(t.editable_ranges || "{}"),
        createdAt: t.created_at,
      }))
    );
  });

  app.post("/api/templates", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {
    const { name, fileBase64, sheets, editableRanges } = req.body || {};
    if (!name || !fileBase64) return res.status(400).json({ error: "Missing fields" });
    const id = newId();
    getDb()
      .prepare("INSERT INTO templates (id, name, sheets, editable_ranges, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, name, JSON.stringify(sheets || []), JSON.stringify(editableRanges || {}), now());
    await saveTemplateFile(id, fileBase64);
    res.json({
      id,
      name,
      sheets: sheets || [],
      editableRanges: editableRanges || {},
      createdAt: now(),
    });
  }));

  app.post("/api/templates/:id/clone", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {
    const user = req.user!;
    const template = getDb().prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id) as TemplateRow | undefined;
    if (!template) return res.status(404).json({ error: "Template not found" });

    const fileBase64 = await readTemplateFile(template.id);
    if (!fileBase64) return res.status(404).json({ error: "Template file missing" });

    const name = req.body?.name || `Báo giá từ ${template.name}`;
    const id = newId();
    const ts = now();
    const ownerId = (user.role === "admin" || user.role === "manager") ? req.body?.nguoiPhuTrachId || null : user.id;

    getDb()
      .prepare(
        `INSERT INTO projects
        (id, name, sheets, editable_ranges, so_bao_gia, ten_khach_hang, nguoi_phu_trach_id, trang_thai, ghi_chu, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'nhap', '', 1, ?, ?)`
      )
      .run(
        id,
        name,
        template.sheets,
        template.editable_ranges,
        req.body?.soBaoGia || "",
        req.body?.tenKhachHang || "",
        ownerId,
        ts,
        ts
      );
    await saveProjectFile(id, fileBase64);
    res.json(await projectWithFile(loadProject(id)!));
  }));

  app.delete("/api/templates/:id", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {
    const result = getDb().prepare("DELETE FROM templates WHERE id = ?").run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: "Template not found" });
    await deleteTemplateFile(req.params.id);
    res.json({ ok: true });
  }));

  // Vite / static
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  
  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY' || err.code === '23505' || err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'Dữ liệu đã tồn tại hoặc vi phạm ràng buộc dữ liệu.' });
    }
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors });
    }
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ error: err.message || 'Internal Server Error' });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! Shutting down...', err);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! Shutting down...', err);
    process.exit(1);
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

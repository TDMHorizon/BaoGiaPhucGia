import { AppError } from "./server/utils/AppError";
import { catchAsync } from "./server/utils/catchAsync";
import { z } from "zod";
import { validate } from "./server/middlewares/validate";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initDb, getDb, projectToJson, getProjectMembers, setProjectMembers, userCanAccessProject, isProjectLocked, publicUser, type ProjectRow, type UserRow, type TrangThai, type EditRow, type VersionRow, type TemplateRow } from "./server/db";
import { authenticateUser, signToken, authMiddleware, requireAdmin, requireAdminOrManager, hashPassword } from "./server/auth";
import {
  ensureDataDirs,
  saveProjectFile,
  readProjectFile,
  readVersionSnapshot,
  saveTemplateFile,
  readTemplateFile,
  deleteTemplateFile,
} from "./server/files";

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

function loadProject(id: string, includeDeleted = false): ProjectRow | undefined {
  const query = includeDeleted
    ? "SELECT * FROM projects WHERE id = ?"
    : "SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL";
  return getDb().prepare(query).get(id) as ProjectRow | undefined;
}

async function projectWithFile(p: ProjectRow) {
  const members = getProjectMembers(p.id);
  const json = projectToJson(p, members);
  const fileBase64 = await readProjectFile(p.id);
  return { ...json, fileBase64 };
}

function listSummary(p: ProjectRow) {
  const members = getProjectMembers(p.id);
  return projectToJson(p, members);
}

async function startServer() {
  ensureDataDirs();
  initDb();

  const app = express();
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
    const user = authenticateUser(username, password);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const token = signToken(user);
    res.json({ ...user, token });
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
    const { username, password, role } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    const r = role === "admin" ? "admin" : role === "manager" ? "manager" : "user";
    const id = newId();
    try {
      getDb()
        .prepare("INSERT INTO users (id, username, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)")
        .run(id, username.trim(), hashPassword(password), r, now());
      const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
      res.json(publicUser(row));
    } catch {
      res.status(400).json({ error: "Username already exists" });
    }
  });

  app.patch("/api/users/:id", authMiddleware, requireAdmin, (req, res) => {
    const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as UserRow | undefined;
    if (!row) return res.status(404).json({ error: "User not found" });

    const { username, password, role, active } = req.body || {};
    const nextUsername = username?.trim() || row.username;
    const nextRole = role === "admin" || role === "manager" || role === "user" ? role : row.role;
    const nextActive = typeof active === "boolean" ? (active ? 1 : 0) : row.active;
    const nextHash = password ? hashPassword(password) : row.password_hash;

    try {
      getDb()
        .prepare("UPDATE users SET username = ?, password_hash = ?, role = ?, active = ? WHERE id = ?")
        .run(nextUsername, nextHash, nextRole, nextActive, row.id);
      const updated = getDb().prepare("SELECT * FROM users WHERE id = ?").get(row.id) as UserRow;
      res.json(publicUser(updated));
    } catch {
      res.status(400).json({ error: "Update failed" });
    }
  });

  app.delete("/api/users/:id", authMiddleware, requireAdmin, (req, res) => {
    const user = req.user!;
    if (user.id === req.params.id) return res.status(400).json({ error: "Cannot delete yourself" });
    const result = getDb().prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true });
  });

  // Projects list
  app.get("/api/projects", authMiddleware, (req, res) => {
    const user = req.user!;
    const q = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim();
    const assignee = String(req.query.assignee || "").trim();

    let rows = getDb().prepare("SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY updated_at DESC").all() as ProjectRow[];

    if (user.role !== "admin" && user.role !== "manager") {
      rows = rows.filter((p) => userCanAccessProject(user, p));
    }

    if (status) rows = rows.filter((p) => p.trang_thai === status);
    if (assignee) {
      rows = rows.filter((p) => {
        if (p.nguoi_phu_trach_id === assignee) return true;
        return getProjectMembers(p.id).includes(assignee);
      });
    }
    if (q) {
      rows = rows.filter((p) => {
        const hay = `${p.name} ${p.so_bao_gia} ${p.ten_khach_hang} ${p.ghi_chu}`.toLowerCase();
        return hay.includes(q);
      });
    }

    res.json(rows.map(listSummary));
  });

  app.get("/api/projects/pending-count", authMiddleware, requireAdminOrManager, (_req, res) => {
    const row = getDb()
      .prepare("SELECT COUNT(*) as c FROM projects WHERE deleted_at IS NULL AND trang_thai IN ('dang_lam', 'cho_duyet')")
      .get() as { c: number };
    res.json({ count: row.c });
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
      trangThai,
    } = req.body || {};

    if (!name || !fileBase64) return res.status(400).json({ error: "Missing name or file" });

    const id = newId();
    const ts = now();
    const ownerId = (user.role === "admin" || user.role === "manager") ? nguoiPhuTrachId || null : user.id;
    const members: string[] = Array.isArray(memberIds) ? memberIds : [];

    getDb()
      .prepare(
        `INSERT INTO projects
        (id, name, sheets, editable_ranges, so_bao_gia, ten_khach_hang, nguoi_phu_trach_id, trang_thai, ghi_chu, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(
        id,
        name,
        JSON.stringify(sheets || []),
        JSON.stringify(editableRanges || {}),
        soBaoGia || "",
        tenKhachHang || "",
        ownerId,
        trangThai || "nhap",
        ghiChu || "",
        ts,
        ts
      );

    if (members.length) setProjectMembers(id, members);
    await saveProjectFile(id, fileBase64);

    const project = loadProject(id)!;
    res.json(await projectWithFile(project));
  }));

  app.get("/api/projects/deleted", authMiddleware, requireAdminOrManager, (_req, res) => {
    const rows = getDb().prepare("SELECT * FROM projects WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").all() as ProjectRow[];
    res.json(rows.map(listSummary));
  });

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
      if (Array.isArray(body.memberIds)) setProjectMembers(project.id, body.memberIds);
    } else {
      if (body.ghiChu !== undefined) ghiChu = body.ghiChu;
    }

    getDb()
      .prepare(
        `UPDATE projects SET name = ?, so_bao_gia = ?, ten_khach_hang = ?, nguoi_phu_trach_id = ?,
         ghi_chu = ?, editable_ranges = ?, sheets = ?, updated_at = ? WHERE id = ?`
      )
      .run(name, soBaoGia, tenKhachHang, nguoiPhuTrachId, ghiChu, editableRanges, sheets, now(), project.id);

    res.json(await projectWithFile(loadProject(project.id)!));
  }));

  app.delete("/api/projects/:id", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (project.deleted_at) return res.status(400).json({ error: "Project already deleted" });
    getDb().prepare("UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?").run(now(), now(), project.id);
    res.json({ ok: true, deletedAt: now() });
  }));

  app.post("/api/projects/:id/restore", authMiddleware, requireAdminOrManager, (req, res) => {
    const project = loadProject(req.params.id, true);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!project.deleted_at) return res.status(400).json({ error: "Project is not deleted" });
    const restoredAt = now();
    getDb().prepare("UPDATE projects SET deleted_at = NULL, updated_at = ? WHERE id = ?").run(restoredAt, project.id);
    res.json(listSummary(loadProject(project.id)!));
  });

  app.put("/api/projects/:id/ranges", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    getDb()
        .prepare("UPDATE projects SET editable_ranges = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(req.body.editableRanges || {}), now(), project.id);

    res.json({ success: true });
  }));

  // Chỉ admin được cập nhật file gốc (cấu trúc sheet). Nhân viên không ghi đè.
  app.put("/api/projects/:id/file", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { fileBase64, sheets } = req.body || {};
    if (!fileBase64) return res.status(400).json({ error: "Missing file" });

    saveProjectFile(project.id, fileBase64);
    if (sheets) {
      getDb()
        .prepare("UPDATE projects SET sheets = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(sheets), now(), project.id);
    } else {
      getDb().prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now(), project.id);
    }

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

    // Bản gốc trên server không đổi. Chỉ cập nhật trạng thái theo dõi.
    getDb()
      .prepare("UPDATE projects SET trang_thai = ?, updated_at = ? WHERE id = ?")
      .run(nextStatus, now(), project.id);

    res.json(await projectWithFile(loadProject(project.id)!));
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

  // Edits
  app.post("/api/projects/:id/edits", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });
    if (user.role !== "admin" && user.role !== "manager" && isProjectLocked(project.trang_thai)) {
      return res.status(403).json({ error: "Project is locked" });
    }

    const { sheetName, cell, oldValue, newValue } = req.body || {};
    const id = newId();
    const timestamp = now();
    const safeUserId = user?.id || "unknown";
    const safeUsername = user?.username || "Admin";
    const safeSheetName = sheetName || "";
    const safeCell = cell || "";
    const safeOldValue = oldValue || "";
    const safeNewValue = newValue || "";
    getDb()
      .prepare(
        `INSERT INTO edits (id, project_id, user_id, username, sheet_name, cell, old_value, new_value, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, project.id, user.id, user.username, sheetName, cell, oldValue ?? "", newValue ?? "", timestamp);

    getDb().prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(timestamp, project.id);

    res.json({
      id,
      projectId: project.id,
      userId: user.id,
      username: user.username,
      sheetName,
      cell,
      oldValue,
      newValue,
      timestamp,
    });
  });

  app.get("/api/projects/:id/edits", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });

    let rows: EditRow[] = [];
    if (user.role === "admin" || user.role === "manager") {
      rows = getDb()
        .prepare("SELECT * FROM edits WHERE project_id = ? ORDER BY timestamp DESC")
        .all(project.id) as EditRow[];
    } else {
      rows = getDb()
        .prepare("SELECT * FROM edits WHERE project_id = ? AND user_id = ? ORDER BY timestamp DESC")
        .all(project.id, user.id) as EditRow[];
    }

    res.json(
      rows.map((e) => ({
        id: e.id,
        projectId: e.project_id,
        userId: e.user_id,
        username: e.username,
        sheetName: e.sheet_name,
        cell: e.cell,
        oldValue: e.old_value,
        newValue: e.new_value,
        timestamp: e.timestamp,
      }))
    );
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

  app.post("/api/templates/:id/clone", authMiddleware, catchAsync(async (req, res) => {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

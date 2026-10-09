import { AppError } from "./server/utils/AppError";
import { catchAsync } from "./server/utils/catchAsync";
import { z } from "zod";
import { validate } from "./server/middlewares/validate";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initDb, getDb, projectToJson, getProjectMembers, setProjectMembers, userCanAccessProject, isProjectLocked, publicUser, setProjectRoleVisibility, getProjectRoleVisibilities, isProjectHiddenForUser, saveWorkbookSnapshot, getLatestWorkbookSnapshot, recordWorkbookCommand, type ProjectRow, type UserRow, type TrangThai, type EditRow, type VersionRow, type TemplateRow } from "./server/db";
import { logger } from "./server/logger";
import { authenticateUser, signToken, authMiddleware, requireAdmin, requireAdminOrManager, hashPassword } from "./server/auth";
import {
  isCellWithinRange,
  isValidCellRef,
  normalizeRangeRef,
} from "./server/permission-ranges";
import {
  parseProjectPermissionGrants,
  PermissionInputError,
  createProjectHiddenRange,
  getHiddenRangesForUser,
  getUserProjectPermissions,
  renameProjectSheetPermissions,
  replaceUserProjectPermissions,
  shiftProjectSheetPermissions,
  userCanEditRange,
  userCanSeeCell,
} from "./server/permissions";
import {
  ensureDataDirs,
  saveProjectFile,
  readProjectFile,
  readProjectWorkbookBuffer,
  decodeProjectWorkbookBase64,
  withStagedProjectWorkbook,
  readVersionSnapshot,
  saveTemplateFile,
  readTemplateFile,
  deleteTemplateFile,
} from "./server/files";
import { applyCellEditToWorkbookBuffer, getCellEditAffectedRange } from "./server/workbook-edits";
import { createReadableWorkbookBuffer } from "./server/workbook-access";
import {
  commitCellEditRevision,
  ProjectCellEditForbidden,
  ProjectEditUnavailable,
  ProjectRevisionConflict,
} from "./server/workbook-revisions";

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

const projectWriteTails = new Map<string, Promise<void>>();

async function withProjectWriteLock<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
  const previous = projectWriteTails.get(projectId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => gate);
  projectWriteTails.set(projectId, tail);
  await previous.catch(() => undefined);

  try {
    return await operation();
  } finally {
    release();
    if (projectWriteTails.get(projectId) === tail) projectWriteTails.delete(projectId);
  }
}

function loadProject(id: string, includeDeleted = false): ProjectRow | undefined {
  const query = includeDeleted
    ? "SELECT * FROM projects WHERE id = ?"
    : "SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL";
  return getDb().prepare(query).get(id) as ProjectRow | undefined;
}

async function projectWithFile(p: ProjectRow, user: { id: string; role: string }) {
  const members = getProjectMembers(p.id);
  const json = projectToJson(p, members);
  if (user.role === "admin") {
    const fileBase64 = await readProjectFile(p.id);
    return { ...json, fileBase64 };
  }

  const role = user.role === "manager" ? "manager" : "user";
  const grants = role === "manager"
    ? (JSON.parse(p.sheets || "[]") as string[]).map((sheetName) => ({
        sheetName,
        rangeRef: "*",
        canRead: true,
        canEdit: true,
      }))
    : getUserProjectPermissions(getDb(), p.id, user.id);
  const source = await readProjectWorkbookBuffer(p.id);
  const hiddenRanges = getHiddenRangesForUser(getDb(), p.id, {
    id: user.id,
    role,
  });
  if (role === "manager" && hiddenRanges.length === 0) {
    return { ...json, fileBase64: await readProjectFile(p.id) };
  }
  const readable = await createReadableWorkbookBuffer(source, grants, hiddenRanges);
  return {
    ...json,
    sheets: readable.sheetNames,
    ...(role === "user" ? { editableRanges: {}, memberIds: [] } : {}),
    fileBase64: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${readable.buffer.toString("base64")}`,
  };
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
    const includeHidden = req.query.includeHidden === "true" && user.role === "admin";

    let rows = getDb().prepare("SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY updated_at DESC").all() as ProjectRow[];

    // Enforce role-based project visibility
    if (!includeHidden) {
      rows = rows.filter((p) => !isProjectHiddenForUser(p.id, user));
    }

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

    res.json(rows.map((project) => {
      const summary = listSummary(project);
      const visibilities = (user.role === "admin" || user.role === "manager")
        ? getProjectRoleVisibilities(project.id)
        : [];
      return user.role === "admin" || user.role === "manager"
        ? { ...summary, visibilities }
        : { ...summary, sheets: [], editableRanges: {}, memberIds: [] };
    }));
  });

  // Project Visibility API
  app.get("/api/projects/:id/visibility", authMiddleware, requireAdminOrManager, (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const list = getProjectRoleVisibilities(project.id);
    res.json(list);
  });

  app.put("/api/projects/:id/visibility", authMiddleware, requireAdminOrManager, (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const body = z.object({
      role: z.enum(["admin", "manager", "user"]),
      userId: z.string().nullable().optional(),
      isHidden: z.boolean(),
      canView: z.boolean().optional(),
      canEdit: z.boolean().optional(),
    }).safeParse(req.body);

    if (!body.success) return res.status(400).json({ error: "Invalid payload" });

    // Only Admin can hide files from Managers; Managers can only hide files from Users
    if (req.user!.role === "manager" && body.data.role !== "user") {
      return res.status(403).json({ error: "Manager can only configure visibility for employees (user role)." });
    }

    setProjectRoleVisibility(project.id, body.data.role, {
      userId: body.data.userId || null,
      isHidden: body.data.isHidden,
      canView: body.data.canView,
      canEdit: body.data.canEdit,
      hiddenBy: req.user!.id,
    });

    logger.audit("UPDATE_PROJECT_VISIBILITY", {
      userId: req.user!.id,
      role: req.user!.role,
      projectId: project.id,
      payload: body.data,
    });

    res.json({ success: true, visibilities: getProjectRoleVisibilities(project.id) });
  });

  // Project Snapshot API (Runtime SSOT Persistence)
  app.post("/api/projects/:id/snapshot", authMiddleware, catchAsync(async (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { snapshotJson, version } = req.body || {};
    if (!snapshotJson) return res.status(400).json({ error: "Missing snapshotJson" });

    const ver = typeof version === "number" ? version : project.version;
    saveWorkbookSnapshot(project.id, ver, typeof snapshotJson === "string" ? snapshotJson : JSON.stringify(snapshotJson), req.user!.id);

    logger.info("WORKBOOK_SNAPSHOT", "SAVE_SNAPSHOT_SUCCESS", { projectId: project.id, version: ver });
    res.json({ success: true, version: ver });
  }));

  app.get("/api/projects/:id/snapshot", authMiddleware, (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const snapshot = getLatestWorkbookSnapshot(project.id);
    res.json({ snapshotJson: snapshot });
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
    res.json(await projectWithFile(project, user));
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
    res.json(await projectWithFile(project, user));
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

    res.json(await projectWithFile(loadProject(project.id)!, user));
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

  app.get("/api/projects/:id/permissions/me", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });

    if (user.role === "admin" || user.role === "manager") {
      return res.json({ fullAccess: true, grants: [] });
    }

    const grants = getUserProjectPermissions(getDb(), project.id, user.id);
    res.json({ fullAccess: false, grants });
  });

  app.get(
    "/api/projects/:id/permissions/:userId",
    authMiddleware,
    requireAdminOrManager,
    (req, res) => {
      const project = loadProject(req.params.id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const targetUser = getDb()
        .prepare("SELECT id, role FROM users WHERE id = ?")
        .get(req.params.userId) as Pick<UserRow, "id" | "role"> | undefined;
      if (!targetUser || targetUser.role !== "user") {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json({ userId: targetUser.id, grants: getUserProjectPermissions(getDb(), project.id, targetUser.id) });
    },
  );

  app.get("/api/projects/:id/hidden-ranges", authMiddleware, requireAdminOrManager, (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const rows = getDb().prepare(`
      SELECT id, sheet_name AS sheetName, range_ref AS rangeRef,
        hidden_by_user_id AS hiddenByUserId, hidden_by_role AS hiddenByRole,
        hidden_for_user_id AS hiddenForUserId, created_at AS createdAt
      FROM project_hidden_ranges
      WHERE project_id = ? AND (? = 'admin' OR hidden_by_user_id = ?)
      ORDER BY sheet_name, range_ref
    `).all(project.id, req.user!.role, req.user!.id);
    res.json(rows);
  });

  app.post("/api/projects/:id/hidden-ranges", authMiddleware, requireAdminOrManager, (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const body = z.object({
      sheetName: z.string().trim().min(1),
      rangeRef: z.string().trim().min(1),
      userId: z.string().trim().min(1).optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Invalid hidden-range payload." });

    const sheets = z.array(z.string()).safeParse(JSON.parse(project.sheets || "[]"));
    if (!sheets.success || !sheets.data.includes(body.data.sheetName)) {
      return res.status(400).json({ error: "Unknown worksheet." });
    }

    let rangeRef: string;
    try {
      rangeRef = normalizeRangeRef(body.data.rangeRef);
    } catch (error) {
      if (error instanceof RangeError) return res.status(400).json({ error: error.message });
      throw error;
    }

    let hiddenForUserId: string | null = null;
    if (body.data.userId) {
      const target = getDb()
        .prepare("SELECT id, role, active FROM users WHERE id = ?")
        .get(body.data.userId) as Pick<UserRow, "id" | "role" | "active"> | undefined;
      if (!target || target.role !== "user" || !target.active) {
        return res.status(400).json({ error: "Specific hidden ranges can only target active employees." });
      }
      hiddenForUserId = target.id;
    }

    try {
      const id = createProjectHiddenRange(getDb(), {
        projectId: project.id,
        sheetName: body.data.sheetName,
        rangeRef,
        hiddenByUserId: req.user!.id,
        hiddenByRole: req.user!.role as "admin" | "manager",
        hiddenForUserId,
        createdAt: now(),
      });
      res.status(201).json({ id, sheetName: body.data.sheetName, rangeRef, hiddenForUserId });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        return res.status(409).json({ error: "This hidden range already exists." });
      }
      throw error;
    }
  });

  app.delete(
    "/api/projects/:id/hidden-ranges/:hiddenRangeId",
    authMiddleware,
    requireAdminOrManager,
    (req, res) => {
      const project = loadProject(req.params.id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const result = getDb().prepare(`
        DELETE FROM project_hidden_ranges
        WHERE id = ? AND project_id = ?
          AND (? = 'admin' OR hidden_by_user_id = ?)
      `).run(req.params.hiddenRangeId, project.id, req.user!.role, req.user!.id);
      if (!result.changes) return res.status(404).json({ error: "Hidden range not found." });
      res.json({ success: true });
    },
  );

  app.put(
    "/api/projects/:id/permissions/:userId",
    authMiddleware,
    requireAdminOrManager,
    (req, res) => {
      const project = loadProject(req.params.id);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const targetUser = getDb()
        .prepare("SELECT id, role, active FROM users WHERE id = ?")
        .get(req.params.userId) as Pick<UserRow, "id" | "role" | "active"> | undefined;
      if (!targetUser) return res.status(404).json({ error: "User not found" });
      if (targetUser.role !== "user" || !targetUser.active) {
        return res.status(400).json({ error: "Permissions can only be assigned to active employees." });
      }

      const sheetNames = z.array(z.string()).safeParse(JSON.parse(project.sheets || "[]"));
      if (!sheetNames.success) {
        return res.status(500).json({ error: "Project sheet metadata is invalid." });
      }

      let grants;
      try {
        grants = parseProjectPermissionGrants(req.body?.grants);
      } catch (error) {
        if (error instanceof PermissionInputError) {
          return res.status(400).json({ error: error.message });
        }
        throw error;
      }

      const knownSheetNames = new Set(sheetNames.data);
      if (grants.some((grant) => !knownSheetNames.has(grant.sheetName))) {
        return res.status(400).json({ error: "A permission grant references an unknown sheet." });
      }

      const grantCount = replaceUserProjectPermissions(getDb(), {
        projectId: project.id,
        userId: targetUser.id,
        grantedBy: req.user!.id,
        grants,
      });
      res.json({ success: true, userId: targetUser.id, grantCount });
    },
  );

  // Chỉ admin được cập nhật file gốc (cấu trúc sheet). Nhân viên không ghi đè.
  app.put("/api/projects/:id/file", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const body = z.object({
      fileBase64: z.string().min(1),
      sheets: z.array(z.string()).optional(),
      baseRevision: z.number().int().min(1),
      structureChange: z.object({
        sheetName: z.string().trim().min(1),
        axis: z.enum(["row", "column"]),
        action: z.enum(["insert", "delete"]),
        index: z.number().int().min(1).max(1_048_576),
      }).refine(
        (change) => change.axis !== "column" || change.index <= 16_384,
        "Column index exceeds Excel's limit.",
      ).optional(),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Invalid workbook save payload." });

    try {
      const result = await withProjectWriteLock(project.id, async () => {
        const current = loadProject(project.id);
        if (!current) return { status: 404 as const, error: "Project not found" };
        if (current.version !== body.data.baseRevision) {
          return {
            status: 409 as const,
            error: "The workbook has changed. Reload it before saving.",
            currentRevision: current.version,
          };
        }

        const nextRevision = current.version + 1;
        const updatedAt = now();
        const stagedWorkbook = decodeProjectWorkbookBase64(body.data.fileBase64);
        const save = await withStagedProjectWorkbook(
          current.id,
          stagedWorkbook,
          (promote, restore) => {
            const transaction = getDb().transaction(() => {
              const latest = loadProject(current.id);
              if (!latest) throw new ProjectEditUnavailable("Project not found.");
              if (latest.version !== body.data.baseRevision) {
                throw new ProjectRevisionConflict(latest.version);
              }

              promote();
              try {
                const nextSheets = body.data.sheets ?? JSON.parse(latest.sheets || "[]") as string[];
                const previousSheets = JSON.parse(latest.sheets || "[]") as string[];
                const removedSheets = previousSheets.filter((sheet) => !nextSheets.includes(sheet));
                const addedSheets = nextSheets.filter((sheet) => !previousSheets.includes(sheet));
                const updatedAt = now();

                if (removedSheets.length === 1 && addedSheets.length === 1 && previousSheets.length === nextSheets.length) {
                  renameProjectSheetPermissions(
                    getDb(),
                    current.id,
                    removedSheets[0],
                    addedSheets[0],
                    updatedAt,
                  );
                }

                if (body.data.structureChange) {
                  shiftProjectSheetPermissions(
                    getDb(),
                    current.id,
                    body.data.structureChange.sheetName,
                    body.data.structureChange,
                    updatedAt,
                  );
                }

                const update = getDb().prepare(`
                  UPDATE projects
                  SET sheets = ?, version = ?, updated_at = ?
                  WHERE id = ? AND version = ?
                `).run(
                  JSON.stringify(nextSheets),
                  nextRevision,
                  updatedAt,
                  current.id,
                  body.data.baseRevision,
                );
                if (update.changes !== 1) {
                  const newest = loadProject(current.id);
                  throw new ProjectRevisionConflict(newest?.version ?? body.data.baseRevision);
                }
              } catch (error) {
                restore();
                throw error;
              }
            });

            try {
              transaction.immediate();
              return { revision: nextRevision };
            } catch (error) {
              restore();
              throw error;
            }
          },
        );
        return { status: 200 as const, ...save };
      });

      if (result.status !== 200) {
        return res.status(result.status).json({
          error: result.error,
          ...("currentRevision" in result ? { currentRevision: result.currentRevision } : {}),
        });
      }
      res.json({ success: true, revision: result.revision });
    } catch (error) {
      if (error instanceof ProjectRevisionConflict) {
        return res.status(409).json({ error: error.message, currentRevision: error.currentRevision });
      }
      if (error instanceof ProjectEditUnavailable && error.message === "Project not found.") {
        return res.status(404).json({ error: "Project not found" });
      }
      throw error;
    }
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

    res.json(await projectWithFile(loadProject(project.id)!, user));
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
    if (user.role === "admin") {
      return res.json({ version, fileBase64 });
    }

    const isManager = user.role === "manager";
    const grants = isManager
      ? (JSON.parse(project.sheets || "[]") as string[]).map((sheetName) => ({
          sheetName,
          rangeRef: "*",
          canRead: true,
          canEdit: true,
        }))
      : getUserProjectPermissions(getDb(), project.id, user.id);
    const hiddenRanges = getHiddenRangesForUser(getDb(), project.id, user);
    if (isManager && hiddenRanges.length === 0) {
      return res.json({ version, fileBase64 });
    }
    const readable = await createReadableWorkbookBuffer(
      decodeProjectWorkbookBase64(fileBase64),
      grants,
      hiddenRanges,
    );
    res.json({
      version,
      sheets: readable.sheetNames,
      fileBase64: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${readable.buffer.toString("base64")}`,
    });
  }));

  // Edits
  app.post("/api/projects/:id/edits", authMiddleware, catchAsync(async (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });
    if (user.role !== "admin" && user.role !== "manager" && isProjectLocked(project.trang_thai)) {
      return res.status(403).json({ error: "Project is locked" });
    }

    const body = z.object({
      sheetName: z.string().trim().min(1),
      cell: z.string().refine(isValidCellRef, "Invalid cell reference."),
      newValue: z.string(),
      baseRevision: z.number().int().min(1),
    }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Invalid edit payload." });

    const sheetName = body.data.sheetName;
    const cell = normalizeRangeRef(body.data.cell);
    return withProjectWriteLock(project.id, async () => {
      const current = loadProject(project.id);
      if (!current) return res.status(404).json({ error: "Project not found" });
      if (!userCanAccessProject(user, current)) return res.status(403).json({ error: "Forbidden" });
      if (user.role === "user" && isProjectLocked(current.trang_thai)) {
        return res.status(403).json({ error: "Project is locked" });
      }
      if (current.version !== body.data.baseRevision) {
        return res.status(409).json({
          error: "The workbook has changed. Reload it before saving.",
          currentRevision: current.version,
        });
      }

      const sheetNames = z.array(z.string()).safeParse(JSON.parse(current.sheets || "[]"));
      if (!sheetNames.success || !sheetNames.data.includes(sheetName)) {
        return res.status(400).json({ error: "Unknown worksheet." });
      }
      try {
        const sourceWorkbook = await readProjectWorkbookBuffer(current.id);
        const affectedRange = await getCellEditAffectedRange(sourceWorkbook, sheetName, cell);
        if (
          user.role === "user" &&
          !userCanEditRange(getDb(), user.id, current.id, sheetName, affectedRange)
        ) {
          return res.status(403).json({ error: "You do not have edit permission for the full affected cell range." });
        }
        const { buffer: editedWorkbook, oldValue } = await applyCellEditToWorkbookBuffer(
          sourceWorkbook,
          sheetName,
          cell,
          body.data.newValue,
        );
        const timestamp = now();
        const saved = await withStagedProjectWorkbook(
          current.id,
          editedWorkbook,
          (promote, restore) => commitCellEditRevision(
            getDb(),
            {
              projectId: current.id,
              user,
              sheetName,
              cell,
              affectedRange,
              oldValue,
              newValue: body.data.newValue,
              baseRevision: body.data.baseRevision,
              timestamp,
            },
            promote,
            restore,
          ),
        );

        return res.json({
          id: saved.id,
          projectId: saved.projectId,
          userId: saved.user.id,
          username: saved.user.username,
          sheetName: saved.sheetName,
          cell: saved.cell,
          oldValue: saved.oldValue,
          newValue: saved.newValue,
          baseRevision: saved.baseRevision,
          revision: saved.revision,
          timestamp: saved.timestamp,
        });
      } catch (error) {
        if (error instanceof ProjectRevisionConflict) {
          return res.status(409).json({ error: error.message, currentRevision: error.currentRevision });
        }
        if (error instanceof ProjectCellEditForbidden) {
          return res.status(403).json({ error: error.message });
        }
        if (error instanceof ProjectEditUnavailable) {
          if (error.message === "Project not found.") return res.status(404).json({ error: "Project not found" });
          if (error.message === "Forbidden.") return res.status(403).json({ error: "Forbidden" });
          if (error.message === "Project is locked.") return res.status(403).json({ error: error.message });
        }
        throw error;
      }
    });
  }));

  app.get("/api/projects/:id/edits", authMiddleware, (req, res) => {
    const user = req.user!;
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!userCanAccessProject(user, project)) return res.status(403).json({ error: "Forbidden" });

    let rows: EditRow[] = [];
    if (user.role === "admin") {
      rows = getDb()
        .prepare("SELECT * FROM edits WHERE project_id = ? ORDER BY timestamp DESC")
        .all(project.id) as EditRow[];
    } else if (user.role === "manager") {
      rows = (getDb()
        .prepare("SELECT * FROM edits WHERE project_id = ? ORDER BY timestamp DESC")
        .all(project.id) as EditRow[])
        .filter((edit) => userCanSeeCell(getDb(), user, project.id, edit.sheet_name, edit.cell));
    } else {
      rows = getDb()
        .prepare("SELECT * FROM edits WHERE project_id = ? AND user_id = ? ORDER BY timestamp DESC")
        .all(project.id, user.id) as EditRow[];
      rows = rows.filter((edit) =>
        userCanSeeCell(getDb(), user, project.id, edit.sheet_name, edit.cell),
      );
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
        baseRevision: e.base_revision,
        revision: e.revision,
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
    res.json(await projectWithFile(loadProject(id)!, user));
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

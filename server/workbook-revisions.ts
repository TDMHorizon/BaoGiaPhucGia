import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { isProjectLocked } from "./db";
import { userCanEditRange } from "./permissions";

export class ProjectRevisionConflict extends Error {
  constructor(readonly currentRevision: number) {
    super("The workbook has changed. Reload it before saving this edit.");
  }
}

export class ProjectCellEditForbidden extends Error {
  constructor() {
    super("You do not have edit permission for this cell.");
  }
}

export class ProjectEditUnavailable extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type CellEditRevisionInput = {
  projectId: string;
  user: { id: string; username: string; role: "admin" | "manager" | "user" };
  sheetName: string;
  cell: string;
  affectedRange: string;
  oldValue: string;
  newValue: string;
  baseRevision: number;
  timestamp: string;
};

export type SavedCellEdit = CellEditRevisionInput & {
  id: string;
  revision: number;
};

export function commitCellEditRevision(
  database: Database.Database,
  input: CellEditRevisionInput,
  promoteWorkbook: () => void,
  restoreWorkbook: () => void,
): SavedCellEdit {
  let promoted = false;
  const commit = database.transaction(() => {
    const project = database.prepare(`
      SELECT version, trang_thai, nguoi_phu_trach_id
      FROM projects
      WHERE id = ? AND deleted_at IS NULL
    `).get(input.projectId) as {
      version: number;
      trang_thai: string;
      nguoi_phu_trach_id: string | null;
    } | undefined;
    if (!project) throw new ProjectEditUnavailable("Project not found.");

    if (input.user.role === "user") {
      const isMember = !!database.prepare(
        "SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?",
      ).get(input.projectId, input.user.id);
      if (project.nguoi_phu_trach_id !== input.user.id && !isMember) {
        throw new ProjectEditUnavailable("Forbidden.");
      }
      if (isProjectLocked(project.trang_thai)) {
        throw new ProjectEditUnavailable("Project is locked.");
      }
    }

    if (project.version !== input.baseRevision) {
      throw new ProjectRevisionConflict(project.version);
    }
    if (
      input.user.role === "user" &&
      !userCanEditRange(database, input.user.id, input.projectId, input.sheetName, input.affectedRange)
    ) {
      throw new ProjectCellEditForbidden();
    }

    const revision = project.version + 1;
    const id = randomUUID();
    promoteWorkbook();
    promoted = true;

    try {
      database.prepare(`
        INSERT INTO edits
          (id, project_id, user_id, username, sheet_name, cell, old_value, new_value,
           base_revision, revision, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.projectId,
        input.user.id,
        input.user.username,
        input.sheetName,
        input.cell,
        input.oldValue,
        input.newValue,
        input.baseRevision,
        revision,
        input.timestamp,
      );

      const update = database.prepare(
        "UPDATE projects SET version = ?, updated_at = ? WHERE id = ? AND version = ?",
      ).run(revision, input.timestamp, input.projectId, input.baseRevision);
      if (update.changes !== 1) {
        const latest = database.prepare("SELECT version FROM projects WHERE id = ?").get(input.projectId) as
          { version: number } | undefined;
        throw new ProjectRevisionConflict(latest?.version ?? input.baseRevision);
      }

      return { ...input, id, revision };
    } catch (error) {
      restoreWorkbook();
      promoted = false;
      throw error;
    }
  });

  try {
    return commit.immediate();
  } catch (error) {
    if (promoted) restoreWorkbook();
    throw error;
  }
}

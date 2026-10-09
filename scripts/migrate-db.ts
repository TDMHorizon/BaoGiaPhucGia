import Database from "better-sqlite3";
import path from "path";
import { logger } from "../server/logger";

const dbPath = path.join(process.cwd(), "data", "baogia.db");

export function runMigration() {
  logger.info("MIGRATION", "START_DATABASE_MIGRATION", { dbPath });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_role_visibility (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'user')),
        user_id TEXT,
        is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
        can_view INTEGER NOT NULL DEFAULT 1 CHECK (can_view IN (0, 1)),
        can_edit INTEGER NOT NULL DEFAULT 0 CHECK (can_edit IN (0, 1)),
        hidden_by TEXT NOT NULL,
        hidden_at TEXT NOT NULL,
        UNIQUE (project_id, role, user_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (hidden_by) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_project_role_visibility_project_role
        ON project_role_visibility(project_id, role, user_id);

      CREATE TABLE IF NOT EXISTS workbook_snapshots (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        snapshot_json TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_workbook_snapshots_project_ver
        ON workbook_snapshots(project_id, version);

      CREATE TABLE IF NOT EXISTS workbook_commands (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        sheet_name TEXT NOT NULL,
        range_ref TEXT NOT NULL,
        command_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_workbook_commands_project_ver
        ON workbook_commands(project_id, version);
    `);

    logger.info("MIGRATION", "DATABASE_MIGRATION_SUCCESS", { status: "OK" });
    logger.testVerification("PHASE_P0", "Database Schema Migration", true, {
      tablesCreated: ["project_role_visibility", "workbook_snapshots", "workbook_commands"],
    });
    return true;
  } catch (error) {
    logger.error("MIGRATION", "DATABASE_MIGRATION_FAILED", error);
    logger.testVerification("PHASE_P0", "Database Schema Migration", false, { error });
    throw error;
  } finally {
    db.close();
  }
}

if (process.argv[1] && process.argv[1].includes("migrate-db")) {
  runMigration();
}

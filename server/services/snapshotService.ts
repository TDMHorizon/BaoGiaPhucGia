import {
  getDb,
  getCellValue,
  recordProjectEvent,
  versionToJson,
  type ProjectRow,
  type VersionRow,
} from "../db";
import { AppError } from "../utils/AppError";
import { readVersionSnapshotBuffer, sha256 } from "../files";
import { loadWorkbookFromBuffer } from "./excelService";
import { cellValueToString } from "../../src/lib/excelCore";
import type { AuthUser } from "../auth";

export async function getProjectVersionsList(project: ProjectRow) {
  const rows = getDb()
    .prepare("SELECT * FROM versions WHERE project_id = ? ORDER BY version DESC")
    .all(project.id) as VersionRow[];

  return rows.map((v) => versionToJson(v, project.finalized_snapshot_id));
}

export async function getSnapshotBufferForVersion(
  projectId: string,
  version: number
): Promise<{ buffer: Buffer; versionRow: VersionRow }> {
  const versionRow = getDb()
    .prepare("SELECT * FROM versions WHERE project_id = ? AND version = ?")
    .get(projectId, version) as VersionRow | undefined;

  if (!versionRow) {
    throw new AppError(`Không tìm thấy phiên bản v${version} của báo giá trong hệ thống`, 404);
  }

  const buffer = await readVersionSnapshotBuffer(projectId, version);
  if (!buffer) {
    throw new AppError(`Không tìm thấy file snapshot vật lý của phiên bản v${version} trên máy chủ`, 404);
  }

  // Kiểm tra tính toàn vẹn Checksum [P0-08]
  if (versionRow.checksum && sha256(buffer) !== versionRow.checksum) {
    throw new AppError(
      `Tệp snapshot v${version} không đảm bảo tính toàn vẹn dữ liệu (checksum mismatch). Thao tác bị từ chối.`,
      422
    );
  }

  return { buffer, versionRow };
}

/**
 * UC15: Khôi phục phiên bản snapshot cũ thành revision làm việc mới.
 * Bảo toàn 100% lịch sử edits cũ và tính bất biến của mọi snapshot Vn.
 */
export async function restoreSnapshotAsWorkingRevision(
  project: ProjectRow,
  targetVersion: number,
  actor: AuthUser,
  reason?: string
): Promise<{ restoredVersion: number; compensatingEditsCount: number; newProjectRevision: number }> {
  if (actor.role !== "admin") {
    throw new AppError("Chỉ Quản trị viên (Admin) mới có quyền khôi phục phiên bản báo giá cũ (UC15)", 403);
  }

  const { buffer, versionRow } = await getSnapshotBufferForVersion(project.id, targetVersion);
  const snapshotWb = await loadWorkbookFromBuffer(buffer);

  const database = getDb();
  let compensatingEditsCount = 0;
  const now = new Date().toISOString();

  database.transaction(() => {
    let nextSeq = (
      (database
        .prepare("SELECT COALESCE(MAX(sequence), 0) AS m FROM edits WHERE project_id = ?")
        .get(project.id) as { m: number })?.m || 0
    );

    const insertEdit = database.prepare(
      `INSERT INTO edits (id, project_id, user_id, username, sheet_name, cell, old_value, new_value, sequence, needs_review, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    );

    const upsertCellValue = database.prepare(
      `INSERT INTO project_cell_values (project_id, sheet_name, cell, value, revision, updated_by, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(project_id, sheet_name, cell) DO UPDATE SET
         value = excluded.value,
         revision = project_cell_values.revision + 1,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`
    );

    const processedCells = new Set<string>();

    // Duyệt qua tất cả worksheet và ô trong snapshot để so sánh và tạo compensating edits
    for (const ws of snapshotWb.worksheets) {
      const sheetName = ws.name;
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const cellRef = cell.address;
          processedCells.add(`${sheetName}!${cellRef}`);
          const snapVal = cellValueToString(cell.value);

          const currentDbCell = getCellValue(project.id, sheetName, cellRef);
          const currentVal = currentDbCell ? currentDbCell.value : "";

          if (currentVal !== snapVal) {
            nextSeq += 1;
            compensatingEditsCount += 1;
            const editId = `rest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${nextSeq}`;

            insertEdit.run(
              editId,
              project.id,
              actor.id,
              actor.username,
              sheetName,
              cellRef,
              currentVal,
              snapVal,
              nextSeq,
              now
            );

            upsertCellValue.run(
              project.id,
              sheetName,
              cellRef,
              snapVal,
              actor.username,
              now
            );
          }
        });
      });
    }

    // [P0-06] Xử lý các ô có trong overlay hiện tại nhưng không có trong snapshot (ô bị thêm sau snapshot => đưa về "")
    const existingDbCells = database
      .prepare("SELECT sheet_name, cell, value FROM project_cell_values WHERE project_id = ? AND value != ''")
      .all(project.id) as { sheet_name: string; cell: string; value: string }[];

    for (const c of existingDbCells) {
      const key = `${c.sheet_name}!${c.cell}`;
      if (!processedCells.has(key)) {
        nextSeq += 1;
        compensatingEditsCount += 1;
        const editId = `rest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${nextSeq}`;

        insertEdit.run(
          editId,
          project.id,
          actor.id,
          actor.username,
          c.sheet_name,
          c.cell,
          c.value,
          "",
          nextSeq,
          now
        );

        upsertCellValue.run(
          project.id,
          c.sheet_name,
          c.cell,
          "",
          actor.username,
          now
        );
      }
    }

    // Invalidate review cũ sau khi khôi phục snapshot
    database.prepare("UPDATE financial_reviews SET is_stale = 1 WHERE project_id = ?").run(project.id);

    // Tăng revision của project và finance
    database
      .prepare(
        `UPDATE projects 
         SET project_revision = project_revision + 1, finance_revision = finance_revision + 1, updated_at = ? 
         WHERE id = ?`
      )
      .run(now, project.id);

    // Ghi nhận project_events
    recordProjectEvent(project.id, "VERSION_RESTORED", actor.id, actor.username, {
      sourceVersion: targetVersion,
      compensatingEditsCount,
      reason: reason || `Khôi phục về trạng thái phiên bản v${targetVersion}`,
    });
  })();

  const updatedProject = database.prepare("SELECT project_revision FROM projects WHERE id = ?").get(project.id) as {
    project_revision: number;
  };

  return {
    restoredVersion: targetVersion,
    compensatingEditsCount,
    newProjectRevision: updatedProject.project_revision,
  };
}

/**
 * UC18: Xuất Excel A4 chính thức từ snapshot đã duyệt.
 * Đảm bảo: BẮT BUỘC đọc từ snapshot đã chốt, định dạng in ấn A4 chuẩn, KHÔNG có watermark!
 */
export async function getOfficialA4ExportBuffer(
  project: ProjectRow,
  version?: number
): Promise<{ buffer: Buffer; fileName: string; version: number }> {
  let targetVersion = version;

  // Nếu không chỉ định version, lấy từ finalized_snapshot_id
  if (!targetVersion) {
    if (!project.finalized_snapshot_id) {
      // Tìm version mới nhất đã được tạo
      const latestVer = getDb()
        .prepare("SELECT version FROM versions WHERE project_id = ? ORDER BY version DESC LIMIT 1")
        .get(project.id) as { version: number } | undefined;
      if (!latestVer) {
        throw new AppError(
          "Báo giá chưa có phiên bản nào được Admin phê duyệt (UC09). Không thể xuất bản chính thức.",
          400
        );
      }
      targetVersion = latestVer.version;
    } else {
      const vRow = getDb()
        .prepare("SELECT version FROM versions WHERE id = ?")
        .get(project.finalized_snapshot_id) as { version: number } | undefined;
      targetVersion = vRow?.version || 1;
    }
  }

  const { buffer, versionRow } = await getSnapshotBufferForVersion(project.id, targetVersion);
  const wb = await loadWorkbookFromBuffer(buffer);

  // Áp định dạng in ấn A4 chuyên nghiệp cho mọi sheet
  for (const ws of wb.worksheets) {
    ws.pageSetup = {
      ...ws.pageSetup,
      paperSize: 9, // A4
      orientation: ws.pageSetup?.orientation || "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
      showGridLines: true,
    };
  }

  wb.calcProperties.fullCalcOnLoad = true;
  const outBuf = Buffer.from(await wb.xlsx.writeBuffer());
  const safeName = (project.name || "baogia").replace(/\.xlsx$/i, "");
  const fileName = `${safeName}_v${targetVersion}_CHINH_THUC.xlsx`;

  return { buffer: outBuf, fileName, version: targetVersion };
}

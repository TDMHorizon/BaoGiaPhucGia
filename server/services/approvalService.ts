import {
  getDb,
  getLatestFinancialReview,
  insertApprovalDecision,
  recordProjectEvent,
  type ApprovalDecisionRow,
  type ProjectRow,
} from "../db";
import { AppError } from "../utils/AppError";
import { deleteVersionSnapshot, readProjectFileBuffer, saveVersionSnapshot, sha256 } from "../files";
import { buildFinalWorkbookBuffer } from "./excelService";
import { getProjectFinancialReviewStatus } from "./financeReviewService";
import { withProjectLock } from "./common";
import type { AuthUser } from "../auth";

export async function approveQuotation(
  project: ProjectRow,
  actor: AuthUser,
  payload: {
    note?: string;
    expectedProjectRevision?: number;
    expectedFinanceRevision?: number;
  }
): Promise<{ decision: string; version: number; snapshotVersion: number; snapshotId: string; checksum: string }> {
  return withProjectLock(project.id, async () => {
    // 0. Đọc bản ghi mới nhất từ DB trong lock
    const currentProject = (getDb().prepare("SELECT * FROM projects WHERE id = ?").get(project.id) as ProjectRow) || project;
  // Chỉ Quản trị viên (Admin) mới có quyền phê duyệt phát hành (UC09 - Actor: Minh)
  if (actor.role !== "admin") {
    throw new AppError("Chỉ Quản trị viên (Admin) mới có thẩm quyền phê duyệt phát hành báo giá (UC09)", 403);
  }

  if (project.isDelete || project.deleted_at) {
    throw new AppError("Không thể phê duyệt báo giá đã bị xóa vào thùng rác", 400);
  }
  if (project.archived_at) {
    throw new AppError("Không thể phê duyệt báo giá đã lưu trữ", 400);
  }

  // OCC check
  if (
    payload.expectedProjectRevision !== undefined &&
    payload.expectedProjectRevision !== project.project_revision
  ) {
    throw new AppError(
      `Dữ liệu kỹ thuật của báo giá đã thay đổi (r${project.project_revision} vs r${payload.expectedProjectRevision}). Vui lòng tải lại trước khi duyệt.`,
      409
    );
  }

  if (
    payload.expectedFinanceRevision !== undefined &&
    payload.expectedFinanceRevision !== (project.finance_revision ?? 1)
  ) {
    throw new AppError(
      `Dữ liệu tài chính/đơn giá của báo giá đã thay đổi (f${project.finance_revision} vs f${payload.expectedFinanceRevision}). Vui lòng tải lại trước khi duyệt.`,
      409
    );
  }

  // Gate Check UC08: Bắt buộc đã qua thẩm định tài chính PASS và KHÔNG STALE
  const reviewStatus = getProjectFinancialReviewStatus(project);
  if (!reviewStatus.hasReview || !reviewStatus.review) {
    throw new AppError(
      "Báo giá chưa qua bước thẩm định tài chính của Kế toán (UC08). Yêu cầu thẩm định trước khi phê duyệt.",
      422
    );
  }

  if (reviewStatus.isStale) {
    throw new AppError(
      "Kết quả thẩm định tài chính đã quá hạn (dữ liệu số lượng hoặc đơn giá bị thay đổi sau thẩm định). Kế toán cần thẩm định lại trước khi Admin duyệt.",
      409
    );
  }

  if (reviewStatus.review.status !== "PASS") {
    throw new AppError(
      `Báo giá chưa đạt yêu cầu thẩm định tài chính (Trạng thái: ${reviewStatus.review.status}). Lý do: ${reviewStatus.review.note || "Chưa đạt biên lợi nhuận"}.`,
      422
    );
  }

  // 1. Tạo workbook snapshot bất biến từ server pipeline
  const baseBuffer = await readProjectFileBuffer(project.id);
  if (!baseBuffer) {
    throw new AppError("Không tìm thấy file Excel nền của báo giá", 500);
  }

  const edits = getDb()
    .prepare("SELECT sheet_name, cell, new_value, sequence FROM edits WHERE project_id = ? ORDER BY sequence ASC")
    .all(project.id) as any[];

  const financialMeta = {
    otHours: project.ot_hours,
    otRate: project.ot_rate,
    vatRate: project.vat_rate,
    discountAmount: project.discount_amount,
    financialConfig: project.financial_config,
  };

  const { buffer: finalWbBuf } = await buildFinalWorkbookBuffer(baseBuffer, edits, financialMeta);
  const checksum = sha256(finalWbBuf);
  const fileSize = finalWbBuf.length;

  // 2. Tính số phiên bản mới N
  const vRow = getDb()
    .prepare("SELECT COALESCE(MAX(version), 0) AS max_v FROM versions WHERE project_id = ?")
    .get(project.id) as { max_v: number };
  const nextVersion = (vRow?.max_v || 0) + 1;
  const snapshotId = `ver-${project.id}-v${nextVersion}`;
  const now = new Date().toISOString();

  // 3. Ghi file snapshot bất biến vào đĩa data/versions/{projectId}/v{N}.xlsx
  await saveVersionSnapshot(currentProject.id, nextVersion, finalWbBuf);

  try {
    // 4. Transaction ghi nhận phiên bản, quyết định phê duyệt và khóa dự án
    const database = getDb();
    database.transaction(() => {
      // Lưu vào versions
      database
        .prepare(
          `INSERT INTO versions (
            id, project_id, version, note, created_by, created_at,
            source_revision, checksum, file_size, sent_by, sent_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          snapshotId,
          currentProject.id,
          nextVersion,
          payload.note || `Phê duyệt phát hành phiên bản v${nextVersion}`,
          actor.username,
          now,
          currentProject.project_revision,
          checksum,
          fileSize,
          null,
          null
        );

      // Lưu vào approval_decisions
      const decisionId = `appr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const decisionRow: ApprovalDecisionRow = {
        id: decisionId,
        project_id: currentProject.id,
        review_id: reviewStatus.review!.id,
        actor_id: actor.id,
        actor_username: actor.username,
        decision: "APPROVED",
        note: payload.note || "",
        project_revision: currentProject.project_revision,
        finance_revision: currentProject.finance_revision ?? 1,
        snapshot_id: snapshotId,
        created_at: now,
      };
      insertApprovalDecision(decisionRow);

      // Cập nhật projects: gắn finalized_snapshot_id và chuyển sang da_gui
      database
        .prepare(
          `UPDATE projects 
           SET finalized_snapshot_id = ?, trang_thai = 'da_gui', updated_at = ?, project_revision = project_revision + 1 
           WHERE id = ?`
        )
        .run(snapshotId, now, currentProject.id);

      // Ghi nhận project_events
      recordProjectEvent(currentProject.id, "ADMIN_APPROVED", actor.id, actor.username, {
        version: nextVersion,
        snapshotId,
        checksum,
        note: payload.note || "",
      });
    })();
  } catch (dbErr: any) {
    // Nếu ghi DB thất bại, dọn dẹp file snapshot vật lý để tránh file mồ côi (P1-14)
    await deleteVersionSnapshot(currentProject.id, nextVersion);
    throw dbErr;
  }

  return {
    decision: "APPROVED",
    version: nextVersion,
    snapshotVersion: nextVersion,
    snapshotId,
    checksum,
  };
  });
}

export async function rejectQuotation(
  project: ProjectRow,
  actor: AuthUser,
  payload: { reason: string }
): Promise<void> {
  if (actor.role !== "admin") {
    throw new AppError("Chỉ Quản trị viên (Admin) mới có thẩm quyền từ chối phê duyệt báo giá (UC09)", 403);
  }

  const now = new Date().toISOString();
  const decisionId = `appr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const review = getLatestFinancialReview(project.id);

  const database = getDb();
  database.transaction(() => {
    const decisionRow: ApprovalDecisionRow = {
      id: decisionId,
      project_id: project.id,
      review_id: review?.id || null,
      actor_id: actor.id,
      actor_username: actor.username,
      decision: "REJECTED",
      note: payload.reason || "Admin từ chối phê duyệt",
      project_revision: project.project_revision,
      finance_revision: project.finance_revision ?? 1,
      snapshot_id: null,
      created_at: now,
    };
    insertApprovalDecision(decisionRow);

    // Trả trạng thái về dang_lam để nhân viên và kế toán điều chỉnh
    database
      .prepare("UPDATE projects SET trang_thai = 'dang_lam', updated_at = ?, project_revision = project_revision + 1 WHERE id = ?")
      .run(now, project.id);

    recordProjectEvent(project.id, "ADMIN_REJECTED", actor.id, actor.username, {
      reason: payload.reason || "Từ chối phê duyệt",
    });
  })();
}

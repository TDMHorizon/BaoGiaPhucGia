import {
  getDb,
  getLatestFinancialReview,
  insertFinancialReview,
  recordProjectEvent,
  type FinancialReviewRow,
  type ProjectRow,
} from "../db";
import { AppError } from "../utils/AppError";
import type { AuthUser } from "../auth";

export interface FinancialCalculationResult {
  itemsSubtotal: number;
  otAmount: number;
  allowancesTotal: number;
  discountAmount: number;
  vatAmount: number;
  revenueAmount: number;
  estimatedCostAmount: number;
  marginAmount: number;
  marginRate: number;
  findings: string[];
}

export function calculateProjectFinancials(
  project: ProjectRow,
  customCost?: number
): FinancialCalculationResult {
  let finCfg: any = {};
  try {
    finCfg = project.financial_config ? JSON.parse(project.financial_config) : {};
  } catch {
    finCfg = {};
  }

  const items = Array.isArray(finCfg.items) ? finCfg.items : [];
  let itemsSubtotal = 0;
  let computedCost = 0;
  const findings: string[] = [];

  for (const it of items) {
    const qty = Number(it.quantity ?? 0);
    const price = Number(it.unitPrice ?? 0);
    const cost = Number(it.unitCost ?? it.estimatedCost ?? 0);
    if (qty > 0 && price <= 0) {
      findings.push(`Hạng mục "${it.name || it.stt || 'kỹ thuật'}" có khối lượng (${qty}) nhưng chưa nhập đơn giá`);
    }
    itemsSubtotal += qty * price;
    computedCost += qty * cost;
  }

  const otHours = Number(project.ot_hours ?? 0);
  const otRate = Number(project.ot_rate ?? 505000);
  const otAmount = otHours * otRate;

  let allowancesTotal = 0;
  if (Array.isArray(finCfg.allowances)) {
    for (const a of finCfg.allowances) {
      allowancesTotal += Number(a.amount ?? 0);
    }
  }

  const discountAmount = Number(project.discount_amount ?? 0);
  if (discountAmount > itemsSubtotal + otAmount + allowancesTotal) {
    findings.push("Chiết khấu vượt quá tổng giá trị trước chiết khấu");
  }

  const netRevenue = Math.max(0, itemsSubtotal + otAmount + allowancesTotal - discountAmount);
  const vatRate = Number(project.vat_rate ?? 8);
  const vatAmount = (netRevenue * vatRate) / 100;
  const revenueAmount = netRevenue;

  // Nguồn giá vốn: từ chi phí hạng mục hoặc customCost nếu kế toán cung cấp, fallback 65% doanh thu
  const estimatedCostAmount =
    customCost !== undefined && customCost !== null && Number.isFinite(Number(customCost))
      ? Number(customCost)
      : computedCost > 0
      ? computedCost
      : Math.round(revenueAmount * 0.65);

  const marginAmount = revenueAmount - estimatedCostAmount;
  const marginRate = revenueAmount > 0 ? (marginAmount / revenueAmount) * 100 : 0;

  if (marginRate < 15) {
    findings.push(`Tỷ suất lợi nhuận gộp (${marginRate.toFixed(1)}%) thấp hơn ngưỡng khuyến nghị (15%)`);
  }

  return {
    itemsSubtotal,
    otAmount,
    allowancesTotal,
    discountAmount,
    vatAmount,
    revenueAmount,
    estimatedCostAmount,
    marginAmount,
    marginRate: Math.round(marginRate * 100) / 100,
    findings,
  };
}

export function getProjectFinancialReviewStatus(project: ProjectRow) {
  const latestReview = getLatestFinancialReview(project.id);
  const calc = calculateProjectFinancials(project);

  if (!latestReview) {
    return {
      hasReview: false,
      isStale: true,
      canApprove: false,
      calc,
      review: null,
    };
  }

  const isStale =
    latestReview.source_project_revision !== project.project_revision ||
    latestReview.source_finance_revision !== (project.finance_revision ?? 1);

  const canApprove = !isStale && latestReview.status === "PASS";

  return {
    hasReview: true,
    isStale,
    canApprove,
    calc,
    review: {
      ...latestReview,
      findings: latestReview.findings_json ? JSON.parse(latestReview.findings_json) : [],
    },
  };
}

export async function submitFinancialReview(
  project: ProjectRow,
  actor: AuthUser,
  payload: {
    status: "PASS" | "REQUEST_CHANGES";
    note?: string;
    customCost?: number;
    expectedProjectRevision?: number;
    expectedFinanceRevision?: number;
  }
): Promise<FinancialReviewRow> {
  // Chỉ Kế toán (Manager) hoặc Admin mới được thẩm định
  if (actor.role !== "manager" && actor.role !== "admin") {
    throw new AppError("Chỉ Kế toán / Quản lý mới có quyền thẩm định tài chính (UC08)", 403);
  }

  // OCC: Kiểm tra revision chống stale commit
  if (
    payload.expectedProjectRevision !== undefined &&
    payload.expectedProjectRevision !== project.project_revision
  ) {
    throw new AppError(
      `Dữ liệu khối lượng hoặc kỹ thuật đã bị thay đổi bởi người khác (hiện tại: r${project.project_revision}, gửi lên: r${payload.expectedProjectRevision}). Vui lòng tải lại và thẩm định lại.`,
      409
    );
  }

  if (
    payload.expectedFinanceRevision !== undefined &&
    payload.expectedFinanceRevision !== (project.finance_revision ?? 1)
  ) {
    throw new AppError(
      `Dữ liệu tài chính/đơn giá đã bị thay đổi bởi người khác (hiện tại: f${project.finance_revision}, gửi lên: f${payload.expectedFinanceRevision}). Vui lòng tải lại và thẩm định lại.`,
      409
    );
  }

  const calc = calculateProjectFinancials(project, payload.customCost);
  const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const newReview: FinancialReviewRow = {
    id: reviewId,
    project_id: project.id,
    reviewed_by: actor.id,
    reviewer_username: actor.username,
    status: payload.status,
    reviewed_at: now,
    source_project_revision: project.project_revision,
    source_finance_revision: project.finance_revision ?? 1,
    revenue_amount: calc.revenueAmount,
    estimated_cost_amount: calc.estimatedCostAmount,
    margin_amount: calc.marginAmount,
    margin_rate: calc.marginRate,
    findings_json: JSON.stringify(calc.findings),
    note: payload.note || "",
    is_stale: 0,
  };

  insertFinancialReview(newReview);

  recordProjectEvent(project.id, "FINANCIAL_REVIEWED", actor.id, actor.username, {
    reviewId,
    status: payload.status,
    marginRate: calc.marginRate,
    note: payload.note || "",
  });

  return newReview;
}

import React, { useEffect, useState, useCallback } from "react";
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiDollarSign,
  FiPercent,
  FiFileText,
  FiCheck,
  FiX,
  FiLock,
  FiUnlock,
  FiLayers,
} from "react-icons/fi";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { formatVND } from "../../lib/quote-calculator";

interface FinancialReviewPanelProps {
  projectId: string;
  userRole?: string;
  project?: any;
  onRefreshData?: () => void;
}

export const FinancialReviewPanel: React.FC<FinancialReviewPanelProps> = ({
  projectId,
  userRole,
  project,
  onRefreshData,
}) => {
  const isAdmin = userRole === "admin";
  const isManager = userRole === "manager";
  const canReview = isAdmin || isManager;

  const [loading, setLoading] = useState(true);
  const [reviewData, setReviewData] = useState<any>(null);
  const [approvalData, setApprovalData] = useState<any>(null);
  const [note, setNote] = useState("");
  const [customCost, setCustomCost] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [rev, appr] = await Promise.all([
        api.getFinancialReview(projectId).catch(() => null),
        api.getApprovalStatus(projectId).catch(() => null),
      ]);
      setReviewData(rev);
      setApprovalData(appr);
      if (rev?.calc?.estimatedCostAmount) {
        setCustomCost(String(rev.calc.estimatedCostAmount));
      }
    } catch (e: any) {
      console.error("Lỗi tải thông tin thẩm định:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // UC08: Kế toán thẩm định tài chính
  const handleSubmitReview = async (status: "PASS" | "REQUEST_CHANGES") => {
    try {
      setIsSubmitting(true);
      const payload: any = {
        status,
        note,
        expectedProjectRevision: project?.projectRevision,
        expectedFinanceRevision: project?.financeRevision,
      };
      if (customCost && Number.isFinite(Number(customCost))) {
        payload.customCost = Number(customCost);
      }

      await api.submitFinancialReview(projectId, payload);
      toast.success(
        status === "PASS"
          ? "Đã thẩm định ĐẠT tài chính (UC08)! Báo giá sẵn sàng để Admin phê duyệt."
          : "Đã gửi yêu cầu điều chỉnh (REQUEST CHANGES) cho nhân viên kỹ thuật!"
      );
      setNote("");
      await loadData();
      onRefreshData?.();
    } catch (e: any) {
      if (e?.status === 409) {
        toast.error("Xung đột: " + (e?.message || "Dữ liệu đã bị sửa đổi bởi người khác"));
      } else {
        toast.error("Lỗi gửi thẩm định: " + (e?.message || "Thao tác thất bại"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // UC09: Admin phê duyệt phát hành (Actor: Minh)
  const handleApprove = async () => {
    if (!isAdmin) {
      toast.error("Chỉ Quản trị viên (Admin) mới có quyền phê duyệt phát hành (UC09)!");
      return;
    }
    try {
      setIsSubmitting(true);
      const result = await api.approveProject(projectId, {
        note: note || "Phê duyệt phát hành chính thức",
        expectedProjectRevision: project?.projectRevision,
        expectedFinanceRevision: project?.financeRevision,
      });
      toast.success(
        `Admin đã phê duyệt phát hành thành công! Snapshot v${result.version} đã được tạo và lưu trữ an toàn (UC09).`
      );
      setNote("");
      await loadData();
      onRefreshData?.();
    } catch (e: any) {
      toast.error("Lỗi phê duyệt: " + (e?.message || "Không thể phê duyệt"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // UC09: Admin từ chối duyệt
  const handleReject = async () => {
    if (!isAdmin) {
      toast.error("Chỉ Quản trị viên (Admin) mới có quyền từ chối phê duyệt (UC09)!");
      return;
    }
    if (!note.trim()) {
      toast.warning("Vui lòng nhập lý do từ chối vào ô ghi chú!");
      return;
    }
    try {
      setIsSubmitting(true);
      await api.rejectProject(projectId, note.trim());
      toast.info("Đã từ chối phê duyệt và trả báo giá về trạng thái Đang điền.");
      setNote("");
      await loadData();
      onRefreshData?.();
    } catch (e: any) {
      toast.error("Lỗi từ chối: " + (e?.message || "Thao tác thất bại"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // UC10: Admin Khóa / Mở khóa
  const handleToggleLock = async () => {
    if (!isAdmin) return;
    try {
      setIsSubmitting(true);
      if (project?.lockedManually) {
        await api.unlockProject(projectId, note || "Admin mở khóa");
        toast.success("Đã mở khóa báo giá (UC10)!");
      } else {
        await api.lockProject(projectId, note || "Admin khóa thủ công");
        toast.success("Đã khóa báo giá (UC10)!");
      }
      onRefreshData?.();
    } catch (e: any) {
      toast.error(e?.message || "Thao tác thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-xs text-slate-500">
        Đang tải dữ liệu thẩm định & phê duyệt...
      </div>
    );
  }

  const calc = reviewData?.calc || {};
  const currentReview = reviewData?.review;
  const isStale = reviewData?.isStale;
  const canApprove = approvalData?.canApprove;
  const marginRate = Number(calc.marginRate ?? 0);
  const isGoodMargin = marginRate >= 15;

  return (
    <div className="space-y-4 p-3 text-xs font-sans">
      {/* 1. Trạng thái Thẩm định UC08 Badge */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <FiFileText className="text-[#105CB3]" />
            Thẩm định Tài chính (UC08)
          </span>
          {currentReview ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                isStale
                  ? "bg-amber-100 text-amber-800"
                  : currentReview.status === "PASS"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {isStale
                ? "Dữ liệu đã sửa (Quá hạn)"
                : currentReview.status === "PASS"
                ? "ĐÃ THẨM ĐỊNH ĐẠT"
                : "YÊU CẦU ĐIỀU CHỈNH"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700 font-semibold">
              Chưa thẩm định
            </span>
          )}
        </div>

        {/* Thông tin reviewer */}
        {currentReview && (
          <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-1.5 space-y-0.5">
            <p>
              Người thẩm định: <span className="font-semibold text-slate-700">{currentReview.reviewer_username}</span>
            </p>
            <p>Thời gian: {new Date(currentReview.reviewed_at).toLocaleString("vi-VN")}</p>
            {currentReview.note && (
              <p className="italic text-slate-600 bg-white p-1.5 rounded border border-slate-200 mt-1">
                "{currentReview.note}"
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. Bảng Tính Doanh thu - Giá vốn - Biên lợi nhuận */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
          <span className="font-bold text-slate-800">Biên lợi nhuận gộp</span>
          <span
            className={`font-mono text-sm font-extrabold ${
              isGoodMargin ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {marginRate.toFixed(2)}%
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-500">Doanh thu dự kiến:</span>
            <p className="font-bold text-slate-800 font-mono">{formatVND(calc.revenueAmount || 0)}</p>
          </div>
          <div>
            <span className="text-slate-500">Giá vốn dự toán:</span>
            <p className="font-bold text-slate-800 font-mono">{formatVND(calc.estimatedCostAmount || 0)}</p>
          </div>
          <div>
            <span className="text-slate-500">Lợi nhuận gộp:</span>
            <p className="font-bold text-slate-800 font-mono">{formatVND(calc.marginAmount || 0)}</p>
          </div>
          <div>
            <span className="text-slate-500">Chiết khấu:</span>
            <p className="font-bold text-slate-800 font-mono">{formatVND(calc.discountAmount || 0)}</p>
          </div>
        </div>

        {/* Cảnh báo findings nếu có */}
        {calc.findings && calc.findings.length > 0 && (
          <div className="rounded-lg bg-amber-50 p-2 border border-amber-200 mt-2 space-y-1">
            <span className="font-bold text-amber-800 flex items-center gap-1 text-[10px]">
              <FiAlertTriangle className="text-amber-600" /> Cảnh báo rủi ro:
            </span>
            <ul className="list-disc pl-4 text-[10px] text-amber-900 space-y-0.5">
              {calc.findings.map((f: string, i: number) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 3. Vùng Thao Tác Kế Toán (UC08) */}
      {canReview && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2">
          <span className="font-bold text-[#105CB3] block">Thao tác thẩm định (Kế toán)</span>

          <div>
            <label className="text-[10px] font-semibold text-slate-600 block mb-1">
              Giá vốn dự toán điều chỉnh (VNĐ, tùy chọn):
            </label>
            <input
              type="number"
              value={customCost}
              onChange={(e) => setCustomCost(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono"
              placeholder="VD: 15000000"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-600 block mb-1">
              Ghi chú thẩm định / Nhận xét:
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs"
              placeholder="Ghi nhận xét hoặc lý do yêu cầu sửa đổi..."
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmitReview("PASS")}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 text-xs flex items-center justify-center gap-1"
            >
              <FiCheck className="h-3.5 w-3.5" /> Thẩm định ĐẠT
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmitReview("REQUEST_CHANGES")}
              className="flex-1 rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50 text-xs flex items-center justify-center gap-1"
            >
              <FiX className="h-3.5 w-3.5" /> Yêu cầu sửa
            </button>
          </div>
        </div>
      )}

      {/* 4. Vùng Phê Duyệt Admin (UC09 - Actor: Minh) */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-indigo-900 flex items-center gap-1.5">
            <FiCheckCircle className="text-indigo-600" />
            Phê duyệt phát hành (Admin UC09)
          </span>
          {project?.finalizedSnapshotId ? (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
              ĐÃ CHỐT V{project.finalizedVersion || 1}
            </span>
          ) : (
            <span className="text-[10px] text-slate-500">Chưa chốt phiên bản</span>
          )}
        </div>

        {/* Điều kiện duyệt */}
        {!canApprove && (
          <div className="rounded-lg bg-slate-100 p-2 text-[10px] text-slate-600 space-y-0.5">
            <p className="font-semibold text-slate-700">Điều kiện phê duyệt:</p>
            <p className={currentReview?.status === "PASS" && !isStale ? "text-emerald-600" : "text-red-500"}>
              • Thẩm định tài chính Kế toán: {currentReview?.status === "PASS" ? "ĐẠT" : "Chưa đạt"}
            </p>
            <p className={!isStale ? "text-emerald-600" : "text-amber-600"}>
              • Tính toàn vẹn dữ liệu: {isStale ? "Dữ liệu bị sửa sau thẩm định" : "Khớp revision"}
            </p>
          </div>
        )}

        {isAdmin ? (
          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting || !canApprove}
              onClick={handleApprove}
              className="w-full rounded-lg bg-[#105CB3] px-3 py-2 font-bold text-white shadow-xs hover:bg-[#268DF0] disabled:bg-slate-300 disabled:cursor-not-allowed text-xs flex items-center justify-center gap-1.5"
            >
              <FiCheckCircle className="h-4 w-4" />
              <span>Phê duyệt & Tạo Snapshot Bất Biến (Admin)</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleReject}
              className="w-full rounded-lg border border-red-300 bg-white px-3 py-1.5 font-bold text-red-600 shadow-xs hover:bg-red-50 text-xs flex items-center justify-center gap-1.5"
            >
              <FiX className="h-3.5 w-3.5" />
              <span>Từ chối duyệt (Trả về Đang điền)</span>
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-slate-500 italic">
            Chỉ Quản trị viên (Admin) mới có thẩm quyền ra quyết định phê duyệt và khóa snapshot phát hành.
          </p>
        )}
      </div>

      {/* 5. Khóa Thủ Công UC10 (Admin only) */}
      {isAdmin && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              {project?.lockedManually ? <FiLock className="text-red-500" /> : <FiUnlock className="text-emerald-500" />}
              Khóa báo giá thủ công (UC10)
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                project?.lockedManually ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {project?.lockedManually ? "Đang khóa" : "Đang mở"}
            </span>
          </div>
          {project?.lockedManually && project?.lockReason && (
            <p className="text-[10px] text-slate-500 italic">Lý do khóa: "{project.lockReason}"</p>
          )}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleToggleLock}
            className={`w-full rounded-lg px-3 py-1.5 font-bold text-xs flex items-center justify-center gap-1.5 ${
              project?.lockedManually
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {project?.lockedManually ? (
              <>
                <FiUnlock className="h-3.5 w-3.5" /> Mở khóa báo giá
              </>
            ) : (
              <>
                <FiLock className="h-3.5 w-3.5" /> Khóa báo giá ngay
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

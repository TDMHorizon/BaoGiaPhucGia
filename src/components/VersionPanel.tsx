import React, { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "./ui/button";
import { downloadBase64File } from "../lib/excel";
import { toast } from "sonner";
import { FiDownload, FiRotateCcw, FiShield, FiCheckCircle } from "react-icons/fi";

interface VersionPanelProps {
  projectId: string;
  onRestored?: () => void;
}

export const VersionPanel: React.FC<VersionPanelProps> = ({ projectId, onRestored }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getVersions(projectId);
      setVersions(data || []);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async (version: number) => {
    try {
      const data = await api.getVersionFile(projectId, version);
      downloadBase64File(data.fileBase64, `baogia_v${version}.xlsx`);
      toast.success(`Đã tải tệp snapshot phiên bản v${version}`);
    } catch (e: any) {
      toast.error(e.message || "Không tải được phiên bản");
    }
  };

  // UC15: Admin khôi phục phiên bản
  const handleConfirmRestore = async () => {
    if (!restoringVersion || !isAdmin) return;
    try {
      setIsRestoring(true);
      await api.restoreVersion(projectId, restoringVersion, restoreReason || undefined);
      toast.success(`Đã khôi phục thành công trạng thái phiên bản v${restoringVersion} (UC15)!`);
      setRestoringVersion(null);
      setRestoreReason("");
      await load();
      onRestored?.();
    } catch (e: any) {
      toast.error("Lỗi khôi phục: " + (e?.message || "Thao tác thất bại"));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Lịch sử Phiên bản (UC14)</h4>
          <p className="text-[11px] text-slate-500">Mốc snapshot bất biến được tạo khi Admin phê duyệt</p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={load} disabled={loading}>
          Làm mới
        </Button>
      </div>

      {versions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
          Chưa có snapshot phát hành. Snapshot được tạo tự động khi Admin phê duyệt báo giá (UC09).
        </div>
      ) : (
        <ul className="space-y-2.5">
          {versions.map((v) => (
            <li
              key={v.id}
              className={`flex flex-col gap-2 rounded-xl border p-3 bg-white shadow-xs transition-all ${
                v.isFinalized ? "border-indigo-400 bg-indigo-50/20 ring-1 ring-indigo-200" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-slate-800">Phiên bản v{v.version}</span>
                    {v.isFinalized && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-800">
                        <FiCheckCircle className="h-2.5 w-2.5" /> ĐÃ CHỐT PHÁT HÀNH
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Chốt bởi: <strong className="text-slate-700">{v.createdBy}</strong> ·{" "}
                    {new Date(v.createdAt).toLocaleString("vi-VN")}
                  </p>
                  {v.note && (
                    <p className="text-[10px] text-slate-600 mt-1 italic bg-slate-50 p-1 rounded border border-slate-100">
                      "{v.note}"
                    </p>
                  )}
                  {v.checksum && (
                    <p className="text-[9px] font-mono text-slate-400 mt-1 flex items-center gap-1">
                      <FiShield className="h-2.5 w-2.5 text-slate-400" />
                      SHA256: {v.checksum.slice(0, 12)}...
                      {v.fileSize ? ` · ${(v.fileSize / 1024).toFixed(1)} KB` : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs text-[#105CB3] border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                    onClick={() => handleDownload(v.version)}
                  >
                    <FiDownload className="h-3 w-3" /> Tải Excel
                  </Button>

                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 flex items-center gap-1"
                      onClick={() => setRestoringVersion(v.version)}
                      title="Khôi phục trạng thái làm việc về phiên bản này (UC15)"
                    >
                      <FiRotateCcw className="h-3 w-3" /> Khôi phục
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal xác nhận khôi phục phiên bản (UC15) */}
      {restoringVersion !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <FiRotateCcw className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-800">
                Xác nhận khôi phục phiên bản v{restoringVersion} (UC15)
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hệ thống sẽ tái hiện lại trạng thái làm việc của phiên bản v{restoringVersion} bằng cách tạo các bản ghi
              hiệu chỉnh bù (compensating edits). <strong>Toàn bộ lịch sử chỉnh sửa trước đây và các snapshot đã chốt sẽ được giữ nguyên 100%!</strong>
            </p>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Lý do khôi phục (ghi nhận kiểm toán):
              </label>
              <textarea
                rows={2}
                value={restoreReason}
                onChange={(e) => setRestoreReason(e.target.value)}
                placeholder="VD: Khách hàng yêu cầu quay lại phương án thiết kế v1..."
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestoringVersion(null)}
                disabled={isRestoring}
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
              >
                {isRestoring ? "Đang khôi phục..." : "Xác nhận khôi phục"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

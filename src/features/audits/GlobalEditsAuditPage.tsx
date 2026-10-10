import React, { useEffect, useState, useCallback } from "react";
import { AppShell } from "../../layout/AppShell";
import { api } from "../../lib/api";
import { toast } from "sonner";
import {
  FiSearch,
  FiRotateCcw,
  FiFilter,
  FiDownload,
  FiArrowLeft,
  FiArrowRight,
  FiClock,
  FiFolder,
  FiUser,
  FiAlertTriangle,
} from "react-icons/fi";

export const GlobalEditsAuditPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);

  // Filter states
  const [projectId, setProjectId] = useState("");
  const [userId, setUserId] = useState("");
  const [sheet, setSheet] = useState("");
  const [cell, setCell] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Metadata dropdowns
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Load initial dropdowns
  useEffect(() => {
    Promise.all([
      api.getProjects().catch(() => []),
      api.getUsers().catch(() => []),
    ]).then(([pList, uList]) => {
      setProjectsList(Array.isArray(pList) ? pList : []);
      setUsersList(Array.isArray(uList) ? uList : []);
    });
  }, []);

  const fetchEdits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getGlobalEdits({
        projectId: projectId || undefined,
        userId: userId || undefined,
        sheet: sheet || undefined,
        cell: cell || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
        limit,
      });
      setEdits(res?.items || []);
      setTotal(res?.total || 0);
      setTotalPages(res?.totalPages || 1);
    } catch (e: any) {
      toast.error(e?.message || "Lỗi tải dữ liệu kiểm toán");
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, sheet, cell, fromDate, toDate, page, limit]);

  useEffect(() => {
    fetchEdits();
  }, [fetchEdits]);

  const handleResetFilters = () => {
    setProjectId("");
    setUserId("");
    setSheet("");
    setCell("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const handleExportCSV = () => {
    if (edits.length === 0) {
      toast.info("Không có dữ liệu để xuất CSV");
      return;
    }
    const headers = ["ID", "Thời gian", "Dự án", "Tài khoản", "Sheet", "Ô", "Giá trị cũ", "Giá trị mới", "STT (Sequence)"];
    const rows = edits.map((e) => [
      e.id,
      e.timestamp,
      `"${(e.project_name || e.project_id || "").replace(/"/g, '""')}"`,
      e.username || e.user_id,
      `"${(e.sheet_name || "").replace(/"/g, '""')}"`,
      e.cell,
      `"${String(e.old_value ?? "").replace(/"/g, '""')}"`,
      `"${String(e.new_value ?? "").replace(/"/g, '""')}"`,
      e.sequence,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kiem_toan_chinh_sua_o_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Đã xuất tệp CSV kiểm toán");
  };

  return (
    <AppShell>
      <div className="flex flex-col flex-1 min-h-0 bg-slate-50 p-6 overflow-y-auto font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FiClock className="text-[#105CB3]" />
              Kiểm toán Toàn bộ Chỉnh sửa Ô (UC21)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Tra cứu lịch sử sửa đổi từng ô trên toàn bộ các báo giá trong hệ thống theo thời gian thực
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              <FiDownload className="h-4 w-4 text-slate-500" />
              <span>Xuất CSV</span>
            </button>
            <button
              type="button"
              onClick={fetchEdits}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#105CB3] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#268DF0]"
            >
              <FiRotateCcw className="h-4 w-4" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs mb-6 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <FiFilter className="text-[#105CB3]" /> Bộ lọc tìm kiếm
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            {/* Filter Dự án */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Dự án:</label>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
              >
                <option value="">-- Tất cả dự án --</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.soBaoGia || p.id.slice(0, 6)})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Người dùng */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Người sửa:</label>
              <select
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
              >
                <option value="">-- Tất cả người dùng --</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName || u.username} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Sheet */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tên Sheet:</label>
              <input
                type="text"
                placeholder="VD: BaoGia"
                value={sheet}
                onChange={(e) => {
                  setSheet(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>

            {/* Filter Ô */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Địa chỉ ô:</label>
              <input
                type="text"
                placeholder="VD: D10, C15"
                value={cell}
                onChange={(e) => {
                  setCell(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs uppercase"
              />
            </div>

            {/* Filter Từ ngày */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Từ ngày:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>

            {/* Filter Đến ngày */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Đến ngày:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col flex-1">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 font-bold text-slate-600">
                  <th className="px-4 py-3">STT / Seq</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Dự án</th>
                  <th className="px-4 py-3">Tài khoản</th>
                  <th className="px-4 py-3">Vị trí (Sheet!Ô)</th>
                  <th className="px-4 py-3">Giá trị cũ</th>
                  <th className="px-4 py-3">Giá trị mới</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      Đang truy vấn lịch sử chỉnh sửa...
                    </td>
                  </tr>
                ) : edits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      Không tìm thấy bản ghi chỉnh sửa nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  edits.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-slate-500">
                        #{item.sequence}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-[11px]">
                        {new Date(item.timestamp).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800 max-w-[200px] truncate" title={item.project_name}>
                        {item.project_name || item.project_id}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium">
                        {item.current_username || item.username}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-[#105CB3]">
                        {item.sheet_name}!{item.cell}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px] max-w-[120px] truncate" title={item.old_value}>
                        {item.old_value !== null && item.old_value !== "" ? item.old_value : <span className="italic">(trống)</span>}
                      </td>
                      <td className="px-4 py-2.5 text-emerald-700 font-mono font-bold text-[11px] max-w-[120px] truncate" title={item.new_value}>
                        {item.new_value !== null && item.new_value !== "" ? item.new_value : <span className="italic text-slate-300">(xóa)</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {item.needs_review ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            <FiAlertTriangle className="h-2.5 w-2.5" /> Cần rà soát
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            Hợp lệ
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 bg-slate-50/50 text-xs text-slate-600">
            <div>
              Hiển thị <span className="font-bold">{edits.length}</span> /{" "}
              <span className="font-bold">{total}</span> bản ghi (Trang {page}/{totalPages})
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <FiArrowLeft className="h-3 w-3" /> Trước
              </button>

              <span className="text-xs font-semibold px-2">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Sau <FiArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

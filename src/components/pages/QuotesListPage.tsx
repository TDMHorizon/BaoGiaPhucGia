import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { AppShell } from "../../layout/AppShell";
import {
  FiFolder,
  FiSearch,
  FiPlus,
  FiClock,
  FiUser,
  FiUsers,
  FiTrash2,
  FiEdit,
  FiExternalLink,
  FiUploadCloud,
  FiFileText,
  FiLayers,
  FiX,
  FiCheckCircle,
  FiArchive,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { RiBuilding4Line, RiFileExcel2Line } from "react-icons/ri";

const PAGE_SIZE = 25;

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export const QuotesListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal create quote
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreatingBlank, setIsCreatingBlank] = useState(false);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const canCreate = isAdmin || isManager;

  const loadData = async () => {
    try {
      setLoading(true);
      const [pList, uList] = await Promise.all([
        user?.role === "user" ? api.getProjectByUserId() : api.getProjects(),
        api.getActiveUsers().catch(() => []),
      ]);
      setProjects(pList || []);
      setUsersList(uList || []);
    } catch (e) {
      console.error("Failed to load quotes:", e);
      toast.error("Không thể tải danh sách báo giá");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.role]);

  // Dropzone for upload file
  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        try {
          const res = await api.createProject(
            file.name.replace(/\.[^/.]+$/, ""),
            base64,
            ["BaoGia"]
          );
          toast.success("Đã tải lên và tạo báo giá thành công!");
          setIsCreateModalOpen(false);
          loadData();
          navigate(`/quotes/${res.id}/editor`);
        } catch (err: any) {
          toast.error(err?.message || "Lỗi tạo dự án từ file Excel");
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err?.message || "Lỗi đọc file");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
  } as any);

  const handleCreateBlank = async () => {
    if (!newProjectName.trim()) {
      toast.warning("Vui lòng nhập tên báo giá mới!");
      return;
    }
    try {
      setIsCreatingBlank(true);
      const res = await api.createBlankProject(newProjectName.trim());
      toast.success("Đã tạo báo giá trắng mới thành công!");
      setIsCreateModalOpen(false);
      setNewProjectName("");
      loadData();
      navigate(`/quotes/${res.id}/editor`);
    } catch (e: any) {
      toast.error(e?.message || "Không thể tạo báo giá trắng");
    } finally {
      setIsCreatingBlank(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const isHardDelete = user?.role === "admin" || user?.role === "manager";
    const confirmMsg = isHardDelete
      ? `CẢNH BÁO: Báo giá "${name}" và toàn bộ tệp, dữ liệu liên quan sẽ bị XÓA VĨNH VIỄN ngay lập tức và không thể khôi phục. Bạn có chắc chắn muốn tiếp tục?`
      : `Bạn có chắc muốn xóa bản nháp "${name}" vào Thùng rác không? (Dữ liệu sẽ được lưu trữ 30 ngày)`;

    if (!window.confirm(confirmMsg)) return;
    try {
      const res: any = await api.deleteProject(id);
      if (res?.mode === "hard" || isHardDelete) {
        toast.success(`Đã xóa vĩnh viễn báo giá "${name}" thành công!`);
      } else {
        toast.success(`Đã xóa bản nháp "${name}" vào Thùng rác (lưu trữ 30 ngày)`);
      }
      loadData();
    } catch (e: any) {
      toast.error(e?.message || "Không thể xóa dự án");
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn chuyển báo giá "${name}" vào danh sách lưu trữ lâu dài không?`)) return;
    try {
      await api.archiveProject(id);
      toast.success(`Đã lưu trữ báo giá "${name}" (UC11)`);
      loadData();
    } catch (e: any) {
      toast.error(e?.message || "Không thể lưu trữ báo giá");
    }
  };

  const getUserName = (id?: string) => {
    if (!id) return "Chưa gán";
    const found = usersList.find((u) => u.id === id);
    return found?.fullName || found?.username || id;
  };

  const filteredProjects = projects.filter((p) => {
    const matchSearch =
      !searchQuery ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.soBaoGia?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tenKhachHang || p.khachHang)?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = !statusFilter || p.trangThai === statusFilter;
    return matchSearch && matchStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredProjects.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const displayedProjects = filteredProjects.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <AppShell
      title={user?.role === "user" ? "Báo Giá Của Tôi" : "Quản Lý Danh Mục Báo Giá"}
      subtitle="Danh sách các hồ sơ dự toán trắc địa đo đạc và quyền biên tập bảng tính"
      headerAction={
        canCreate && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#105CB3] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#268DF0] transition-colors"
          >
            <FiPlus className="h-4 w-4" />
            <span>Tạo Báo Giá Mới</span>
          </button>
        )
      }
    >
      <div className="space-y-6">
        {/* Filters Strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-blue-100 bg-white p-4 shadow-xs">
          <div className="relative w-full sm:w-80">
            <FiSearch className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên dự án, số BG, khách hàng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-4 text-xs focus:border-[#268DF0] focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#268DF0] focus:outline-hidden"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="nhap">Mới giao (Nháp)</option>
              <option value="dang_lam">Đang biên tập</option>
              <option value="da_gui">Đã hoàn tất / Gửi</option>
            </select>

            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
              Tổng số: <strong className="text-[#105CB3]">{filteredProjects.length}</strong>
            </span>
          </div>
        </div>

        {/* Projects Cards Grid */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-[#105CB3]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Đang tải danh sách hồ sơ báo giá...</span>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <FiFolder className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">Chưa có hồ sơ báo giá nào</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              {canCreate
                ? "Bấm 'Tạo Báo Giá Mới' để tải lên file Excel biểu mẫu hoặc tạo báo giá trắng ban đầu."
                : "Bạn chưa được phân công phụ trách hồ sơ báo giá nào."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedProjects.map((p) => (
                <div
                  key={p.id}
                  className="group flex flex-col justify-between rounded-2xl border border-blue-100 bg-white p-5 shadow-xs hover:border-[#268DF0] hover:shadow-md transition-all"
                >
                  <div>
                    {/* Card Meta Top */}
                    <div className="flex items-center justify-between gap-2 text-[11px] mb-2">
                      <span className="font-mono font-bold text-[#105CB3] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {p.soBaoGia || "BG-000"}
                      </span>
                      <span className="text-slate-400 flex items-center gap-1">
                        <FiClock className="h-3 w-3" />
                        {(p.updatedAt || p.updated_at) ? new Date(p.updatedAt || p.updated_at).toLocaleDateString("vi-VN") : "—"}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-slate-800 line-clamp-2 group-hover:text-[#105CB3] transition-colors">
                      {p.name}
                    </h3>

                    {/* Client */}
                    {(p.tenKhachHang || p.khachHang) && (
                      <p className="mt-1.5 text-xs text-slate-500 truncate flex items-center gap-1.5">
                        <RiBuilding4Line className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{p.tenKhachHang || p.khachHang}</span>
                      </p>
                    )}

                    {/* Status Badge */}
                    <div className="mt-3">
                      {p.trangThai === "da_gui" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                          <FiCheckCircle className="h-3 w-3" />
                          <span>Đã hoàn tất / Gửi</span>
                        </span>
                      )}
                      {p.trangThai === "dang_lam" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-[#105CB3] border border-blue-200">
                          <span>Đang biên tập</span>
                        </span>
                      )}
                      {p.trangThai === "nhap" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                          <span>Mới giao (Nháp)</span>
                        </span>
                      )}
                    </div>

                    {/* Assignees */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5 truncate">
                        <FiUser className="h-3.5 w-3.5 text-[#105CB3] shrink-0" />
                        <span className="truncate">
                          {getUserName(p.nguoi_phu_trach_id || p.nguoiPhuTrachId)}
                        </span>
                      </div>

                      {p.memberIds && p.memberIds.length > 0 && (
                        <div className="flex items-center gap-1 text-slate-400" title={`${p.memberIds.length} kỹ sư phối hợp`}>
                          <FiUsers className="h-3.5 w-3.5" />
                          <span>+{p.memberIds.length}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {(isAdmin || isManager || (user?.role === "user" && p.trangThai === "nhap" && (p.nguoiPhuTrachId === user?.id || p.nguoi_phu_trach_id === user?.id))) && (
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.name)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Xóa vào thùng rác (UC11)"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      )}
                      {(isAdmin || isManager) && (
                        <button
                          type="button"
                          onClick={() => handleArchive(p.id, p.name)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                          title="Lưu trữ báo giá (UC11)"
                        >
                          <FiArchive className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <Link
                      to={`/quotes/${p.id}/editor`}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-[#105CB3] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#268DF0] transition-colors"
                    >
                      <span>Mở Soạn Thảo (UC05)</span>
                      <FiExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {filteredProjects.length > 0 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white p-4 shadow-xs text-xs text-slate-500">
                <div>
                  Hiển thị{" "}
                  <strong className="text-[#105CB3]">
                    {startIndex + 1} - {Math.min(startIndex + PAGE_SIZE, filteredProjects.length)}
                  </strong>{" "}
                  trong tổng số <strong className="text-slate-800">{filteredProjects.length}</strong> hồ sơ báo giá (Trang {currentPage}/{totalPages})
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
                  >
                    <FiChevronLeft className="h-3.5 w-3.5" />
                    <span>Trước</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                      p === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold select-none">
                          ...
                        </span>
                      ) : (
                        <button
                          key={`page-${p}`}
                          type="button"
                          onClick={() => setCurrentPage(Number(p))}
                          className={`min-w-[28px] h-7 rounded-lg text-xs font-bold transition-colors ${
                            currentPage === p
                              ? "bg-[#105CB3] text-white shadow-xs"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
                  >
                    <span>Sau</span>
                    <FiChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Quote Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FiPlus className="h-4 w-4 text-[#105CB3]" />
                <span>Tạo Mới Báo Giá Trắc Địa (UC01 Nghiệp Vụ)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Option A: Upload Excel */}
              <div className="rounded-xl border border-blue-100 bg-[#F0F7FF]/50 p-4">
                <h4 className="text-xs font-bold text-[#105CB3] mb-2 flex items-center gap-1.5">
                  <FiUploadCloud className="h-4 w-4" />
                  <span>Cách 1: Tải lên biểu mẫu Excel (.xlsx)</span>
                </h4>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed p-6 text-center cursor-pointer rounded-xl transition-all ${
                    isDragActive
                      ? "border-[#268DF0] bg-blue-50"
                      : "border-slate-300 hover:border-[#105CB3]"
                  }`}
                >
                  <input {...getInputProps()} />
                  <RiFileExcel2Line className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">
                    {isDragActive ? "Thả file Excel vào đây..." : "Kéo thả file .xlsx vào đây"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">hoặc click để chọn file từ máy</p>
                </div>
              </div>

              {/* Option B: Create Blank */}
              <div className="rounded-xl border border-slate-200 p-4 bg-white">
                <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <FiFileText className="h-4 w-4 text-emerald-600" />
                  <span>Cách 2: Tạo báo giá mẫu trắng tiêu chuẩn</span>
                </h4>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nhập tên dự án báo giá mới..."
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#268DF0] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleCreateBlank}
                    disabled={isCreatingBlank}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-2 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    <FiPlus className="h-4 w-4" />
                    <span>{isCreatingBlank ? "Đang tạo..." : "Khởi Tạo Báo Giá Trắng"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  FiFileText,
  FiUser,
  FiUsers,
  FiClock,
  FiExternalLink,
  FiSearch,
  FiUserPlus,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import { RiBuilding4Line } from "react-icons/ri";
import { ProjectMetaForm } from "../ProjectMetaForm";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  soBaoGia?: string;
  khachHang?: string;
  tenKhachHang?: string;
  trangThai?: string;
  updated_at?: string;
  updatedAt?: string;
  nguoi_phu_trach_id?: string;
  nguoiPhuTrachId?: string;
  memberIds?: string[];
}

const PAGE_SIZE = 20;

export const TaskPanel: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; username: string; fullName?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectForMeta, setSelectedProjectForMeta] = useState<Project | null>(null);

  const [columnLimits, setColumnLimits] = useState<Record<string, number>>({
    nhap: PAGE_SIZE,
    dang_lam: PAGE_SIZE,
    da_gui: PAGE_SIZE,
  });

  const loadProjects = async () => {
    try {
      setLoading(true);
      const [list, uList] = await Promise.all([
        api.getProjects(),
        api.getActiveUsers().catch(() => []),
      ]);
      setProjects(list || []);
      setUsersList(Array.isArray(uList) ? uList : []);
    } catch (e) {
      console.error("Failed to load tasks:", e);
      toast.error("Không thể tải danh sách công việc");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const getUserName = (id?: string) => {
    if (!id) return "Chưa gán";
    const found = usersList.find((u) => u.id === id);
    return found?.fullName || found?.username || id;
  };

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.soBaoGia?.toLowerCase().includes(q) ||
      (p.tenKhachHang || p.khachHang)?.toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      id: "nhap",
      title: "Mới giao (Nháp)",
      color: "border-amber-400 bg-amber-50/40 text-amber-800",
      badgeColor: "bg-amber-100 text-amber-800",
      items: filteredProjects.filter((p) => p.trangThai === "nhap"),
    },
    {
      id: "dang_lam",
      title: "Đang biên tập",
      color: "border-[#268DF0] bg-blue-50/40 text-[#105CB3]",
      badgeColor: "bg-blue-100 text-[#105CB3]",
      items: filteredProjects.filter((p) => p.trangThai === "dang_lam"),
    },
    {
      id: "da_gui",
      title: "Đã hoàn thành / Gửi",
      color: "border-emerald-500 bg-emerald-50/40 text-emerald-800",
      badgeColor: "bg-emerald-100 text-emerald-800",
      items: filteredProjects.filter((p) => p.trangThai === "da_gui"),
    },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[#105CB3]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Đang tải bảng công việc trắc địa...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FiFileText className="h-5 w-5 text-[#105CB3]" />
            <span>Điều phối Công việc & Tiến độ Báo giá (Kanban)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý các hồ sơ trắc địa theo 3 giai đoạn luồng việc thực tế của công ty.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên DA, mã BG, khách hàng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs shadow-xs focus:border-[#268DF0] focus:outline-hidden"
          />
        </div>
      </div>

      {/* 3-Column Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {columns.map((col) => {
          const limit = columnLimits[col.id] || PAGE_SIZE;
          const displayedItems = col.items.slice(0, limit);
          const hasMore = limit < col.items.length;
          const canCollapse = limit > PAGE_SIZE;

          return (
            <div
              key={col.id}
              className={`flex flex-col rounded-2xl border ${col.color.split(" ")[0]} bg-slate-50/80 p-4 shadow-xs`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {col.title}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${col.badgeColor}`}
                  >
                    {col.items.length}
                  </span>
                </div>
              </div>

              {/* Column Cards */}
              <div className="mt-3 flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar pr-1">
                {col.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    Không có hồ sơ trong giai đoạn này
                  </div>
                ) : (
                  displayedItems.map((proj) => (
                    <div
                      key={proj.id}
                      className="group rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Code and Date */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                          <span className="font-mono font-semibold text-[#105CB3]">
                            {proj.soBaoGia || "BG-CHƯA-SỐ"}
                          </span>
                          <span className="flex items-center gap-1">
                            <FiClock className="h-3 w-3" />
                            {(proj.updatedAt || proj.updated_at) ? new Date(proj.updatedAt || proj.updated_at).toLocaleDateString("vi-VN") : "—"}
                          </span>
                        </div>

                        {/* Project Title */}
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-[#105CB3] transition-colors">
                          {proj.name}
                        </h4>

                        {/* Client */}
                        {(proj.tenKhachHang || proj.khachHang) && (
                          <p className="mt-1 text-[11px] text-slate-500 truncate flex items-center gap-1">
                            <RiBuilding4Line className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{proj.tenKhachHang || proj.khachHang}</span>
                          </p>
                        )}

                        {/* Assignee & Members */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5 truncate">
                            <FiUser className="h-3 w-3 text-[#105CB3] shrink-0" />
                            <span className="truncate">
                              {getUserName(proj.nguoi_phu_trach_id || proj.nguoiPhuTrachId)}
                            </span>
                          </div>

                          {proj.memberIds && proj.memberIds.length > 0 && (
                            <div className="flex items-center gap-1 text-slate-400" title={`${proj.memberIds.length} thành viên phối hợp`}>
                              <FiUsers className="h-3 w-3" />
                              <span>+{proj.memberIds.length}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        {user?.role === "admin" && (
                          <button
                            type="button"
                            onClick={() => setSelectedProjectForMeta(proj)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#105CB3] transition-colors"
                            title="Phân công nhân sự & sửa metadata"
                          >
                            <FiUserPlus className="h-3 w-3" />
                            <span>Phân công</span>
                          </button>
                        )}

                        <Link
                          to={`/quotes/${proj.id}/editor`}
                          className="ml-auto inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#105CB3] hover:bg-[#105CB3] hover:text-white transition-colors"
                        >
                          <span>Mở Soạn thảo (UC05)</span>
                          <FiExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Column Progressive Pagination Footer */}
              {col.items.length > PAGE_SIZE && (
                <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-col gap-1.5 shrink-0">
                  <div className="text-[10px] text-slate-500 font-medium text-center">
                    Đang hiển thị <strong className="text-[#105CB3]">{displayedItems.length}</strong> / <strong>{col.items.length}</strong> hồ sơ
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasMore && (
                      <button
                        type="button"
                        onClick={() =>
                          setColumnLimits((prev) => ({
                            ...prev,
                            [col.id]: (prev[col.id] || PAGE_SIZE) + PAGE_SIZE,
                          }))
                        }
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50/80 py-1.5 px-2 text-[11px] font-bold text-[#105CB3] hover:bg-blue-100 transition-colors shadow-2xs"
                      >
                        <FiChevronDown className="h-3.5 w-3.5" />
                        <span>Hiển thị thêm (+{Math.min(PAGE_SIZE, col.items.length - limit)})</span>
                      </button>
                    )}
                    {canCollapse && (
                      <button
                        type="button"
                        onClick={() =>
                          setColumnLimits((prev) => ({
                            ...prev,
                            [col.id]: PAGE_SIZE,
                          }))
                        }
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-2xs"
                      >
                        <FiChevronUp className="h-3.5 w-3.5" />
                        <span>Thu gọn (về 20)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Meta Assignment Modal */}
      {selectedProjectForMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FiUserPlus className="h-4 w-4 text-[#105CB3]" />
              <span>Phân Công Nhân Sự • {selectedProjectForMeta.name}</span>
            </h3>

            <ProjectMetaForm
              project={selectedProjectForMeta}
              onUpdated={() => {
                setSelectedProjectForMeta(null);
                loadProjects();
                toast.success("Đã cập nhật phân công thành viên!");
              }}
            />

            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setSelectedProjectForMeta(null)}
                className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

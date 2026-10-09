import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  FiUsers,
  FiAlertTriangle,
  FiClock,
  FiArrowRight,
  FiCheckCircle,
  FiShield,
  FiActivity,
  FiUserCheck,
  FiAlertCircle,
  FiLock,
  FiUnlock,
  FiFileText,
  FiCompass,
  FiRefreshCw,
  FiTrendingUp,
  FiCheckSquare,
} from "react-icons/fi";
import { RiBuilding4Line, RiDashboardLine } from "react-icons/ri";

interface Project {
  id: string;
  name: string;
  soBaoGia?: string;
  khachHang?: string;
  trangThai?: string;
  updated_at?: string;
  createdAt?: string;
  nguoi_phu_trach_id?: string;
  nguoiPhuTrachId?: string;
  memberIds?: string[];
}

interface UserItem {
  id: string;
  username: string;
  fullName?: string;
  role: string;
  is_active?: boolean;
  active?: boolean;
}

interface AuditLog {
  id: string;
  action: string;
  username: string;
  created_at: string;
  details?: string;
  ip_address?: string;
}

export const OverviewPanel: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadExecutiveData = async () => {
    try {
      const [projList, uList] = await Promise.all([
        api.getProjects(),
        user?.role === "admin"
          ? api.getUsers().catch(() => api.getActiveUsers().catch(() => []))
          : api.getActiveUsers().catch(() => []),
      ]);

      setProjects(projList || []);
      setUsersList(Array.isArray(uList) ? uList : []);

      if (user?.role === "admin") {
        try {
          const logs = await api.getAuditLogs(12);
          setAuditLogs(logs || []);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.error("Failed to load executive overview data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadExecutiveData();
  }, [user?.role]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadExecutiveData();
  };

  // --- Tính toán Tải công việc từng nhân sự (Staff Workload & Capacity Radar) ---
  const staffWorkload = useMemo(() => {
    return usersList
      .filter((u) => u.role !== "admin") // Focus on surveyors & accountants
      .map((u) => {
        const leadProjects = projects.filter(
          (p) => p.nguoi_phu_trach_id === u.id || p.nguoiPhuTrachId === u.id
        );
        const memberProjects = projects.filter(
          (p) => Array.isArray(p.memberIds) && p.memberIds.includes(u.id)
        );
        const total = leadProjects.length + memberProjects.length;

        let status: "ready" | "optimal" | "high" | "overload" = "ready";
        let statusLabel = "Sẵn sàng nhận việc";
        let statusBadge = "bg-slate-100 text-slate-700 border-slate-200";

        if (total === 0) {
          status = "ready";
          statusLabel = "Sẵn sàng nhận việc";
          statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
        } else if (total <= 3) {
          status = "optimal";
          statusLabel = "Tải hợp lý";
          statusBadge = "bg-blue-50 text-[#105CB3] border-blue-200";
        } else if (total <= 5) {
          status = "high";
          statusLabel = "Tải cao";
          statusBadge = "bg-amber-50 text-amber-700 border-amber-200";
        } else {
          status = "overload";
          statusLabel = "Nguy cơ quá tải";
          statusBadge = "bg-rose-50 text-rose-700 border-rose-200";
        }

        return {
          user: u,
          leadCount: leadProjects.length,
          memberCount: memberProjects.length,
          total,
          status,
          statusLabel,
          statusBadge,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [usersList, projects]);

  // --- Tính toán Phát hiện Điểm nghẽn Vận hành (Bottlenecks & SLA Alert Radar) ---
  const operationalBottlenecks = useMemo(() => {
    const list: {
      id: string;
      title: string;
      level: "critical" | "warning" | "info";
      desc: string;
      project: Project;
      actionUrl: string;
      actionText: string;
    }[] = [];

    const now = Date.now();

    projects.forEach((p) => {
      const hasLead = Boolean(p.nguoi_phu_trach_id || p.nguoiPhuTrachId);
      const isDraft = !p.trangThai || p.trangThai === "nhap" || p.trangThai === "DANG_XU_LY";
      const isApproved = p.trangThai === "da_duyet" || p.trangThai === "DA_DUYET";
      const dateVal = new Date(p.updated_at || p.createdAt || 0).getTime();
      const daysOld = Math.floor((now - dateVal) / (1000 * 60 * 60 * 24));

      // 1. Critical: Chưa có kỹ sư chủ trì
      if (!hasLead) {
        list.push({
          id: `unassigned-${p.id}`,
          title: "Chưa phân công kỹ sư chủ trì",
          level: "critical",
          desc: `Hồ sơ "${p.name}" (${p.soBaoGia || "Chưa cấp số BG"}) tạo ${daysOld > 0 ? `${daysOld} ngày trước` : "hôm nay"} hiện chưa được giao cho bất kỳ kỹ sư nào chịu trách nhiệm chính.`,
          project: p,
          actionUrl: "/management/tasks",
          actionText: "Phân công chủ trì",
        });
      }

      // 2. Warning: Ngâm nháp quá hạn (> 7 ngày chưa hoàn tất)
      if (isDraft && daysOld >= 7) {
        list.push({
          id: `stale-${p.id}`,
          title: `Hồ sơ ngâm Nháp quá hạn (${daysOld} ngày)`,
          level: "warning",
          desc: `Dự án "${p.name}" chưa hoàn thành biên tập biểu mẫu Excel sau ${daysOld} ngày. Cần đôn đốc kỹ sư phụ trách đẩy nhanh tiến độ.`,
          project: p,
          actionUrl: `/quotes/${p.id}/editor`,
          actionText: "Kiểm tra biểu mẫu",
        });
      }

      // 3. Info: Đã duyệt nhưng chưa chuyển sang Đã gửi khách
      if (isApproved && daysOld >= 2) {
        list.push({
          id: `approved-${p.id}`,
          title: `Đã phê duyệt nhưng chưa gửi khách (${daysOld} ngày)`,
          level: "info",
          desc: `Hồ sơ "${p.name}" đã hoàn tất thẩm định nội bộ nhưng chưa cập nhật trạng thái gửi cho khách hàng ${p.khachHang || ""}.`,
          project: p,
          actionUrl: "/management/tasks",
          actionText: "Xác nhận gửi khách",
        });
      }
    });

    return list;
  }, [projects]);

  // --- Chỉ số Vận hành Cấp cao (Executive Indices) ---
  const totalProjects = projects.length;
  const assignedProjectsCount = projects.filter(
    (p) => Boolean(p.nguoi_phu_trach_id || p.nguoiPhuTrachId)
  ).length;
  const leadAssignmentRate = totalProjects
    ? Math.round((assignedProjectsCount / totalProjects) * 100)
    : 100;
  const activeStaffCount = staffWorkload.length;
  const overloadedCount = staffWorkload.filter((s) => s.status === "overload").length;
  const readyStaffCount = staffWorkload.filter((s) => s.status === "ready").length;

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-[#105CB3]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#105CB3] border-t-transparent" />
          <span>Đang tổng hợp dữ liệu vận hành & radar điểm nghẽn...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Command Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0b4f9c] via-[#105CB3] to-[#268DF0] p-6 text-white shadow-md">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-200 text-xs font-bold uppercase tracking-wider mb-1.5">
              <RiBuilding4Line className="h-4 w-4 text-blue-200" />
              <span>UC01 • Trung Tâm Giám Sát Vận Hành & Điều Phối Quản Lý</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Giám Sát Tải Nhân Sự & Điểm Nghẽn Tiến Độ
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
              Trang phân tích chuyên biệt dành cho Ban Quản Lý: Kiểm soát tỷ lệ phân công công
              việc, phát hiện tức thì các dự án ngâm trễ và theo dõi luồng kiểm toán thời gian thực.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2.5 text-xs font-bold text-white backdrop-blur-xs hover:bg-white/25 transition-all disabled:opacity-50"
              title="Làm mới số liệu"
            >
              <FiRefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Đang quét..." : "Làm mới dữ liệu"}</span>
            </button>
            <Link
              to="/management/tasks"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#105CB3] shadow-sm hover:bg-blue-50 transition-colors"
            >
              <FiCheckSquare className="h-4 w-4" />
              <span>Bảng điều phối Task</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Chỉ số Sức Khỏe Vận Hành (Executive Operational Indices - KHÔNG lặp lại số lượng báo giá) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Index 1: Tỷ lệ phân công Kỹ sư chủ trì */}
        <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tỷ lệ có Chủ trì
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#105CB3]">
              <FiUserCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-900">{leadAssignmentRate}%</p>
              <span className="text-xs font-semibold text-slate-500">
                ({assignedProjectsCount}/{totalProjects} dự án)
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                style={{ width: `${leadAssignmentRate}%` }}
                className={`h-full transition-all duration-500 ${
                  leadAssignmentRate >= 90
                    ? "bg-emerald-500"
                    : leadAssignmentRate >= 70
                    ? "bg-[#268DF0]"
                    : "bg-amber-500"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Index 2: Cảnh báo điểm nghẽn SLA */}
        <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Điểm nghẽn cần xử lý
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <FiAlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p
                className={`text-2xl font-black ${
                  operationalBottlenecks.length > 0 ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {operationalBottlenecks.length}
              </p>
              <span className="text-xs font-semibold text-slate-500">vấn đề phát hiện</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {operationalBottlenecks.length > 0
                ? "Bao gồm dự án chưa giao hoặc ngâm nháp lâu"
                : "Không có điểm nghẽn nào bị tồn đọng"}
            </p>
          </div>
        </div>

        {/* Index 3: Công suất đội ngũ khảo sát */}
        <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Nhân sự sẵn sàng
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FiUsers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-emerald-600">{readyStaffCount}</p>
              <span className="text-xs font-semibold text-slate-500">
                / {activeStaffCount} kỹ sư
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {overloadedCount > 0
                ? `Cảnh báo: ${overloadedCount} nhân sự đang quá tải (>5 việc)`
                : "Phân bổ tải giữa các kỹ sư đang ở mức cân bằng"}
            </p>
          </div>
        </div>

        {/* Index 4: Giám sát an toàn & kiểm toán */}
        <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Nhật ký kiểm toán
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <FiShield className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-indigo-700">{auditLogs.length}</p>
              <span className="text-xs font-semibold text-slate-500">thao tác gần nhất</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Ghi nhận các lệnh khóa tài khoản, phân quyền ô & duyệt file
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Radar Điểm Nghẽn & Ma Trận Tải Nhân Sự */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Radar Cảnh Báo Điểm Nghẽn Vận Hành */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <FiAlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Radar Cảnh Báo Điểm Nghẽn Vận Hành & Tiến Độ
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tự động phát hiện các hồ sơ thiếu nhân sự chủ trì hoặc tồn đọng kéo dài
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                {operationalBottlenecks.length} cảnh báo
              </span>
            </div>

            {operationalBottlenecks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 py-8 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
                  <FiCheckCircle className="h-6 w-6" />
                </div>
                <h4 className="text-xs font-bold text-emerald-900">
                  Vận hành tối ưu • Không có điểm nghẽn
                </h4>
                <p className="mt-1 text-[11px] text-emerald-700 max-w-sm">
                  100% hồ sơ báo giá đều đã có kỹ sư chịu trách nhiệm chính và đang được triển khai
                  đúng chu kỳ tiến độ.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {operationalBottlenecks.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3.5 transition-all ${
                      item.level === "critical"
                        ? "border-rose-200 bg-rose-50/40 hover:bg-rose-50/70"
                        : item.level === "warning"
                        ? "border-amber-200 bg-amber-50/40 hover:bg-amber-50/70"
                        : "border-blue-200 bg-blue-50/40 hover:bg-blue-50/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              item.level === "critical"
                                ? "bg-rose-100 text-rose-700"
                                : item.level === "warning"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-[#105CB3]"
                            }`}
                          >
                            {item.level === "critical"
                              ? "Khẩn cấp"
                              : item.level === "warning"
                              ? "Cảnh báo trễ"
                              : "Cần xử lý"}
                          </span>
                          <h4 className="truncate text-xs font-bold text-slate-800">
                            {item.title}
                          </h4>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>

                      <Link
                        to={item.actionUrl}
                        className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold shadow-xs transition-colors ${
                          item.level === "critical"
                            ? "bg-rose-600 text-white hover:bg-rose-700"
                            : "bg-[#105CB3] text-white hover:bg-[#268DF0]"
                        }`}
                      >
                        <span>{item.actionText}</span>
                        <FiArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}

                {operationalBottlenecks.length > 5 && (
                  <div className="pt-2 text-center">
                    <Link
                      to="/management/tasks"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#105CB3] hover:underline"
                    >
                      <span>Xem thêm {operationalBottlenecks.length - 5} điểm nghẽn khác trên Bảng Task</span>
                      <FiArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dòng Thời Gian Kiểm Toán Trực Tiếp (Live Audit Stream) */}
          <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <FiShield className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Nhật Ký Kiểm Toán An Toàn & Điều Hành
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Theo dõi trực tiếp các thao tác can thiệp tài khoản, phân quyền và duyệt file
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                Ghi nhận tự động (SQLite)
              </span>
            </div>

            {auditLogs.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Chưa có thao tác kiểm toán mới nào được ghi nhận.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {auditLogs.map((log) => {
                  const isLock = log.action?.includes("LOCK") || log.action?.includes("khoa");
                  const isRole = log.action?.includes("ROLE") || log.action?.includes("QUYEN");
                  const isStatus = log.action?.includes("STATUS") || log.action?.includes("TRANG_THAI");

                  return (
                    <div key={log.id} className="py-2.5 flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                          isLock
                            ? "bg-rose-100 text-rose-600"
                            : isRole
                            ? "bg-indigo-100 text-indigo-600"
                            : isStatus
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-blue-100 text-[#105CB3]"
                        }`}
                      >
                        {isLock ? (
                          <FiLock className="h-3 w-3" />
                        ) : isRole ? (
                          <FiShield className="h-3 w-3" />
                        ) : (
                          <FiActivity className="h-3 w-3" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-800">
                            <span className="text-[#105CB3]">{log.username || "Hệ thống"}</span>{" "}
                            • <span className="font-medium text-slate-600">{log.action}</span>
                          </p>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {new Date(log.created_at).toLocaleString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </span>
                        </div>
                        {log.details && (
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 font-mono">
                            {log.details}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Ma Trận Tải Nhân Sự & Quick Action Hub */}
        <div className="lg:col-span-5 space-y-6">
          {/* Ma Trận Phân Bổ Tải Kỹ Sư / Nhân Viên (Staff Capacity Matrix) */}
          <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#105CB3]">
                  <FiUsers className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Ma Trận Tải Công Việc Kỹ Sư
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Đo lường số lượng dự án đảm nhiệm theo từng nhân sự
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#105CB3]">
                {staffWorkload.length} nhân sự
              </span>
            </div>

            {staffWorkload.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Chưa có dữ liệu nhân viên kỹ thuật.
              </p>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {staffWorkload.map((item) => (
                  <div
                    key={item.user.id}
                    className="rounded-xl border border-slate-100 bg-[#F0F7FF]/50 p-3 hover:bg-[#F0F7FF] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#105CB3] border border-blue-200 font-bold text-xs shadow-2xs">
                          {item.user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="truncate text-xs font-bold text-slate-800">
                            {item.user.fullName || item.user.username}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            @{item.user.username} • {item.user.role === "manager" ? "Kế toán" : "Kỹ sư đo đạc"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.statusBadge}`}
                      >
                        {item.statusLabel}
                      </span>
                    </div>

                    {/* Workload Stats & Gauge */}
                    <div className="mt-2.5 pt-2 border-t border-blue-100/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-slate-600">
                          Chủ trì: <strong className="text-[#105CB3]">{item.leadCount}</strong>
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">
                          Tham gia: <strong className="text-slate-800">{item.memberCount}</strong>
                        </span>
                      </div>

                      <Link
                        to={`/management/tasks`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#105CB3] hover:underline"
                      >
                        <span>Điều phối</span>
                        <FiArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Phím Tắt Nghiệp Vụ Quản Trị Cấp Cao (Executive Action Hub) */}
          <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Phân Hệ Quản Trị & Nghiệp Vụ Cốt Lõi
            </h3>

            <div className="grid grid-cols-1 gap-2.5">
              <Link
                to="/management/tasks"
                className="group flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#105CB3] group-hover:bg-[#105CB3] group-hover:text-white transition-colors">
                    <FiCheckSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Quản lý công việc & Task</h4>
                    <p className="text-[10px] text-slate-500">
                      Bảng điều phối Kanban 3 cột & gán người phụ trách chính
                    </p>
                  </div>
                </div>
                <FiArrowRight className="h-4 w-4 text-slate-400 group-hover:text-[#105CB3] transition-colors" />
              </Link>

              <Link
                to="/management/revenue"
                className="group flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <FiTrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Báo cáo Doanh thu & Dự toán</h4>
                    <p className="text-[10px] text-slate-500">
                      Theo dõi tổng giá trị báo giá & ghi chú kiểm toán tài chính
                    </p>
                  </div>
                </div>
                <FiArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </Link>

              {user?.role === "admin" && (
                <>
                  <Link
                    to="/management/users"
                    className="group flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-[#268DF0] group-hover:bg-[#268DF0] group-hover:text-white transition-colors">
                        <FiUsers className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Quản lý Người dùng</h4>
                        <p className="text-[10px] text-slate-500">
                          Tạo mới, sửa, khóa tài khoản nhân viên & đổi mật khẩu
                        </p>
                      </div>
                    </div>
                    <FiArrowRight className="h-4 w-4 text-slate-400 group-hover:text-[#268DF0] transition-colors" />
                  </Link>

                  <Link
                    to="/management/roles"
                    className="group flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <FiLock className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Phân quyền Hệ thống</h4>
                        <p className="text-[10px] text-slate-500">
                          Ma trận kiểm soát 3 vai trò Admin - Kế toán - Nhân viên
                        </p>
                      </div>
                    </div>
                    <FiArrowRight className="h-4 w-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

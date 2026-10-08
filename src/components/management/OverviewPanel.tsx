import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  FiFileText,
  FiClock,
  FiCheckCircle,
  FiSend,
  FiUsers,
  FiActivity,
  FiArrowRight,
  FiFolder,
  FiPlus,
  FiAlertCircle,
} from "react-icons/fi";
import { RiBuilding4Line } from "react-icons/ri";

interface Project {
  id: string;
  name: string;
  soBaoGia?: string;
  khachHang?: string;
  trangThai?: string;
  updated_at?: string;
  nguoi_phu_trach_id?: string;
}

interface AuditLog {
  id: string;
  action: string;
  username: string;
  created_at: string;
  details?: string;
}

export const OverviewPanel: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [projList, activeUsers] = await Promise.all([
          api.getProjects(),
          user?.role === "admin" ? api.getActiveUsers() : Promise.resolve([]),
        ]);
        if (mounted) {
          setProjects(projList || []);
          setActiveUsersCount(Array.isArray(activeUsers) ? activeUsers.length : 0);
        }

        // Load logs if admin
        if (user?.role === "admin") {
          try {
            const logs = await api.getAuditLogs(10);
            if (mounted) setAuditLogs(logs || []);
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        console.error("Failed to load overview data:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [user?.role]);

  const total = projects.length;
  const nhapCount = projects.filter((p) => p.trangThai === "nhap").length;
  const dangLamCount = projects.filter((p) => p.trangThai === "dang_lam").length;
  const daGuiCount = projects.filter((p) => p.trangThai === "da_gui").length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[#105CB3]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Đang tải số liệu vận hành từ hệ thống...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#105CB3] to-[#268DF0] p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-100 text-xs font-semibold uppercase tracking-wider mb-1">
              <RiBuilding4Line className="h-4 w-4" />
              <span>UC01 • Trung Tâm Quản Trị & Điều Hành Phúc Gia</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Tổng quan Vận hành & Tiến độ Báo giá
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-xl">
              Hệ thống theo dõi các đầu việc trắc địa đo đạc, trạng thái hoàn thành biểu mẫu
              và điều phối nhân sự theo thời gian thực.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/quotes"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#105CB3] shadow-sm hover:bg-blue-50 transition-colors"
            >
              <FiFolder className="h-4 w-4" />
              <span>Danh mục báo giá</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total */}
        <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tổng số Báo giá
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#105CB3]">
              <FiFileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900">{total}</p>
            <p className="mt-1 text-[11px] text-slate-500">Toàn bộ hồ sơ trong cơ sở dữ liệu</p>
          </div>
        </div>

        {/* Card 2: Nháp / Mới giao */}
        <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Mới giao (Nháp)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <FiClock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-amber-600">{nhapCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">Chờ kỹ sư tiếp nhận và nhập số liệu</p>
          </div>
        </div>

        {/* Card 3: Đang điền */}
        <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đang biên tập
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-[#268DF0]">
              <FiActivity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-[#268DF0]">{dangLamCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">Kỹ sư đang soạn thảo bảng tính</p>
          </div>
        </div>

        {/* Card 4: Đã gửi khách */}
        <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đã hoàn tất / Gửi
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FiCheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-600">{daGuiCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">Đã chốt gửi khách hàng</p>
          </div>
        </div>
      </div>

      {/* Progress & Activities Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Progress Pipeline */}
        <div className="lg:col-span-7 rounded-xl border border-blue-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FiActivity className="h-4 w-4 text-[#105CB3]" />
              <span>Tiến độ Hồ sơ Trắc địa</span>
            </h3>
            <span className="text-xs text-slate-500">Phân bổ tỷ lệ %</span>
          </div>

          <div className="space-y-4">
            {/* Visual Bar */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 flex">
              <div
                style={{ width: `${total ? (nhapCount / total) * 100 : 0}%` }}
                className="bg-amber-400 transition-all duration-500"
                title={`Mới giao: ${nhapCount}`}
              />
              <div
                style={{ width: `${total ? (dangLamCount / total) * 100 : 0}%` }}
                className="bg-[#268DF0] transition-all duration-500"
                title={`Đang làm: ${dangLamCount}`}
              />
              <div
                style={{ width: `${total ? (daGuiCount / total) * 100 : 0}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Đã gửi: ${daGuiCount}`}
              />
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-amber-50/60 p-2.5 border border-amber-100">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 mr-1.5" />
                <span className="font-semibold text-slate-700">Mới giao</span>
                <p className="text-amber-700 font-bold mt-0.5">
                  {total ? Math.round((nhapCount / total) * 100) : 0}%
                </p>
              </div>
              <div className="rounded-lg bg-blue-50/60 p-2.5 border border-blue-100">
                <span className="inline-block h-2 w-2 rounded-full bg-[#268DF0] mr-1.5" />
                <span className="font-semibold text-slate-700">Đang biên tập</span>
                <p className="text-[#105CB3] font-bold mt-0.5">
                  {total ? Math.round((dangLamCount / total) * 100) : 0}%
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50/60 p-2.5 border border-emerald-100">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />
                <span className="font-semibold text-slate-700">Đã gửi</span>
                <p className="text-emerald-700 font-bold mt-0.5">
                  {total ? Math.round((daGuiCount / total) * 100) : 0}%
                </p>
              </div>
            </div>

            {/* Quick Link to Task panel */}
            <div className="pt-2 text-right">
              <Link
                to="/management/tasks"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#105CB3] hover:text-[#268DF0]"
              >
                <span>Xem bảng điều phối Task (Kanban)</span>
                <FiArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Info: Active Staff or System Note */}
        <div className="lg:col-span-5 rounded-xl border border-blue-100 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <FiUsers className="h-4 w-4 text-[#105CB3]" />
              <span>Tình hình Nhân sự Vận hành</span>
            </h3>

            {user?.role === "admin" ? (
              <div className="rounded-xl bg-[#F0F7FF] border border-blue-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">Nhân sự kích hoạt</span>
                  <span className="text-xl font-bold text-[#105CB3]">{activeUsersCount} tài khoản</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                  Tài khoản có quyền đăng nhập và tham gia các tổ đội khảo sát trắc địa.
                </p>
                <div className="mt-3">
                  <Link
                    to="/management/users"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#105CB3] hover:underline"
                  >
                    <span>Quản lý danh bạ người dùng</span>
                    <FiArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Ghi chú vận hành kế toán</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Kế toán viên có quyền theo dõi số liệu tiến độ dự án, xuất số liệu báo giá
                  và kiểm tra bảng tính theo phân quyền được cấp.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Cập nhật mới nhất</span>
            <span className="font-medium text-slate-700">Thời gian thực (SQLite sync)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

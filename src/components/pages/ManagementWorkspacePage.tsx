import React from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { AppShell } from "../../layout/AppShell";
import { OverviewPanel } from "../management/OverviewPanel";
import { TaskPanel } from "../management/TaskPanel";
import { RevenuePanel } from "../management/RevenuePanel";
import { UserPanel } from "../management/UserPanel";
import { RolePanel } from "../management/RolePanel";
import {
  FiGrid,
  FiCheckSquare,
  FiTrendingUp,
  FiUsers,
  FiLock,
  FiAlertTriangle,
} from "react-icons/fi";

export const ManagementWorkspacePage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Route protection: Only Admin and Manager are allowed in UC01
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return <Navigate to="/" replace />;
  }

  const isAdmin = user.role === "admin";

  // Determine current sub-tab
  const path = location.pathname;
  let activeTab = "overview";
  if (path.includes("/tasks")) activeTab = "tasks";
  else if (path.includes("/revenue")) activeTab = "revenue";
  else if (path.includes("/users")) activeTab = "users";
  else if (path.includes("/roles")) activeTab = "roles";

  // Guard: Manager cannot access users or roles
  if (!isAdmin && (activeTab === "users" || activeTab === "roles")) {
    return (
      <AppShell
        title="Quản Trị & Điều Hành • Không Gian Quản Lý"
        subtitle="Hệ thống quản lý báo giá và kiểm soát vận hành"
      >
        <div className="flex h-96 flex-col items-center justify-center text-center p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
            <FiAlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Truy Cập Bị Từ Chối (HTTP 403)</h2>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            Kế toán / Quản lý không có thẩm quyền truy cập phân hệ quản lý người dùng và ma trận
            phân quyền hệ thống. Quyền này chỉ dành riêng cho Quản trị viên (Admin).
          </p>
          <Link
            to="/management/overview"
            className="mt-4 rounded-xl bg-[#105CB3] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#268DF0]"
          >
            Quay lại Tổng quan quản lý
          </Link>
        </div>
      </AppShell>
    );
  }

  const tabs = [
    {
      id: "overview",
      label: "Tổng quan quản lý",
      path: "/management/overview",
      icon: FiGrid,
    },
    {
      id: "tasks",
      label: "Quản lý công việc / Task",
      path: "/management/tasks",
      icon: FiCheckSquare,
    },
    {
      id: "revenue",
      label: "Báo cáo doanh thu",
      path: "/management/revenue",
      icon: FiTrendingUp,
    },
    ...(isAdmin
      ? [
          {
            id: "users",
            label: "Quản lý người dùng",
            path: "/management/users",
            icon: FiUsers,
          },
          {
            id: "roles",
            label: "Phân quyền hệ thống",
            path: "/management/roles",
            icon: FiLock,
          },
        ]
      : []),
  ];

  return (
    <AppShell
      title="Quản Trị & Điều Hành • Không Gian Quản Lý"
      subtitle="Chương III - UC01: Quản lý người dùng, phân quyền, các task và hiển thị doanh thu"
    >
      <div className="space-y-6">
        {/* Sub-tab Navigation Bar */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2 custom-scrollbar">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.path}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#105CB3] text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-blue-50/50 hover:text-[#105CB3]"
                }`}
              >
                <TabIcon className="h-4 w-4" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Tab Content Panel */}
        <div className="min-h-[500px]">
          {activeTab === "overview" && <OverviewPanel />}
          {activeTab === "tasks" && <TaskPanel />}
          {activeTab === "revenue" && <RevenuePanel />}
          {activeTab === "users" && <UserPanel />}
          {activeTab === "roles" && <RolePanel />}
        </div>
      </div>
    </AppShell>
  );
};

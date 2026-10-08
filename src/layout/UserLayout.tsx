import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight, FileSpreadsheet, FileText, FolderOpen, LayoutDashboard, LogOut, PanelLeftClose, UserRound } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge";
import type { TrangThai } from "../lib/constants";

type UserLayoutProps = {
  username?: string;
  selectedProject?: any;
  pendingCount?: number;
  activeTab: string;
  isMobileOpen: boolean;
  isCollapsed: boolean;
  onTabChange: (tab: string) => void;
  onMobileOpenChange: (open: boolean) => void;
  onToggleNavigation: () => void;
  onProfile: () => void;
  onLogout: () => void;
  children: ReactNode;
};

export function UserLayout({
  username,
  selectedProject,
  pendingCount = 0,
  activeTab,
  isMobileOpen,
  isCollapsed,
  onTabChange,
  onMobileOpenChange,
  onToggleNavigation,
  onProfile,
  onLogout,
  children,
}: UserLayoutProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const itemClass = (active: boolean) => `w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${isCollapsed ? "justify-center" : ""} ${active ? "bg-white text-[#0b4f9c] shadow-sm" : "text-blue-50 hover:bg-white/10"}`;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f8ff] text-slate-900">
      {/* Sidebar matching Admin */}
      <aside className={`${isMobileOpen ? "fixed inset-y-0 left-0 z-50 flex shadow-2xl" : "hidden"} md:flex ${isCollapsed ? "md:w-[76px]" : "md:w-[248px]"} w-[248px] shrink-0 flex-col border-r border-[#0a4384] bg-[#0b4f9c] text-white transition-[width] duration-200`}>
        <div className={`flex h-[72px] items-center gap-3 border-b border-white/15 px-4 ${isCollapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white font-black tracking-tight text-[#0b4f9c] shadow-sm">PG</div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Phúc Gia</p>
                <p className="truncate text-[11px] text-blue-100">Không gian nhân viên</p>
              </div>
            )}
          </div>
          <button type="button" onClick={() => onMobileOpenChange(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-100 hover:bg-white/10 md:hidden" aria-label="Đóng điều hướng"><PanelLeftClose className="h-4 w-4" /></button>
        </div>

        {!isCollapsed && <div className="px-4 pb-3 pt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200">Không gian làm việc</div>}
        
        <nav className="space-y-1 px-3" aria-label="Điều hướng nhân viên">
          <button
            type="button"
            onClick={() => { onTabChange("dashboard"); onMobileOpenChange(false); }}
            title={isCollapsed ? "Dashboard" : undefined}
            className={itemClass(activeTab === "dashboard")}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            {!isCollapsed && <><span className="flex-1">Dashboard</span><ChevronRight className="h-3.5 w-3.5 opacity-60" /></>}
          </button>

          <button
            type="button"
            onClick={() => { onTabChange("file"); onMobileOpenChange(false); }}
            title={isCollapsed ? "Quản lý báo giá" : undefined}
            className={itemClass(activeTab === "file")}
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            {!isCollapsed && <><span className="flex-1">Quản lý báo giá</span><ChevronRight className="h-3.5 w-3.5 opacity-60" /></>}
          </button>

          <button
            type="button"
            onClick={() => { onTabChange("home"); onMobileOpenChange(false); }}
            title={isCollapsed ? "Biên tập file" : undefined}
            className={itemClass(activeTab === "home")}
          >
            <FileText className="h-4 w-4 shrink-0" />
            {!isCollapsed && <><span className="flex-1">Biên tập file</span><ChevronRight className="h-3.5 w-3.5 opacity-60" /></>}
          </button>
        </nav>

        <div className={`mt-auto p-4 ${isCollapsed ? "px-3" : ""}`}>
          <div className={`rounded-xl border border-white/15 bg-white/10 p-3 ${isCollapsed ? "text-center" : ""}`}>
            <p className="text-[11px] text-blue-100">{isCollapsed ? "Chờ" : "Đang xử lý"}</p>
            <p className="mt-1 text-2xl font-bold">{pendingCount}</p>
            {!isCollapsed && <p className="text-[11px] text-blue-100">báo giá chờ cập nhật</p>}
          </div>

          <button
            type="button"
            onClick={onLogout}
            title="Đăng xuất"
            className={`mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-blue-50 transition-colors hover:bg-white/10 hover:text-white ${isCollapsed ? "justify-center" : ""}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header matching Admin */}
        <header className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-blue-100 bg-white px-4 shadow-[0_1px_4px_rgba(15,75,145,0.06)] sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onToggleNavigation}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-[#0b4f9c] transition-colors hover:bg-blue-100"
              aria-label="Đóng hoặc mở điều hướng"
              title="Đóng hoặc mở điều hướng"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0b4f9c] border border-blue-100/80">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b4f9c]">Không gian nhân viên</p>
                <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  {selectedProject?.name || "Kế Hoạch Thực Hiện Báo Giá"}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {selectedProject?.trangThai ? (
              <StatusBadge status={selectedProject.trangThai as TrangThai} />
            ) : (
              <span className="hidden sm:inline text-xs font-medium text-slate-500">Chưa chọn báo giá</span>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#0b4f9c] ring-offset-2 transition-colors hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                aria-label="Mở menu tài khoản"
                aria-expanded={isProfileMenuOpen}
              >
                {(username || "US").slice(0, 2).toUpperCase()}
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 top-11 z-50 w-48 rounded-lg border border-blue-100 bg-white p-1.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onProfile();
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-[#0b4f9c]"
                  >
                    <UserRound className="h-4 w-4" />
                    <span>Hồ sơ cá nhân</span>
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden flex flex-col">{children}</main>
      </div>
    </div>
  );
}

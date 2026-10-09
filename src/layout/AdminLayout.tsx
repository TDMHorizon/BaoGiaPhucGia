import {
  ChevronRight,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  RotateCcw,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import type { TrangThai } from "../lib/constants";

type AdminSidebarProps = {
  userRole?: string;
  mainTab: string;
  pendingCount: number;
  isMobileOpen: boolean;
  isCollapsed: boolean;
  isQuotesExpanded: boolean;
  isAccountsExpanded: boolean;
  selectedProject: unknown;
  onMainTabChange: (tab: string) => void;
  onMobileOpenChange: (open: boolean) => void;
  onQuotesExpandedChange: () => void;
  onAccountsExpandedChange: () => void;
  onProjectDialogOpen: () => void;
  onTemplateDialogOpen: () => void;
  onUserDialogOpen: () => void;
  onDeletedProjectsOpen: () => void;
  onLogout: () => void;
};

export function AdminSidebar({
  userRole,
  mainTab,
  pendingCount,
  isMobileOpen,
  isCollapsed,
  isQuotesExpanded,
  isAccountsExpanded,
  selectedProject,
  onMainTabChange,
  onMobileOpenChange,
  onQuotesExpandedChange,
  onAccountsExpandedChange,
  onProjectDialogOpen,
  onTemplateDialogOpen,
  onUserDialogOpen,
  onDeletedProjectsOpen,
  onLogout,
}: AdminSidebarProps) {
  const itemClass = (active: boolean) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-semibold transition-colors ${isCollapsed ? "justify-center" : ""} ${active ? "bg-white text-[#0b4f9c] shadow-sm" : "text-blue-50 hover:bg-white/10"}`;
  const childClass = "w-full rounded-md px-3 py-2 text-left text-sm font-medium text-blue-100 hover:bg-white/10 hover:text-white flex items-center gap-2";

  return (
    <aside className={`${isMobileOpen ? "fixed inset-y-0 left-0 z-50 flex shadow-2xl" : "hidden"} md:flex ${isCollapsed ? "md:w-[76px]" : "md:w-[248px]"} w-[248px] shrink-0 flex-col bg-[#0b4f9c] text-white border-r border-[#0a4384] transition-[width] duration-200`}>
      <div className={`h-[72px] px-4 flex items-center ${isCollapsed ? "justify-center" : "justify-between"} gap-3 border-b border-white/15`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-white text-[#0b4f9c] flex items-center justify-center font-black tracking-tight shadow-sm">PG</div>
          {!isCollapsed && <div className="min-w-0"><p className="text-sm font-bold truncate">Phúc Gia</p><p className="text-[11px] text-blue-100 truncate">Quản trị báo giá</p></div>}
        </div>
        <button type="button" onClick={() => onMobileOpenChange(false)} className="md:hidden h-8 w-8 shrink-0 rounded-lg text-blue-100 hover:bg-white/10 flex items-center justify-center" aria-label="Đóng điều hướng"><PanelLeftClose className="h-4 w-4" /></button>
      </div>
      {!isCollapsed && <div className="px-4 pt-6 pb-3 text-[10px] uppercase tracking-[0.16em] text-blue-200 font-bold">Không gian làm việc</div>}
      <nav className="px-3 space-y-1" aria-label="Điều hướng quản trị">
        <button type="button" onClick={() => { onMainTabChange("dashboard"); onMobileOpenChange(false); }} title={isCollapsed ? "Dashboard" : undefined} className={itemClass(mainTab === "dashboard")}><LayoutDashboard className="h-4 w-4 shrink-0" />{!isCollapsed && <><span className="flex-1">Dashboard</span><ChevronRight className="h-3.5 w-3.5 opacity-60" /></>}</button>
        <button type="button" onClick={() => { onMainTabChange("file"); onQuotesExpandedChange(); }} title={isCollapsed ? "Quản lý báo giá" : undefined} className={itemClass(mainTab === "file")}><FolderOpen className="h-4 w-4 shrink-0" />{!isCollapsed && <><span className="flex-1">Quản lý báo giá</span><ChevronRight className={`h-3.5 w-3.5 opacity-60 transition-transform ${isQuotesExpanded ? "rotate-90" : ""}`} /></>}</button>
        {!isCollapsed && isQuotesExpanded && <div className="ml-7 space-y-1 border-l border-white/20 pl-2">
          <button type="button" onClick={() => { onMainTabChange("file"); onProjectDialogOpen(); onMobileOpenChange(false); }} className={childClass}><FolderOpen className="h-4 w-4 shrink-0" /><span>Mở dự án</span></button>
          <button type="button" onClick={() => { onMainTabChange("file"); onTemplateDialogOpen(); onMobileOpenChange(false); }} className={childClass}><FileText className="h-4 w-4 shrink-0" /><span>Templates</span></button>
        </div>}
        <button type="button" onClick={() => { onMainTabChange("home"); onMobileOpenChange(false); }} disabled={!selectedProject} title={isCollapsed ? "Biên tập file" : undefined} className={`${itemClass(mainTab === "home")} disabled:opacity-40 disabled:cursor-not-allowed`}><FileText className="h-4 w-4 shrink-0" />{!isCollapsed && <><span className="flex-1">Biên tập file</span><ChevronRight className="h-3.5 w-3.5 opacity-60" /></>}</button>
        {userRole === "admin" && <>
          <button type="button" onClick={() => { onMainTabChange("admin"); onAccountsExpandedChange(); }} title={isCollapsed ? "Quản lý tài khoản" : undefined} className={itemClass(mainTab === "admin")}><ShieldCheck className="h-4 w-4 shrink-0" />{!isCollapsed && <><span className="flex-1">Quản lý tài khoản</span><ChevronRight className={`h-3.5 w-3.5 opacity-60 transition-transform ${isAccountsExpanded ? "rotate-90" : ""}`} /></>}</button>
          {!isCollapsed && isAccountsExpanded && <div className="ml-7 space-y-1 border-l border-white/20 pl-2"><button type="button" onClick={() => { onMainTabChange("admin"); onUserDialogOpen(); onMobileOpenChange(false); }} className={childClass}><Users className="h-4 w-4 shrink-0" /><span>Tài khoản</span></button><button type="button" onClick={() => { onMainTabChange("admin"); onDeletedProjectsOpen(); onMobileOpenChange(false); }} className={childClass}><RotateCcw className="h-4 w-4 shrink-0" /><span>Khôi phục file đã xóa</span></button></div>}
        </>}
      </nav>
      <div className={`mt-auto p-4 ${isCollapsed ? "px-3" : ""}`}>
        <div className={`rounded-xl border border-white/15 bg-white/10 p-3 ${isCollapsed ? "text-center" : ""}`}><p className="text-[11px] text-blue-100">{isCollapsed ? "Chờ" : "Đang xử lý"}</p><p className="mt-1 text-2xl font-bold">{pendingCount}</p>{!isCollapsed && <p className="text-[11px] text-blue-100">báo giá chờ cập nhật</p>}</div>
        <button type="button" onClick={onLogout} title="Đăng xuất" className={`mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-blue-50 transition-colors hover:bg-white/10 hover:text-white ${isCollapsed ? "justify-center" : ""}`}><LogOut className="h-4 w-4 shrink-0" />{!isCollapsed && <span>Đăng xuất</span>}</button>
      </div>
    </aside>
  );
}

type AdminHeaderProps = {
  selectedProject: { name?: string; trangThai?: TrangThai } | null;
  username?: string;
  onToggleNavigation: () => void;
  onLogout: () => void;
  onProfile?: () => void;
};

export function AdminHeader({ selectedProject, username, onToggleNavigation, onLogout, onProfile }: AdminHeaderProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  return (
    <header className="h-[72px] shrink-0 bg-white border-b border-blue-100 px-4 sm:px-6 flex items-center justify-between gap-4 shadow-[0_1px_4px_rgba(15,75,145,0.06)]">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleNavigation}
          className="h-9 w-9 rounded-lg border border-blue-100 bg-blue-50 flex items-center justify-center text-[#0b4f9c] hover:bg-blue-100 transition-colors"
          aria-label="Đóng hoặc mở điều hướng"
          title="Đóng hoặc mở điều hướng"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#0b4f9c] font-bold">Không gian quản trị</p>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
            {selectedProject?.name || "Tổng quan báo giá"}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {selectedProject ? (
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
            {(username || "AD").slice(0, 2).toUpperCase()}
          </button>
          {isProfileMenuOpen && (
            <div className="absolute right-0 top-11 z-50 w-48 rounded-lg border border-blue-100 bg-white p-1.5 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onProfile?.();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-[#0b4f9c]"
              >
                <UserRound className="h-4 w-4" />
                <span>Hồ sơ cá nhân</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

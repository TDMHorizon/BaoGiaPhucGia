import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { NAVIGATION_CONFIG, type Role } from "../config/navigation";
import {
  FiMenu,
  FiX,
  FiChevronDown,
  FiChevronRight,
  FiLogOut,
  FiUser,
  FiSidebar,
  FiShield,
  FiFolder,
} from "react-icons/fi";
import { RiBuilding4Line } from "react-icons/ri";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  title,
  subtitle,
  headerAction,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    management: true,
    "quotes-group": true,
    "user-quotes-group": true,
  });

  const currentRole: Role = (user?.role as Role) || "user";

  // Helper kiểm tra chính xác item có match route hiện tại hay không (tránh /quotes/trash kích hoạt nhầm /quotes)
  const isPathMatching = (targetPath: string, currentPath: string) => {
    const cleanCurrent = currentPath.split("?")[0].replace(/\/$/, "");
    const cleanTarget = targetPath.replace(/\/$/, "");
    if (cleanTarget === "/quotes") {
      return cleanCurrent === "/quotes";
    }
    return cleanCurrent === cleanTarget || cleanCurrent.startsWith(`${cleanTarget}/`);
  };

  // Auto-expand group if current route is within it
  useEffect(() => {
    NAVIGATION_CONFIG.forEach((group) => {
      if (group.children?.some((child) => isPathMatching(child.path, location.pathname))) {
        setExpandedGroups((prev) => ({ ...prev, [group.id]: true }));
      }
    });
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const roleLabels: Record<Role, string> = {
    admin: "Quản trị viên (Admin)",
    manager: "Kế toán / Quản lý",
    user: "Kỹ sư / Nhân viên",
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F0F7FF] text-[#0F172A] font-sans">
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-gradient-to-b from-[#0b4f9c] to-[#105CB3] text-white transition-all duration-300 md:static ${
          isMobileOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full md:translate-x-0"
        } ${isCollapsed ? "md:w-20" : "md:w-64"} shrink-0`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/15 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#105CB3] shadow-md font-bold text-lg">
              <RiBuilding4Line className="h-6 w-6" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-bold tracking-tight text-white leading-tight">
                  PHÚC GIA
                </span>
                <span className="text-[11px] text-blue-200 truncate">
                  Quản lý Báo giá Trắc địa
                </span>
              </div>
            )}
          </div>
          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="rounded-lg p-1.5 text-blue-200 hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Đóng menu"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* User Mini Info */}
        <div className={`border-b border-white/10 py-3 ${isCollapsed ? "px-2 text-center" : "px-4"}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-400/20 text-white border border-white/20 font-semibold text-xs">
              {user?.username?.slice(0, 2).toUpperCase() || "PG"}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {user?.fullName || user?.username}
                </p>
                <div className="flex items-center gap-1.5">
                  <FiShield className="h-3 w-3 text-blue-300 shrink-0" />
                  <p className="truncate text-[10px] text-blue-200 font-medium">
                    {roleLabels[currentRole]}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
          {NAVIGATION_CONFIG.filter((group) => group.roles.includes(currentRole)).map((group) => {
            const GroupIcon = group.icon;
            const hasChildren = group.children && group.children.length > 0;
            const filteredChildren = group.children?.filter((c) =>
              c.roles.includes(currentRole)
            );

            // Direct route item
            if (!hasChildren && group.path) {
              const isActive =
                group.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(group.path);

              return (
                <Link
                  key={group.id}
                  to={group.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white text-[#105CB3] shadow-sm"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  } ${isCollapsed ? "justify-center" : ""}`}
                  title={isCollapsed ? group.label : undefined}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>{group.label}</span>}
                </Link>
              );
            }

            // Group with children
            const isGroupExpanded = expandedGroups[group.id] ?? false;
            const isChildActive = filteredChildren?.some((c) =>
              isPathMatching(c.path, location.pathname)
            );

            return (
              <div key={group.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                    isChildActive
                      ? "bg-white/15 text-white"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  } ${isCollapsed ? "justify-center" : "justify-between"}`}
                  title={isCollapsed ? group.label : undefined}
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon className="h-4 w-4 shrink-0 text-blue-200" />
                    {!isCollapsed && <span>{group.label}</span>}
                  </div>
                  {!isCollapsed && (
                    <span>
                      {isGroupExpanded ? (
                        <FiChevronDown className="h-3.5 w-3.5 text-blue-300" />
                      ) : (
                        <FiChevronRight className="h-3.5 w-3.5 text-blue-300" />
                      )}
                    </span>
                  )}
                </button>

                {/* Submenu Children */}
                {!isCollapsed && isGroupExpanded && filteredChildren && (
                  <div className="ml-4 space-y-1 border-l border-white/20 pl-2">
                    {filteredChildren.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildCurrent = isPathMatching(child.path, location.pathname);

                      return (
                        <Link
                          key={child.id}
                          to={child.path}
                          onClick={() => setIsMobileOpen(false)}
                          className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-all ${
                            isChildCurrent
                              ? "bg-white text-[#105CB3] shadow-xs font-semibold"
                              : "text-blue-100 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{child.label}</span>
                          {child.badge && (
                            <span className="ml-auto rounded-full bg-blue-400/30 px-1.5 py-0.2 text-[10px] text-white">
                              {child.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-white/15 p-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-red-500/20 hover:text-red-200 transition-colors ${
                isCollapsed ? "w-full justify-center" : "flex-1"
              }`}
              title="Đăng xuất"
            >
              <FiLogOut className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Đăng xuất</span>}
            </button>

            {/* Collapse toggle (Desktop only) */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-blue-200 hover:bg-white/10 hover:text-white transition-colors"
              title={isCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            >
              <FiSidebar className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Layout */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-blue-100 bg-white px-4 md:px-6 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-[#105CB3] hover:bg-blue-100 md:hidden"
              aria-label="Mở menu"
            >
              <FiMenu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-base md:text-lg font-bold text-[#0F172A]">
                {title || "Hệ Thống Báo Giá Trắc Địa Phúc Gia"}
              </h1>
              {subtitle && (
                <p className="hidden sm:block truncate text-xs text-[#64748B]">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {headerAction}

            <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#105CB3] font-bold text-xs border border-blue-200">
                <FiUser className="h-4 w-4" />
              </div>
              <div className="text-left text-xs">
                <p className="font-semibold text-slate-800 leading-tight">
                  {user?.fullName || user?.username}
                </p>
                <p className="text-[10px] text-slate-500">{roleLabels[currentRole]}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Workspace Canvas */}
        <main className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

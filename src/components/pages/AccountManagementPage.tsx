import { ShieldCheck, UserCog, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AccountManagement } from "../AccountManagement";
import { useAuth } from "../../lib/auth";
import { ROUTES } from "../../router";
import { AdminHeader, AdminSidebar } from "../../layout/AdminLayout";
import { Button } from "../ui/button";

export function AccountManagementPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isQuotesExpanded, setIsQuotesExpanded] = useState(false);
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(true);

  if (user?.role !== "admin") return null;

  const goHome = () => navigate(ROUTES.home);

  return (
    <div className="flex min-h-screen bg-[#f4f8ff] text-slate-900">
      <AdminSidebar
        userRole={user.role}
        mainTab="admin"
        pendingCount={0}
        isMobileOpen={isMobileOpen}
        isCollapsed={isCollapsed}
        isQuotesExpanded={isQuotesExpanded}
        isAccountsExpanded={isAccountsExpanded}
        selectedProject={null}
        onMainTabChange={goHome}
        onMobileOpenChange={setIsMobileOpen}
        onQuotesExpandedChange={() => setIsQuotesExpanded((expanded) => !expanded)}
        onAccountsExpandedChange={() => setIsAccountsExpanded((expanded) => !expanded)}
        onProjectDialogOpen={goHome}
        onTemplateDialogOpen={goHome}
        onAccountManagement={() => undefined}
        onDeletedProjectsOpen={() => navigate(ROUTES.deletedProjects)}
        onLogout={logout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader
          selectedProject={null}
          username={user.username}
          canManageAccounts
          onToggleNavigation={() => {
            if (window.innerWidth >= 768) setIsCollapsed((collapsed) => !collapsed);
            else setIsMobileOpen(true);
          }}
          onAccountManagement={() => navigate(ROUTES.profile)}
          onLogout={logout}
        />

        <main className="min-w-0 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {/* Header trang */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-[#0b4f9c] shadow-xs">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b4f9c]">Hệ thống bảo mật</p>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#0b4f9c]">Admin Only</span>
                  </div>
                  <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Quản lý tài khoản</h1>
                  <p className="text-sm text-slate-500">Phân quyền vai trò và quản lý tài khoản người dùng trong hệ thống.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(ROUTES.profile)}
                  className="gap-2 rounded-xl text-slate-700 hover:text-[#0b4f9c] border-slate-200"
                >
                  <UserCog className="h-4 w-4 text-slate-500" />
                  <span>Hồ sơ cá nhân</span>
                </Button>
              </div>
            </div>

            {/* Component quản lý tài khoản */}
            <AccountManagement />
          </div>
        </main>
      </div>
    </div>
  );
}

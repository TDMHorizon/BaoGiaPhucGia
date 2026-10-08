import { KeyRound, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { ROUTES } from "../../router";
import { AdminHeader, AdminSidebar } from "../../layout/AdminLayout";
import { UserLayout } from "../../layout/UserLayout";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function UpdateProfile() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isQuotesExpanded, setIsQuotesExpanded] = useState(false);
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(true);

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const goHome = () => navigate(ROUTES.home);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextUsername = username.trim();
    if (!nextUsername) {
      toast.error("Tên đăng nhập không được để trống");
      return;
    }
    if (password && password.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    if (nextUsername === user.username && !password) {
      toast.info("Chưa có thay đổi để lưu");
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await api.updateUser(user.id, {
        username: nextUsername,
        ...(password ? { password } : {}),
      });
      login(updatedUser);
      setUsername(updatedUser.username);
      setPassword("");
      setConfirmPassword("");
      toast.success("Đã cập nhật hồ sơ cá nhân");
    } catch (error: any) {
      toast.error(error.message || "Cập nhật hồ sơ thất bại");
    } finally {
      setIsSaving(false);
    }
  };

  const profileContent = (
    <main className="min-w-0 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-7 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-[#0b4f9c]"><ShieldCheck className="h-6 w-6" /></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b4f9c]">Bảo mật tài khoản</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Chỉnh sửa hồ sơ cá nhân</h1><p className="mt-1 text-sm text-slate-500">Cập nhật thông tin đăng nhập của tài khoản {isAdmin ? "quản trị" : "nhân viên"}.</p></div></div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4"><h2 className="text-sm font-bold text-slate-800">Thông tin đăng nhập</h2><p className="mt-1 text-xs text-slate-500">Mật khẩu mới có thể để trống nếu bạn không muốn thay đổi.</p></div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 p-5 sm:p-7 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-700">Tên đăng nhập<Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" disabled={isSaving} /></label>
            <div className="hidden md:block" />
            <label className="space-y-2 text-sm font-semibold text-slate-700">Mật khẩu mới<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Tối thiểu 6 ký tự" disabled={isSaving} /></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">Xác nhận mật khẩu mới<Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" disabled={isSaving} /></label>
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center md:col-span-2"><Button type="submit" disabled={isSaving} className="gap-2 bg-[#0b4f9c] hover:bg-[#083f7d]"><Save className="h-4 w-4" />{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</Button><span className="flex items-center gap-1 text-xs text-slate-500"><KeyRound className="h-3.5 w-3.5" />Thông tin được cập nhật bảo mật.</span></div>
          </form>
        </section>
        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900"><strong>Tài khoản hiện tại:</strong> {user.username} · {isAdmin ? "Quản trị viên" : "Nhân viên"}</div>
      </div>
    </main>
  );

  if (!isAdmin) {
    return <UserLayout username={user.username} activeTab="dashboard" isMobileOpen={isMobileOpen} isCollapsed={isCollapsed} onTabChange={goHome} onMobileOpenChange={setIsMobileOpen} onToggleNavigation={() => { if (window.innerWidth >= 768) setIsCollapsed((collapsed) => !collapsed); else setIsMobileOpen(true); }} onProfile={() => navigate(ROUTES.profile)} onLogout={logout}>{profileContent}</UserLayout>;
  }

  return (
    <div className="flex min-h-screen bg-[#f4f8ff] text-slate-900">
      <AdminSidebar userRole={user.role} mainTab="admin" pendingCount={0} isMobileOpen={isMobileOpen} isCollapsed={isCollapsed} isQuotesExpanded={isQuotesExpanded} isAccountsExpanded={isAccountsExpanded} selectedProject={null} onMainTabChange={goHome} onMobileOpenChange={setIsMobileOpen} onQuotesExpandedChange={() => setIsQuotesExpanded((expanded) => !expanded)} onAccountsExpandedChange={() => setIsAccountsExpanded((expanded) => !expanded)} onProjectDialogOpen={goHome} onTemplateDialogOpen={goHome} onAccountManagement={() => navigate(ROUTES.accountManagement)} onDeletedProjectsOpen={() => navigate(ROUTES.deletedProjects)} onLogout={logout} />
      <div className="flex min-w-0 flex-1 flex-col"><AdminHeader selectedProject={null} username={user.username} canManageAccounts onToggleNavigation={() => { if (window.innerWidth >= 768) setIsCollapsed((collapsed) => !collapsed); else setIsMobileOpen(true); }} onAccountManagement={() => navigate(ROUTES.profile)} onLogout={logout} />{profileContent}</div>
    </div>
  );
}

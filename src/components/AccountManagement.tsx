import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UnlockKeyhole,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export type UserRole = "admin" | "manager" | "user";
export type AdminUser = { id: string; username: string; role: UserRole; active: boolean };

const PAGE_SIZE = 8;

export const roleLabels: Record<UserRole | "all", string> = {
  all: "Tất cả vai trò",
  admin: "Quản trị viên",
  manager: "Quản lý",
  user: "Nhân viên",
};

export const roleDescriptions: Record<UserRole, string> = {
  admin: "Toàn quyền hệ thống, quản lý tài khoản & cài đặt",
  manager: "Quản lý báo giá, xem duyệt & kho file đã xóa",
  user: "Xem và cập nhật các bảng báo giá được giao",
};

export function roleBadgeClass(role: UserRole) {
  if (role === "admin") return "bg-indigo-50 text-indigo-700 border-indigo-200 ring-indigo-200";
  if (role === "manager") return "bg-amber-50 text-amber-700 border-amber-200 ring-amber-200";
  return "bg-sky-50 text-sky-700 border-sky-200 ring-sky-200";
}

export function AccountManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("user");
  const [formActive, setFormActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const { user: currentUser, login } = useAuth();

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      setUsers(await api.getUsers());
    } catch (error: any) {
      toast.error(error.message || "Không tải được danh sách người dùng");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === "admin").length;
    const managers = users.filter((u) => u.role === "manager").length;
    const regularUsers = users.filter((u) => u.role === "user").length;
    const active = users.filter((u) => u.active).length;
    return { total, admins, managers, regularUsers, active };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !query || user.username.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [roleFilter, searchTerm, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const updateSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const updateRole = (value: UserRole | "all") => {
    setRoleFilter(value);
    setPage(1);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormUsername("");
    setFormPassword("");
    setFormRole("user");
    setFormActive(true);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword("");
    setFormRole(user.role);
    setFormActive(user.active);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormUsername("");
    setFormPassword("");
    setFormRole("user");
    setFormActive(true);
    setShowPassword(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanUsername = formUsername.trim();

    if (!cleanUsername) {
      toast.error("Vui lòng nhập tên đăng nhập");
      return;
    }

    if (!editingUser && !formPassword.trim()) {
      toast.error("Vui lòng nhập mật khẩu cho tài khoản mới");
      return;
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        const payload: Record<string, unknown> = {
          username: cleanUsername,
          role: formRole,
          active: formActive,
        };
        if (formPassword.trim()) {
          payload.password = formPassword.trim();
        }

        const updatedUser = await api.updateUser(editingUser.id, payload);
        setUsers((current) =>
          current.map((item) => (item.id === editingUser.id ? updatedUser : item))
        );

        if (currentUser?.id === editingUser.id) {
          login(updatedUser);
        }
        toast.success(`Đã cập nhật tài khoản ${cleanUsername}`);
      } else {
        const newUser = await api.createUser({
          username: cleanUsername,
          password: formPassword.trim(),
          role: formRole,
        });
        setUsers((current) => [...current, newUser]);
        toast.success(`Đã tạo tài khoản ${cleanUsername} thành công`);
        await loadUsers();
      }
      closeModal();
    } catch (error: any) {
      toast.error(error.message || (editingUser ? "Cập nhật tài khoản thất bại" : "Tạo tài khoản thất bại"));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (user: AdminUser) => {
    try {
      const updated = await api.updateUser(user.id, { active: !user.active });
      setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
      toast.success(updated.active ? `Đã mở khóa tài khoản ${user.username}` : `Đã khóa tài khoản ${user.username}`);
    } catch (error: any) {
      toast.error(error.message || "Cập nhật tài khoản thất bại");
    }
  };

  const deleteUser = async (user: AdminUser) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${user.username}"?`)) return;
    try {
      await api.deleteUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      toast.success(`Đã xóa tài khoản ${user.username}`);
    } catch (error: any) {
      toast.error(error.message || "Xóa tài khoản thất bại");
    }
  };

  return (
    <div className="space-y-5">
      {/* Thẻ thống kê tổng quan */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#0b4f9c]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số</p>
              <p className="text-xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Quản trị</p>
              <p className="text-xl font-bold text-indigo-950">{stats.admins}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Quản lý</p>
              <p className="text-xl font-bold text-amber-950">{stats.managers}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider">Nhân viên</p>
              <p className="text-xl font-bold text-sky-950">{stats.regularUsers}</p>
            </div>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Đang hoạt động</p>
              <p className="text-xl font-bold text-emerald-950">{stats.active} / {stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bảng danh sách tài khoản */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
        {/* Header danh sách */}
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b4f9c]">Danh bạ người dùng</p>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-[#0b4f9c]">
                {filteredUsers.length} tài khoản
              </span>
            </div>
            <h2 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Tài khoản hệ thống
            </h2>
          </div>

          <Button
            type="button"
            onClick={openCreateModal}
            className="gap-2 bg-[#0b4f9c] hover:bg-[#083f7d] shadow-sm shadow-blue-500/20 text-sm font-semibold h-10 px-4 rounded-xl"
          >
            <UserPlus className="h-4 w-4" />
            <span>Tạo tài khoản mới</span>
          </Button>
        </div>

        {/* Thanh tìm kiếm & Bộ lọc */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Tìm kiếm tài khoản theo tên đăng nhập..."
              className="h-10 pl-9 pr-8 rounded-xl border-slate-200"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => updateSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Xóa tìm kiếm"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>

          <select
            value={roleFilter}
            onChange={(event) => updateRole(event.target.value as UserRole | "all")}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-xs focus:border-[#0b4f9c] focus:outline-none focus:ring-2 focus:ring-[#0b4f9c]/20 sm:w-52"
          >
            {(Object.keys(roleLabels) as Array<UserRole | "all">).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </div>

        {/* Danh sách người dùng Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Người dùng</th>
                <th className="px-5 py-3.5">Vai trò & Quyền hạn</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-14 text-center text-sm text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0b4f9c] border-t-transparent" />
                      <span>Đang tải danh sách tài khoản...</span>
                    </div>
                  </td>
                </tr>
              ) : visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-14 text-center text-sm text-slate-500">
                    <UserRound className="mx-auto h-8 w-8 text-slate-300 mb-1.5" />
                    Không tìm thấy tài khoản phù hợp với tìm kiếm.
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user) => {
                  const isCurrent = currentUser?.id === user.id;
                  return (
                    <tr key={user.id} className="transition-colors hover:bg-blue-50/30">
                      {/* Cột tên người dùng */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-xs ${
                              user.role === "admin"
                                ? "bg-indigo-100 text-indigo-700"
                                : user.role === "manager"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-sky-100 text-sky-700"
                            }`}
                          >
                            {user.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{user.username}</span>
                              {isCurrent && (
                                <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-[#0b4f9c]">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">ID: {user.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>

                      {/* Cột vai trò */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${roleBadgeClass(
                            user.role
                          )}`}
                        >
                          {user.role === "admin" ? (
                            <ShieldAlert className="h-3.5 w-3.5" />
                          ) : user.role === "manager" ? (
                            <Briefcase className="h-3.5 w-3.5" />
                          ) : (
                            <Shield className="h-3.5 w-3.5" />
                          )}
                          {roleLabels[user.role]}
                        </span>
                        <p className="mt-1 text-[11px] text-slate-500 hidden sm:block">
                          {roleDescriptions[user.role]}
                        </p>
                      </td>

                      {/* Cột trạng thái */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            user.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              user.active ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {user.active ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </td>

                      {/* Cột thao tác */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActive(user)}
                            disabled={isCurrent}
                            className={`h-8 w-8 rounded-lg text-slate-400 ${
                              user.active
                                ? "hover:bg-amber-50 hover:text-amber-600"
                                : "hover:bg-emerald-50 hover:text-emerald-600"
                            } disabled:cursor-not-allowed disabled:opacity-30`}
                            aria-label={user.active ? `Khóa ${user.username}` : `Mở khóa ${user.username}`}
                            title={
                              isCurrent
                                ? "Không thể khóa tài khoản đang đăng nhập"
                                : user.active
                                ? "Khóa tài khoản"
                                : "Mở khóa tài khoản"
                            }
                          >
                            {user.active ? (
                              <LockKeyhole className="h-4 w-4" />
                            ) : (
                              <UnlockKeyhole className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(user)}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-[#0b4f9c]"
                            aria-label={`Sửa tài khoản ${user.username}`}
                            title="Sửa thông tin tài khoản"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteUser(user)}
                            disabled={user.role === "admin" || isCurrent}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                            aria-label={`Xóa tài khoản ${user.username}`}
                            title={
                              user.role === "admin"
                                ? "Không thể xóa quản trị viên"
                                : isCurrent
                                ? "Không thể xóa tài khoản hiện tại"
                                : "Xóa tài khoản"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
          <span>
            Trang <strong>{currentPage}</strong> / {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              aria-label="Trang trước"
              className="rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              aria-label="Trang sau"
              className="rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* MODAL TẠO MỚI / CHỈNH SỬA TÀI KHOẢN (Thiết kế hiện đại, tùy biến cao) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-modal-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100 transition-all duration-200"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-blue-50/60 to-slate-50 px-6 py-5">
              <div className="flex items-center gap-3.5">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ${
                    editingUser
                      ? "bg-[#0b4f9c] text-white"
                      : "bg-[#0b4f9c] text-white"
                  }`}
                >
                  {editingUser ? <UserCog className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
                </div>
                <div>
                  <h3 id="user-modal-title" className="text-lg font-bold text-slate-900">
                    {editingUser ? `Chỉnh sửa tài khoản` : "Tạo tài khoản mới"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingUser
                      ? `Cập nhật thông tin và phân quyền cho ${editingUser.username}`
                      : "Thiết lập quyền truy cập cho thành viên mới vào hệ thống"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                aria-label="Đóng cửa sổ"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Tên đăng nhập */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700">
                  <span>
                    Tên đăng nhập <span className="text-rose-500">*</span>
                  </span>
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="VD: nguyenvan_a"
                    autoComplete="username"
                    disabled={isSaving}
                    autoFocus
                    className="h-10 pl-10 rounded-xl border-slate-200 focus:border-[#0b4f9c] focus:ring-[#0b4f9c]/20"
                  />
                </div>
              </div>

              {/* Mật khẩu */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Mật khẩu {editingUser ? "" : <span className="text-rose-500">*</span>}
                  </label>
                  {editingUser && (
                    <span className="text-[11px] text-slate-400 italic">
                      (Bỏ trống nếu giữ nguyên mật khẩu cũ)
                    </span>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? "•••••••• (Giữ nguyên mật khẩu)" : "Nhập mật khẩu..."}
                    autoComplete={editingUser ? "new-password" : "current-password"}
                    disabled={isSaving}
                    className="h-10 pl-10 pr-10 rounded-xl border-slate-200 focus:border-[#0b4f9c] focus:ring-[#0b4f9c]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Chọn vai trò (Card selector hiện đại) */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Vai trò người dùng <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {/* Option: Nhân viên */}
                  <button
                    type="button"
                    onClick={() => setFormRole("user")}
                    disabled={isSaving}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      formRole === "user"
                        ? "border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700">
                        <User className="h-3.5 w-3.5" />
                        <span>Nhân viên</span>
                      </div>
                      {formRole === "user" && <Check className="h-4 w-4 text-sky-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      Xem & sửa báo giá
                    </span>
                  </button>

                  {/* Option: Quản lý */}
                  <button
                    type="button"
                    onClick={() => setFormRole("manager")}
                    disabled={isSaving}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      formRole === "manager"
                        ? "border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>Quản lý</span>
                      </div>
                      {formRole === "manager" && <Check className="h-4 w-4 text-amber-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      Duyệt & file đã xóa
                    </span>
                  </button>

                  {/* Option: Quản trị viên */}
                  <button
                    type="button"
                    onClick={() => setFormRole("admin")}
                    disabled={isSaving}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      formRole === "admin"
                        ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>Quản trị viên</span>
                      </div>
                      {formRole === "admin" && <Check className="h-4 w-4 text-indigo-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      Toàn quyền hệ thống
                    </span>
                  </button>
                </div>
              </div>

              {/* Trạng thái tài khoản (Khi sửa) */}
              {editingUser && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Trạng thái tài khoản</p>
                    <p className="text-[11px] text-slate-500">
                      {formActive ? "Cho phép đăng nhập và sử dụng hệ thống" : "Khóa đăng nhập của tài khoản này"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormActive((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formActive ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                    role="switch"
                    aria-checked={formActive}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        formActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="rounded-xl h-10 px-4 text-slate-600"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl h-10 px-5 gap-2 bg-[#0b4f9c] hover:bg-[#083f7d] shadow-sm shadow-blue-500/20 text-white font-semibold"
                >
                  {isSaving ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>{editingUser ? "Cập nhật tài khoản" : "Tạo tài khoản"}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

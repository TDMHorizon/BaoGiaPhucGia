import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { toast } from "sonner";
import { Shield, User, UserCheck, KeyRound, Trash2, Edit2, Lock, Unlock } from "lucide-react";

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "manager" | "admin">("user");
  const [loading, setLoading] = useState(false);

  // Edit user dialog state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"user" | "manager" | "admin">("user");
  const [editPassword, setEditPassword] = useState("");

  const load = async () => {
    try {
      setUsers(await api.getUsers());
    } catch (e: any) {
      toast.error(e.message || "Không tải được danh sách người dùng");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!username.trim() || !password) {
      toast.error("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu");
      return;
    }
    setLoading(true);
    try {
      await api.createUser({
        username: username.trim(),
        password,
        role,
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
      } as any);
      setUsername("");
      setPassword("");
      setFullName("");
      setEmail("");
      setRole("user");
      toast.success("Đã tạo tài khoản thành công");
      load();
    } catch (e: any) {
      toast.error(e.message || "Tạo tài khoản thất bại");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (u: any) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditFullName(u.fullName || "");
    setEditEmail(u.email || "");
    setEditRole(u.role);
    setEditPassword("");
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    try {
      const payload: any = {
        username: editUsername.trim(),
        role: editRole,
        fullName: editFullName.trim() || null,
        email: editEmail.trim() || null,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      await api.updateUser(editingUser.id, payload);
      toast.success("Đã cập nhật thông tin tài khoản");
      setEditingUser(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Cập nhật thất bại");
    }
  };

  const toggleActive = async (u: any) => {
    try {
      await api.updateUser(u.id, { active: !u.active });
      toast.success(u.active ? "Đã khóa tài khoản thành công" : "Đã mở khóa tài khoản");
      load();
    } catch (e: any) {
      toast.error(e.message || "Cập nhật trạng thái thất bại");
    }
  };

  const resetPassword = async (u: any) => {
    const pwd = prompt(`Nhập mật khẩu mới cho ${u.username}:`);
    if (!pwd || !pwd.trim()) return;
    try {
      await api.updateUser(u.id, { password: pwd.trim() });
      toast.success(`Đã đổi mật khẩu cho ${u.username}. Các phiên đăng nhập cũ đã được thu hồi.`);
    } catch (e: any) {
      toast.error(e.message || "Đổi mật khẩu thất bại");
    }
  };

  const handleDelete = async (u: any) => {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản "${u.username}"?`)) return;
    try {
      await api.deleteUser(u.id);
      toast.success("Đã xóa tài khoản thành công");
      load();
    } catch (e: any) {
      toast.error(e.message || "Xóa thất bại");
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case "admin":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"><Shield className="w-3 h-3 text-rose-600" /> Quản trị viên (Admin)</span>;
      case "manager":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"><UserCheck className="w-3 h-3 text-amber-600" /> Kế toán / Quản lý (Manager)</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200"><User className="w-3 h-3 text-sky-600" /> Nhân viên (User)</span>;
    }
  };

  return (
    <Card className="shadow-sm border border-slate-200">
      <CardHeader className="pb-3 border-b bg-slate-50/70">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            Quản trị người dùng & Phân quyền hệ thống (UC19)
          </CardTitle>
          <span className="text-xs text-slate-500 font-normal">
            Tổng cộng: <strong className="text-slate-800">{users.length}</strong> tài khoản
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Form thêm tài khoản mới */}
        <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200 space-y-2">
          <div className="text-xs font-semibold text-slate-700">Thêm tài khoản mới</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
            <div>
              <label className="text-[10px] text-slate-500 font-medium">Tên đăng nhập *</label>
              <Input placeholder="vd: ketoan_phucgia" value={username} onChange={(e) => setUsername(e.target.value)} className="h-8 text-xs bg-white" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium">Mật khẩu *</label>
              <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-8 text-xs bg-white" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium">Họ và tên</label>
              <Input placeholder="vd: Nguyễn Văn A" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-8 text-xs bg-white" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium">Vai trò hệ thống</label>
              <select
                className="w-full h-8 text-xs border border-slate-300 rounded-md px-2 bg-white font-medium"
                value={role}
                onChange={(e) => setRole(e.target.value as "user" | "manager" | "admin")}
              >
                <option value="user">Nhân viên (User)</option>
                <option value="manager">Kế toán / Quản lý (Manager)</option>
                <option value="admin">Quản trị viên (Admin)</option>
              </select>
            </div>
            <Button className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 font-medium text-white shadow-sm" disabled={loading} onClick={handleCreate}>
              {loading ? "Đang tạo..." : "+ Thêm tài khoản"}
            </Button>
          </div>
        </div>

        {/* Danh sách người dùng */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-700">Tên đăng nhập / Họ tên</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Vai trò</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Trạng thái</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="text-xs py-2.5">
                    <div className="font-semibold text-slate-900">{u.username}</div>
                    {u.fullName && <div className="text-[11px] text-slate-500">{u.fullName}</div>}
                  </TableCell>
                  <TableCell className="text-xs py-2.5">
                    {getRoleBadge(u.role)}
                  </TableCell>
                  <TableCell className="text-xs py-2.5">
                    {u.active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Đã khóa
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1 py-2.5">
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => openEditModal(u)}>
                      <Edit2 className="w-3 h-3 mr-1" /> Sửa
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 text-slate-700 hover:text-amber-600 hover:bg-amber-50" onClick={() => resetPassword(u)}>
                      <KeyRound className="w-3 h-3 mr-1" /> Đổi MK
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-7 text-[11px] px-2 ${u.active ? "text-amber-700 hover:bg-amber-50" : "text-emerald-700 hover:bg-emerald-50"}`}
                      onClick={() => toggleActive(u)}
                    >
                      {u.active ? <><Lock className="w-3 h-3 mr-1" /> Khóa</> : <><Unlock className="w-3 h-3 mr-1" /> Mở</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                      onClick={() => handleDelete(u)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Xóa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Dialog Sửa Tài Khoản */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                Cập nhật tài khoản: {editingUser.username}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-600 font-medium">Tên đăng nhập</label>
                <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 font-medium">Họ và tên</label>
                <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 font-medium">Email</label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 font-medium">Vai trò</label>
                <select
                  className="w-full h-8 text-xs border border-slate-300 rounded-md px-2 mt-1 bg-white"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                >
                  <option value="user">Nhân viên (User)</option>
                  <option value="manager">Kế toán / Quản lý (Manager)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-600 font-medium">Mật khẩu mới (để trống nếu không đổi)</label>
                <Input type="password" placeholder="Nhập mật khẩu mới..." value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditingUser(null)}>
                Hủy
              </Button>
              <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSaveEdit}>
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

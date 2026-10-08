import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { toast } from "sonner";

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "manager" | "admin">("user");

  const load = async () => {
    try {
      setUsers(await api.getUsers());
    } catch (e: any) {
      toast.error(e.message || "Không tải được danh sách user");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!username.trim() || !password) {
      toast.error("Nhập đủ tên đăng nhập và mật khẩu");
      return;
    }
    try {
      await api.createUser({ username: username.trim(), password, role });
      setUsername("");
      setPassword("");
      setRole("user");
      toast.success("Đã tạo tài khoản");
      load();
    } catch (e: any) {
      toast.error(e.message || "Tạo thất bại");
    }
  };

  const toggleActive = async (u: any) => {
    try {
      await api.updateUser(u.id, { active: !u.active });
      toast.success(u.active ? "Đã khóa tài khoản" : "Đã mở khóa");
      load();
    } catch (e: any) {
      toast.error(e.message || "Cập nhật thất bại");
    }
  };

  const resetPassword = async (u: any) => {
    const pwd = prompt(`Mật khẩu mới cho ${u.username}:`);
    if (!pwd) return;
    try {
      await api.updateUser(u.id, { password: pwd });
      toast.success("Đã đổi mật khẩu");
    } catch (e: any) {
      toast.error(e.message || "Đổi mật khẩu thất bại");
    }
  };

  const handleDelete = async (u: any) => {
    if (!confirm(`Xóa tài khoản ${u.username}?`)) return;
    try {
      await api.deleteUser(u.id);
      toast.success("Đã xóa");
      load();
    } catch (e: any) {
      toast.error(e.message || "Xóa thất bại");
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b bg-slate-50/50">
        <CardTitle className="text-sm font-bold">Quản lý tài khoản</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <Input placeholder="Tên đăng nhập" value={username} onChange={(e) => setUsername(e.target.value)} className="h-8 text-xs" />
          <Input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} className="h-8 text-xs" />
          <select
            className="h-8 text-xs border border-slate-200 rounded-md px-2"
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "manager" | "admin")}
          >
            <option value="user">Nhân viên</option>
            <option value="manager">Quản lý</option>
            <option value="admin">Quản trị</option>
          </select>
          <Button className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleCreate}>
            Thêm tài khoản
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tên</TableHead>
                <TableHead className="text-xs">Vai trò</TableHead>
                <TableHead className="text-xs">Trạng thái</TableHead>
                <TableHead className="text-xs text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-xs font-semibold">{u.username}</TableCell>
                  <TableCell className="text-xs">{u.role === "manager" ? "Quản lý" : u.role === "admin" ? "Quản trị" : "Nhân viên"}</TableCell>
                  <TableCell className="text-xs">{u.active ? "Hoạt động" : "Đã khóa"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {u.role !== "admin" && (
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => toggleActive(u)}>
                        {u.active ? "Khóa" : "Mở"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => resetPassword(u)}>
                      Đổi MK
                    </Button>
                    {u.role !== "admin" && (
                      <Button size="sm" variant="outline" className="h-7 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(u)}>
                        Xóa
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

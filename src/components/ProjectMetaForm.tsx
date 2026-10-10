import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { MemberPermissionsModal } from "./MemberPermissionsModal";

type Props = {
  project: any;
  onUpdated: (project: any) => void;
  onDeleted?: () => void;
};

export function ProjectMetaForm({ project, onUpdated, onDeleted }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [name, setName] = useState(project.name || "");
  const [soBaoGia, setSoBaoGia] = useState(project.soBaoGia || "");
  const [tenKhachHang, setTenKhachHang] = useState(project.tenKhachHang || "");
  const [ghiChu, setGhiChu] = useState(project.ghiChu || "");
  const [nguoiPhuTrachId, setNguoiPhuTrachId] = useState(project.nguoiPhuTrachId || "");
  const [memberIds, setMemberIds] = useState<string[]>(project.memberIds || []);
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(project.name || "");
    setSoBaoGia(project.soBaoGia || "");
    setTenKhachHang(project.tenKhachHang || "");
    setGhiChu(project.ghiChu || "");
    setNguoiPhuTrachId(project.nguoiPhuTrachId || "");
    setMemberIds(project.memberIds || []);
  }, [project.id, project.updatedAt]);

  useEffect(() => {
    api.getActiveUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const toggleMember = (id: string) => {
    if (!isAdmin) {
      toast.error("Chỉ Quản trị viên (Admin) mới có quyền thay đổi phân công nhân sự.");
      return;
    }
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let updated = await api.updateProject(project.id, {
        name: name.trim(),
        soBaoGia: soBaoGia.trim(),
        tenKhachHang: tenKhachHang.trim(),
        ghiChu: ghiChu.trim(),
        nguoiPhuTrachId: nguoiPhuTrachId || null,
      });

      // UC07: Admin phân công nhiều người làm qua route chuyên biệt PUT /api/projects/:id/members
      if (isAdmin) {
        await api.updateProjectMembers(project.id, {
          memberIds,
          nguoiPhuTrachId: nguoiPhuTrachId || null,
        });
        updated = { ...updated, memberIds, nguoiPhuTrachId: nguoiPhuTrachId || null };
      }

      onUpdated(updated);
      toast.success("Đã lưu thông tin báo giá");
    } catch (e: any) {
      toast.error(e.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Xóa báo giá "${project.name}"? Thao tác không hoàn tác.`)) return;
    try {
      await api.deleteProject(project.id);
      toast.success("Đã xóa báo giá");
      onDeleted?.();
    } catch (e: any) {
      toast.error(e.message || "Xóa thất bại");
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
      <h4 className="text-sm font-bold text-slate-900">Thông tin báo giá</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tên báo giá</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Số báo giá</Label>
          <Input value={soBaoGia} onChange={(e) => setSoBaoGia(e.target.value)} className="h-8 text-xs" placeholder="BG-2026-001" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Khách hàng</Label>
          <Input value={tenKhachHang} onChange={(e) => setTenKhachHang(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Người phụ trách chính</Label>
          <select
            className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white"
            value={nguoiPhuTrachId}
            onChange={(e) => setNguoiPhuTrachId(e.target.value)}
          >
            <option value="">— Chưa gán —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Ghi chú</Label>
          <Input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">
              Thành viên được gán (UC07) {!isAdmin && <span className="text-[10px] text-amber-600 font-normal">(Chỉ Quản trị viên mới được đổi phân công)</span>}
            </Label>
            {memberIds.length > 0 && isAdmin && (
              <MemberPermissionsModal
                projectId={project.id}
                sheets={project.sheets || []}
                members={users.filter((u) => memberIds.includes(u.id))}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {users.map((u) => (
              <label key={u.id} className={`flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1 ${isAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-75"}`}>
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={memberIds.includes(u.id)}
                  onChange={() => toggleMember(u.id)}
                />
                {u.username}
              </label>
            ))}
            {users.length === 0 && <span className="text-xs text-slate-400">Chưa có nhân viên</span>}
          </div>
        </div>
      </div>
      <div className="flex justify-between pt-2 border-t border-slate-100">
        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs" onClick={handleDelete}>
          Xóa báo giá
        </Button>
        <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700" disabled={saving} onClick={handleSave}>
          {saving ? "Đang lưu..." : "Lưu thông tin"}
        </Button>
      </div>
    </div>
  );
}

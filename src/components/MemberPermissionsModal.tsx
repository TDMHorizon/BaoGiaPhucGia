import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ShieldCheck, UserCheck } from "lucide-react";

type Props = {
  projectId: string;
  sheets: string[];
  members: any[]; // danh sách user object đã gán vào project
};

export function MemberPermissionsModal({ projectId, sheets, members }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [customRanges, setCustomRanges] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [allPermissions, setAllPermissions] = useState<any[]>([]);

  useEffect(() => {
    if (members.length > 0 && !selectedUserId) {
      setSelectedUserId(members[0].id);
    }
  }, [members, selectedUserId]);

  useEffect(() => {
    if (!open || !projectId) return;
    loadAllPerms();
  }, [open, projectId]);

  useEffect(() => {
    if (!selectedUserId) {
      setCustomRanges({});
      return;
    }
    const map: Record<string, string> = {};
    allPermissions
      .filter((p: any) => p.userId === selectedUserId)
      .forEach((p: any) => {
        map[p.sheetName] = p.editableRanges;
      });
    setCustomRanges(map);
  }, [selectedUserId, allPermissions]);

  const loadAllPerms = async () => {
    setLoading(true);
    try {
      const data = await api.getMemberPermissions(projectId);
      setAllPermissions(Array.isArray(data) ? data : []);
    } catch {
      setAllPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      // Giữ lại permissions của các user khác
      const otherPerms = allPermissions.filter((p: any) => p.userId !== selectedUserId);
      // Tạo permissions mới cho user hiện tại
      const currentUserPerms = Object.entries(customRanges)
        .filter(([_, ranges]) => typeof ranges === "string" && ranges.trim().length > 0)
        .map(([sheetName, editableRanges]) => ({
          userId: selectedUserId,
          sheetName,
          editableRanges: String(editableRanges).trim(),
        }));

      const newPerms = [...otherPerms, ...currentUserPerms];
      await api.setMemberPermissions(projectId, newPerms);
      setAllPermissions(newPerms);
      toast.success("Đã lưu phạm vi sửa ô riêng cho nhân viên");
    } catch (e: any) {
      toast.error(e.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = members.find((m) => m.id === selectedUserId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5" />}>
        <ShieldCheck className="w-3.5 h-3.5" />
        Phân quyền ô riêng từng nhân viên
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            Cấu hình vùng ô riêng theo từng nhân viên (Chương 11)
          </DialogTitle>
        </DialogHeader>

        {members.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Dự án này chưa được gán thành viên nhân viên nào. Hãy gán nhân viên vào dự án trước.
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Chọn nhân viên áp dụng</Label>
              <select
                className="w-full mt-1 h-8 text-xs border border-slate-200 rounded-md px-2 bg-white"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName ? `${m.fullName} (${m.username})` : m.username} - {m.role}
                  </option>
                ))}
              </select>
            </div>

            <div className="border border-slate-100 rounded-lg p-3 bg-slate-50 space-y-2">
              <div className="text-[11px] text-slate-500 mb-1 leading-relaxed">
                Định dạng: <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-indigo-600">E14:E30, G14:I30</code>.
                Nếu để trống ở sheet nào, nhân viên sẽ dùng vùng mặc định của dự án (hoặc bị cấm nếu dự án không cấp).
              </div>

              {loading ? (
                <div className="py-4 text-center text-xs text-slate-400">Đang tải cấu hình...</div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {sheets.map((s) => (
                    <div key={s} className="grid grid-cols-3 gap-2 items-center bg-white p-2 rounded border border-slate-200">
                      <span className="text-xs font-medium text-slate-700 truncate" title={s}>
                        {s}
                      </span>
                      <Input
                        className="col-span-2 h-7 text-xs font-mono"
                        placeholder="VD: E10:E30 hoặc E:E"
                        value={customRanges[s] || ""}
                        onChange={(e) =>
                          setCustomRanges((prev) => ({
                            ...prev,
                            [s]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-8 text-xs">
                Đóng
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
                disabled={saving || loading || !selectedUserId}
                onClick={handleSave}
              >
                {saving ? "Đang lưu..." : `Lưu quyền cho ${selectedUser?.username || "nhân viên"}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

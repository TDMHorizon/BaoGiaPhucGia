import { Clock3, FileSpreadsheet, FolderOpen, History, Upload, Users } from "lucide-react";
import { StatusBadge } from "../StatusBadge";
import type { TrangThai } from "../../lib/constants";

type AdminProject = {
  id: string;
  name: string;
  trangThai?: TrangThai;
  soBaoGia?: string;
  updatedAt?: string;
  createdAt?: string;
};

type AdminEdit = {
  username?: string;
  cell?: string;
  sheetName?: string;
  oldValue?: string;
  newValue?: string;
  timestamp?: string;
};

type AdminHomeProps = {
  projects: AdminProject[];
  edits: AdminEdit[];
  pendingCount: number;
  selectedProject: AdminProject | null;
  onUploadFile: (file: File) => void;
  onSelectProject: (id: string) => void;
};

function formatDate(value?: string) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AdminHome({ projects, edits, pendingCount, selectedProject, onUploadFile, onSelectProject }: AdminHomeProps) {
  const recentProjects = [...projects]
    .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime())
    .slice(0, 5);

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-[#f4f8ff] p-4 sm:p-6 custom-scrollbar">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b4f9c]">Trung tâm điều hành</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Tổng quan báo giá</h2>
          <p className="text-sm text-slate-500">Theo dõi dự án, lịch sử thao tác và cập nhật file Excel trong một nơi.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">Tổng dự án</p><FolderOpen className="h-4 w-4 text-[#0b4f9c]" /></div><p className="mt-2 text-2xl font-bold text-slate-900">{projects.length}</p></div>
          <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">Đang chờ xử lý</p><Clock3 className="h-4 w-4 text-amber-600" /></div><p className="mt-2 text-2xl font-bold text-slate-900">{pendingCount}</p></div>
          <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">Nhật ký chỉnh sửa</p><History className="h-4 w-4 text-emerald-600" /></div><p className="mt-2 text-2xl font-bold text-slate-900">{edits.length}</p></div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5">
            <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4"><div><h3 className="text-base font-bold text-slate-900">Upload file Excel</h3><p className="mt-1 text-xs text-slate-500">Tạo nhanh một dự án mới từ file .xlsx.</p></div><FileSpreadsheet className="h-5 w-5 text-[#0b4f9c]" /></div>
              <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/50 px-4 text-center transition-colors hover:border-blue-400 hover:bg-blue-50"><Upload className="h-6 w-6 text-[#0b4f9c]" /><span className="mt-2 text-sm font-semibold text-blue-900">Chọn file Excel để tải lên</span><span className="mt-1 text-xs text-slate-500">Định dạng hỗ trợ: .xlsx</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadFile(file); event.currentTarget.value = ""; }} /></label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-base font-bold text-slate-900">Danh sách dự án</h3><p className="mt-1 text-xs text-slate-500">Chọn dự án để mở nội dung Excel.</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#0b4f9c]">{projects.length} dự án</span></div>
              <div className="max-h-[330px] overflow-y-auto custom-scrollbar">{recentProjects.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">Chưa có dự án nào.</p> : recentProjects.map((project) => <button type="button" key={project.id} onClick={() => onSelectProject(project.id)} className={`flex w-full items-center gap-3 border-b border-slate-100 px-5 py-3 text-left transition-colors last:border-0 hover:bg-blue-50/60 ${selectedProject?.id === project.id ? "bg-blue-50" : ""}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[#0b4f9c]"><FileSpreadsheet className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{project.name}</p><p className="mt-1 text-[11px] text-slate-400">Cập nhật: {formatDate(project.updatedAt || project.createdAt)}</p></div>{project.trangThai && <StatusBadge status={project.trangThai} />}</button>)}</div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><History className="h-4 w-4 text-[#0b4f9c]" /><div><h3 className="text-base font-bold text-slate-900">Lịch sử hoạt động</h3><p className="mt-1 text-xs text-slate-500">Các dự án được cập nhật gần đây.</p></div></div><div className="divide-y divide-slate-100">{recentProjects.slice(0, 4).map((project) => <div key={project.id} className="flex items-center gap-3 px-5 py-3"><div className="h-2 w-2 rounded-full bg-blue-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-700">{project.name}</p><p className="text-[11px] text-slate-400">Đã cập nhật ngày {formatDate(project.updatedAt || project.createdAt)}</p></div></div>)}{recentProjects.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400">Chưa có lịch sử.</p>}</div></div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><Users className="h-4 w-4 text-emerald-600" /><div><h3 className="text-base font-bold text-slate-900">Nhật ký chỉnh sửa Excel</h3><p className="mt-1 text-xs text-slate-500">{selectedProject ? `Dự án: ${selectedProject.name}` : "Chọn dự án để xem chi tiết"}</p></div></div><div className="max-h-[260px] overflow-y-auto custom-scrollbar">{!selectedProject || edits.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">{selectedProject ? "Chưa có chỉnh sửa nào." : "Chưa chọn dự án."}</p> : edits.slice(-8).reverse().map((edit, index) => <div key={`${edit.timestamp}-${edit.cell}-${index}`} className="border-b border-slate-100 px-5 py-3 last:border-0"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-emerald-700">{edit.username || "Admin"}</span><span className="text-[10px] text-slate-400">{edit.timestamp ? new Date(edit.timestamp).toLocaleString("vi-VN") : ""}</span></div><p className="mt-1 text-xs text-slate-600">Ô <strong>{edit.cell || "-"}</strong> trong {edit.sheetName || "sheet"}</p><p className="mt-1 truncate text-[11px] text-slate-500"><span className="line-through text-rose-500">{edit.oldValue || "(trống)"}</span> <span className="mx-1">→</span> <strong className="text-emerald-600">{edit.newValue || "(trống)"}</strong></p></div>)}</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

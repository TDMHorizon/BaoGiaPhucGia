import { Clock3, FileSpreadsheet, FolderOpen, History, UserRound } from "lucide-react";
import { StatusBadge } from "../StatusBadge";
import type { TrangThai } from "../../lib/constants";

type UserProject = {
	id: string;
	name: string;
	trangThai?: TrangThai;
	soBaoGia?: string;
	tenKhachHang?: string;
	updatedAt?: string;
	createdAt?: string;
};

type UserEdit = {
	username?: string;
	cell?: string;
	sheetName?: string;
	oldValue?: string;
	newValue?: string;
	timestamp?: string;
};

type UserHomeProps = {
	projects: UserProject[];
	edits: UserEdit[];
	selectedProject: UserProject | null;
	onSelectProject: (id: string) => void;
	onOpenProjects: () => void;
};

function formatDate(value?: string) {
	if (!value) return "Chưa cập nhật";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Chưa cập nhật" : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function UserHome({ projects, edits, selectedProject, onSelectProject, onOpenProjects }: UserHomeProps) {
	const recentProjects = [...projects]
		.sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime())
		.slice(0, 5);

	return (
		<section className="min-h-0 flex-1 overflow-y-auto bg-[#f4f8ff] p-4 sm:p-6 custom-scrollbar">
			<div className="mx-auto max-w-[1500px] space-y-5">
				<div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b4f9c]">Không gian nhân viên</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Tổng quan báo giá</h2><p className="mt-2 text-sm text-slate-500">Theo dõi báo giá được giao và các lần cập nhật Excel gần đây.</p></div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">Báo giá được giao</p><FolderOpen className="h-4 w-4 text-[#0b4f9c]" /></div><p className="mt-2 text-2xl font-bold text-slate-900">{projects.length}</p></div>
					<div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">Đang xử lý</p><Clock3 className="h-4 w-4 text-amber-600" /></div><p className="mt-2 text-2xl font-bold text-slate-900">{projects.filter(project => project.trangThai && !["DA_DUYET", "DA_GUI_KHACH"].includes(project.trangThai)).length}</p></div>
					<div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">Lần chỉnh sửa</p><History className="h-4 w-4 text-emerald-600" /></div><p className="mt-2 text-2xl font-bold text-slate-900">{edits.length}</p></div>
				</div>

				<div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
					<div className="space-y-5">
						<div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h3 className="text-base font-bold text-slate-900">Báo giá được giao</h3><p className="mt-1 text-xs text-slate-500">Mở danh sách để chọn báo giá cần xử lý.</p></div><button type="button" onClick={onOpenProjects} className="rounded-lg bg-[#0b4f9c] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#083f7d]">Mở danh sách</button></div></div>
						<div className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-base font-bold text-slate-900">Dự án gần đây</h3><p className="mt-1 text-xs text-slate-500">Các báo giá được cập nhật gần nhất.</p></div><FileSpreadsheet className="h-5 w-5 text-[#0b4f9c]" /></div><div className="max-h-[330px] overflow-y-auto custom-scrollbar">{recentProjects.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">Chưa có báo giá được giao.</p> : recentProjects.map(project => <button type="button" key={project.id} onClick={() => onSelectProject(project.id)} className={`flex w-full items-center gap-3 border-b border-slate-100 px-5 py-3 text-left transition-colors last:border-0 hover:bg-blue-50/60 ${selectedProject?.id === project.id ? "bg-blue-50" : ""}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[#0b4f9c]"><FileSpreadsheet className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{project.name}</p><p className="mt-1 text-[11px] text-slate-400">{project.soBaoGia || "Chưa có số BG"} · Cập nhật {formatDate(project.updatedAt || project.createdAt)}</p></div>{project.trangThai && <StatusBadge status={project.trangThai} />}</button>)}</div></div>
					</div>

					<div className="space-y-5"><div className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><History className="h-4 w-4 text-[#0b4f9c]" /><div><h3 className="text-base font-bold text-slate-900">Lịch sử hoạt động</h3><p className="mt-1 text-xs text-slate-500">Các báo giá gần đây của bạn.</p></div></div><div className="divide-y divide-slate-100">{recentProjects.slice(0, 4).map(project => <div key={project.id} className="flex items-center gap-3 px-5 py-3"><div className="h-2 w-2 rounded-full bg-blue-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-700">{project.name}</p><p className="text-[11px] text-slate-400">Cập nhật ngày {formatDate(project.updatedAt || project.createdAt)}</p></div></div>)}{recentProjects.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400">Chưa có lịch sử.</p>}</div></div>
						<div className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><UserRound className="h-4 w-4 text-emerald-600" /><div><h3 className="text-base font-bold text-slate-900">Nhật ký chỉnh sửa Excel</h3><p className="mt-1 text-xs text-slate-500">{selectedProject ? `Dự án: ${selectedProject.name}` : "Chọn dự án để xem chi tiết"}</p></div></div><div className="max-h-[260px] overflow-y-auto custom-scrollbar">{!selectedProject || edits.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">{selectedProject ? "Chưa có chỉnh sửa nào." : "Chưa chọn báo giá."}</p> : edits.slice(-8).reverse().map((edit, index) => <div key={`${edit.timestamp}-${edit.cell}-${index}`} className="border-b border-slate-100 px-5 py-3 last:border-0"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-emerald-700">{edit.username || "Bạn"}</span><span className="text-[10px] text-slate-400">{edit.timestamp ? new Date(edit.timestamp).toLocaleString("vi-VN") : ""}</span></div><p className="mt-1 text-xs text-slate-600">Ô <strong>{edit.cell || "-"}</strong> trong {edit.sheetName || "sheet"}</p><p className="mt-1 truncate text-[11px] text-slate-500"><span className="line-through text-rose-500">{edit.oldValue || "(trống)"}</span><span className="mx-1">→</span><strong className="text-emerald-600">{edit.newValue || "(trống)"}</strong></p></div>)}</div></div>
					</div>
				</div>
			</div>
		</section>
	);
}

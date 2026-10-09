import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  RotateCcw,
  Search,
  ShieldCheck,
  Table,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { getSheetData, parseExcel } from "../../lib/excel";
import { useAuth } from "../../lib/auth";
import { ROUTES } from "../../router";
import { AppShell } from "../../layout/AppShell";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type DeletedProject = {
  id: string;
  name: string;
  soBaoGia?: string;
  tenKhachHang?: string;
  deletedAt: string | null;
};

const PAGE_SIZE = 8;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const INITIAL_PREVIEW_LIMIT = 50;

function formatDate(value: string | null) {
  if (!value) return "Không rõ thời điểm";
  return new Date(value).toLocaleString("vi-VN");
}

function daysUntilPermanentDelete(deletedAt: string | null) {
  if (!deletedAt) return null;
  return Math.ceil((new Date(deletedAt).getTime() + RETENTION_MS - Date.now()) / (24 * 60 * 60 * 1000));
}

function getExcelColumnName(colIndex: number): string {
  let name = "";
  let temp = colIndex;
  while (temp >= 0) {
    name = String.fromCharCode((temp % 26) + 65) + name;
    temp = Math.floor(temp / 26) - 1;
  }
  return name;
}

export function ListHistFilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<DeletedProject[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Preview Modal States
  const [previewProject, setPreviewProject] = useState<DeletedProject | null>(null);
  const [previewWorkbook, setPreviewWorkbook] = useState<any | null>(null);
  const [previewSheets, setPreviewSheets] = useState<string[]>([]);
  const [previewSheet, setPreviewSheet] = useState("");
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);

  const loadDeletedProjects = async () => {
    setIsLoading(true);
    try {
      setProjects(await api.getDeletedProjects());
    } catch (error: any) {
      toast.error(error.message || "Không tải được danh sách file đã xóa");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedProjects();
  }, []);

  // Keyboard shortcut to close preview modal with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewProject) {
        closePreview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewProject]);

  const filteredProjects = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return projects.filter((project) => {
      if (!query) return true;
      return `${project.name} ${project.soBaoGia || ""} ${project.tenKhachHang || ""}`.toLowerCase().includes(query);
    });
  }, [projects, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const restoreProject = async (project: DeletedProject) => {
    setRestoringId(project.id);
    try {
      await api.restoreProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      if (previewProject?.id === project.id) {
        closePreview();
      }
      toast.success(`Đã khôi phục ${project.name}`);
    } catch (error: any) {
      toast.error(error.message || "Khôi phục file thất bại");
    } finally {
      setRestoringId(null);
    }
  };

  const openPreview = async (project: DeletedProject) => {
    setPreviewProject(project);
    setPreviewWorkbook(null);
    setPreviewData([]);
    setShowAllRows(false);
    setIsPreviewLoading(true);
    try {
      const detail = await api.getDeletedProject(project.id);
      if (!detail.fileBase64) throw new Error("File Excel không còn tồn tại.");
      const workbook = await parseExcel(detail.fileBase64);
      const firstSheet = workbook.SheetNames[0] || "";
      setPreviewWorkbook(workbook);
      setPreviewSheets(workbook.SheetNames);
      setPreviewSheet(firstSheet);
      setPreviewData(firstSheet ? getSheetData(workbook, firstSheet) : []);
    } catch (error: any) {
      setPreviewProject(null);
      toast.error(error.message || "Không thể xem trước file");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewProject(null);
    setPreviewWorkbook(null);
    setPreviewSheets([]);
    setPreviewSheet("");
    setPreviewData([]);
    setShowAllRows(false);
  };

  const changePreviewSheet = (sheetName: string) => {
    if (!previewWorkbook) return;
    setPreviewSheet(sheetName);
    setShowAllRows(false);
    setPreviewData(getSheetData(previewWorkbook, sheetName));
  };

  // Compute maximum columns for current sheet to render Excel column headers (A, B, C...)
  const maxCols = useMemo(() => {
    if (!previewData || previewData.length === 0) return 8;
    const longest = previewData.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    return Math.max(longest, 8); // Display at least 8 columns for natural Excel look
  }, [previewData]);

  const columnHeaders = useMemo(() => {
    return Array.from({ length: maxCols }, (_, idx) => getExcelColumnName(idx));
  }, [maxCols]);

  const displayedRows = useMemo(() => {
    if (showAllRows) return previewData;
    return previewData.slice(0, INITIAL_PREVIEW_LIMIT);
  }, [previewData, showAllRows]);

  if (!user || (user.role !== "admin" && user.role !== "manager")) return null;

  return (
    <AppShell
      title="Thùng Rác • Kho Lưu Trữ Báo Giá Tạm Thời"
      subtitle="Các file báo giá đã xóa được lưu trữ an toàn trong 30 ngày trước khi xóa vĩnh viễn"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm">
                  <Archive className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Kho lưu trữ tạm thời</p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">File đã xóa</h1>
                  <p className="mt-1 text-sm text-slate-500">Các file được giữ trong 30 ngày trước khi xóa vĩnh viễn.</p>
                </div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-xs">
                <strong>{projects.length}</strong> file đang chờ xử lý
              </div>
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row">
                <label className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Tìm theo tên file, số báo giá hoặc khách hàng..."
                    className="h-10 pl-9"
                  />
                </label>
                <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 text-sm text-slate-500">
                  <ShieldCheck className="h-4 w-4" />Chỉ admin/manager
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">File báo giá</th>
                      <th className="px-5 py-3">Khách hàng</th>
                      <th className="px-5 py-3">Đã xóa lúc</th>
                      <th className="px-5 py-3">Thời hạn</th>
                      <th className="px-5 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">
                          Đang tải danh sách file...
                        </td>
                      </tr>
                    ) : visibleProjects.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">
                          Không có file đã xóa phù hợp.
                        </td>
                      </tr>
                    ) : (
                      visibleProjects.map((project) => {
                        const daysLeft = daysUntilPermanentDelete(project.deletedAt);
                        return (
                          <tr key={project.id} className="transition-colors hover:bg-amber-50/40">
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() => openPreview(project)}
                                className="text-left font-semibold text-slate-800 underline decoration-transparent underline-offset-4 transition-colors hover:text-[#0b4f9c] hover:decoration-current"
                              >
                                {project.name}
                              </button>
                              <div className="mt-1 text-xs text-slate-500">
                                Số báo giá: {project.soBaoGia || "Chưa có"}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">{project.tenKhachHang || "Chưa có"}</td>
                            <td className="px-5 py-4 text-sm text-slate-600">{formatDate(project.deletedAt)}</td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  daysLeft !== null && daysLeft <= 7
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                <CalendarClock className="h-3.5 w-3.5" />
                                {daysLeft === null
                                  ? "Không xác định"
                                  : daysLeft <= 0
                                  ? "Sắp xóa vĩnh viễn"
                                  : `Còn ${daysLeft} ngày`}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => openPreview(project)}
                                  aria-label={`Xem trước ${project.name}`}
                                  title="Xem trước file Excel"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() => restoreProject(project)}
                                  disabled={restoringId === project.id}
                                  className="gap-2 bg-[#0b4f9c] text-xs hover:bg-[#083f7d]"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  {restoringId === project.id ? "Đang khôi phục..." : "Khôi phục"}
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
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
                <span>
                  Trang {currentPage} / {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={currentPage === 1}
                    aria-label="Trang trước"
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
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </section>
          </div>

          {/* Modal Xem trước nội dung Excel */}
      {previewProject && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-2 sm:p-4 lg:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleted-file-preview-title"
            className="flex max-h-[92vh] w-full max-w-[96vw] xl:max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-xs">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0b4f9c]">
                      Xem trước file Excel
                    </span>
                    {previewProject.soBaoGia && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        Số: {previewProject.soBaoGia}
                      </span>
                    )}
                    {previewProject.tenKhachHang && (
                      <span className="hidden sm:inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        KH: {previewProject.tenKhachHang}
                      </span>
                    )}
                  </div>
                  <h2
                    id="deleted-file-preview-title"
                    className="mt-0.5 truncate text-base sm:text-lg font-bold text-slate-900"
                    title={previewProject.name}
                  >
                    {previewProject.name}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => restoreProject(previewProject)}
                  disabled={restoringId === previewProject.id}
                  className="hidden sm:inline-flex gap-1.5 bg-[#0b4f9c] text-xs hover:bg-[#083f7d]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {restoringId === previewProject.id ? "Đang khôi phục..." : "Khôi phục"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={closePreview}
                  aria-label="Đóng xem trước"
                  className="rounded-xl hover:bg-slate-100"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </Button>
              </div>
            </div>

            {isPreviewLoading ? (
              <div className="flex min-h-[350px] flex-col items-center justify-center gap-3 text-slate-500">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#0b4f9c] border-t-transparent" />
                <p className="text-sm font-medium">Đang tải và hiển thị nội dung file Excel...</p>
              </div>
            ) : (
              <>
                {/* Thanh chọn Sheet - Tiêu đề to rõ, hiện đại */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-slate-100/80 px-4 py-2 gap-2">
                  <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 pl-1 shrink-0">
                      <Table className="h-4 w-4 text-[#0b4f9c]" /> Sheets:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {previewSheets.map((sheet) => {
                        const isActive = previewSheet === sheet;
                        return (
                          <button
                            key={sheet}
                            type="button"
                            onClick={() => changePreviewSheet(sheet)}
                            className={`flex items-center gap-2 shrink-0 rounded-lg px-3.5 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-[15px] font-bold transition-all duration-150 shadow-xs ${
                              isActive
                                ? "bg-[#0b4f9c] text-white shadow-md shadow-blue-600/20 ring-2 ring-[#0b4f9c]/30"
                                : "bg-white text-slate-700 hover:bg-slate-50 hover:text-[#0b4f9c] border border-slate-200"
                            }`}
                          >
                            <FileSpreadsheet className={`h-4 w-4 ${isActive ? "text-blue-200" : "text-slate-400"}`} />
                            <span>{sheet}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 self-end sm:self-auto">
                    <span className="font-medium bg-white px-2.5 py-1 rounded-md border border-slate-200">
                      Sheet: <strong className="text-slate-800">{previewSheet}</strong>
                    </span>
                    <span className="font-medium bg-white px-2.5 py-1 rounded-md border border-slate-200">
                      <strong>{previewData.length}</strong> dòng • <strong>{maxCols}</strong> cột
                    </span>
                  </div>
                </div>

                {/* Khu vực bảng tính Excel có cột A B C... và số dòng 1 2 3... */}
                <div className="min-h-0 flex-1 overflow-auto bg-slate-50/50 p-2 sm:p-4">
                  {previewData.length === 0 ? (
                    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
                      <FileSpreadsheet className="h-12 w-12 text-slate-300 mb-2" />
                      <p className="font-medium text-slate-600">Sheet này không có dữ liệu để hiển thị.</p>
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-[60vh] sm:max-h-[64vh] rounded-xl border border-slate-300 bg-white shadow-sm">
                      <table className="min-w-full border-collapse text-left text-xs sm:text-[13px] font-mono select-text">
                        <thead>
                          <tr className="sticky top-0 z-20">
                            {/* Ô góc trên cùng bên trái */}
                            <th className="sticky left-0 top-0 z-30 w-12 min-w-[48px] max-w-[48px] border-b border-r border-slate-300 bg-slate-200 px-2 py-2 text-center text-[11px] font-bold text-slate-600 select-none shadow-xs">
                              #
                            </th>
                            {/* Các cột A, B, C, D... */}
                            {columnHeaders.map((colName) => (
                              <th
                                key={colName}
                                className="min-w-[150px] max-w-[300px] border-b border-r border-slate-300 bg-slate-100 px-3 py-2 text-center text-xs font-bold tracking-wider text-slate-700 select-none shadow-xs"
                              >
                                {colName}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayedRows.map((row, rowIndex) => {
                            const rowNum = rowIndex + 1;
                            const isEven = rowIndex % 2 === 1;
                            return (
                              <tr
                                key={rowIndex}
                                className={`transition-colors hover:bg-blue-50/70 ${
                                  isEven ? "bg-slate-50/60" : "bg-white"
                                }`}
                              >
                                {/* Cột số dòng 1, 2, 3... cố định bên trái */}
                                <td className="sticky left-0 z-10 w-12 min-w-[48px] max-w-[48px] border-b border-r border-slate-300 bg-slate-100 px-1.5 py-2 text-center text-[11px] font-semibold text-slate-500 select-none">
                                  {rowNum}
                                </td>
                                {/* Các ô dữ liệu theo từng cột A, B, C... */}
                                {columnHeaders.map((_, colIndex) => {
                                  const cellValue = row ? row[colIndex] : "";
                                  const displayValue = cellValue !== null && cellValue !== undefined ? String(cellValue) : "";
                                  return (
                                    <td
                                      key={colIndex}
                                      className="min-w-[150px] max-w-[300px] border-b border-r border-slate-200 px-3 py-2 align-top text-slate-800 break-words whitespace-pre-wrap font-sans leading-relaxed text-xs sm:text-[13px]"
                                    >
                                      {displayValue}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Footer Modal với thống kê và nút thao tác */}
                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>
                      Đang hiển thị <strong>{displayedRows.length}</strong> / <strong>{previewData.length}</strong> dòng
                    </span>
                    {previewData.length > INITIAL_PREVIEW_LIMIT && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllRows((prev) => !prev)}
                        className="h-7 text-xs border-slate-300 hover:bg-slate-100"
                      >
                        {showAllRows
                          ? `Thu gọn (${INITIAL_PREVIEW_LIMIT} dòng)`
                          : `Xem toàn bộ (${previewData.length} dòng)`}
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closePreview}
                      className="text-xs sm:text-sm"
                    >
                      Đóng
                    </Button>
                    <Button
                      type="button"
                      onClick={() => restoreProject(previewProject)}
                      disabled={restoringId === previewProject.id}
                      className="gap-1.5 bg-[#0b4f9c] text-xs sm:text-sm hover:bg-[#083f7d]"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {restoringId === previewProject.id ? "Đang khôi phục..." : "Khôi phục file"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

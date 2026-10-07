import { useState, useEffect } from "react";
import { FolderOpen, Settings, Users, FileText, Undo, Plus, Minus, Search, Filter, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import { fileToBase64, parseExcel, getSheetData, applyEditsToWorkbook } from "../lib/excel";
import { SpreadsheetViewer } from "./SpreadsheetViewer";
import { insertRowWithExcelJS, deleteRowWithExcelJS, insertColWithExcelJS, deleteColWithExcelJS, loadExcelJSWorkbook, updateMergedCellInExcelJS } from "../lib/exceljs-helper";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "./ui/dialog";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import * as XLSX from "xlsx";
import { ProjectMetaForm } from "./ProjectMetaForm";
import { StatusWorkflow } from "./StatusWorkflow";
import { StatusBadge } from "./StatusBadge";
import { UserManagement } from "./UserManagement";
import { TemplateLibrary } from "./TemplateLibrary";
import { TRANG_THAI_LABELS, type TrangThai } from "../lib/constants";
import { printProjectAsPdf } from "../lib/printPdf";
import { useAuth } from "../lib/auth";
import { AdminHeader, AdminSidebar } from "../layout/AdminLayout";
import { AdminHome } from "./pages/AdminHome";

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [edits, setEdits] = useState<any[]>([]);
  const [ranges, setRanges] = useState<any>({});
  const [mainTab, setMainTab] = useState("file");
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isQuotesNavExpanded, setIsQuotesNavExpanded] = useState(true);
  const [isAccountsNavExpanded, setIsAccountsNavExpanded] = useState(true);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isDeletedProjectsDialogOpen, setIsDeletedProjectsDialogOpen] = useState(false);
  const [deletedProjects, setDeletedProjects] = useState<any[]>([]);

  // For visual selector
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [exceljsWorkbook, setExceljsWorkbook] = useState<any | null>(null);
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [previewLimit, setPreviewLimit] = useState<number>(55);
  const [rowInsertIndex, setRowInsertIndex] = useState<string>("");
  const [colInsertIndex, setColInsertIndex] = useState<string>("");
  const [rowDeleteIndex, setRowDeleteIndex] = useState<string>("");
  const [colDeleteIndex, setColDeleteIndex] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [dragStart, setDragStart] = useState<{ r: number; c: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ r: number; c: number } | null>(null);

  const pushToHistory = (fileBase64: string) => {
    setHistory(prev => [...prev, fileBase64]);
  };

  useEffect(() => {
    loadProjects();
  }, [searchQ, filterStatus]);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects({ q: searchQ || undefined, status: filterStatus || undefined });
      setProjects(data);
      const pending = await api.getPendingCount();
      setPendingCount(pending.count || 0);
    } catch (e: any) {
      toast.error(e.message || "Không tải được danh sách");
    }
  };

  const loadDeletedProjects = async () => {
    try {
      setDeletedProjects(await api.getDeletedProjects());
    } catch (e: any) {
      toast.error(e.message || "Không tải được danh sách file đã xóa");
    }
  };

  const handleRestoreProject = async (id: string) => {
    try {
      await api.restoreProject(id);
      toast.success("Đã khôi phục file báo giá");
      await loadDeletedProjects();
      await loadProjects();
    } catch (e: any) {
      toast.error(e.message || "Khôi phục file thất bại");
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      const workbook = await parseExcel(base64);
      const sheets = workbook.SheetNames;
      await api.createProject(file.name, base64, sheets);
      toast.success("Project created successfully");
      loadProjects();
    } catch (error) {
      toast.error("Failed to upload file");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } } as any);

  const updateWorkbookStateAndExcelJS = async (base64: string, applyEditsList: any[] = []) => {
    try {
      const wb = await parseExcel(base64);
      const updatedWb = applyEditsToWorkbook(wb, applyEditsList);
      setWorkbook(updatedWb);

      const ejWb = await loadExcelJSWorkbook(base64);
      applyEditsList.forEach((edit: any) => {
        const ws = ejWb.getWorksheet(edit.sheetName);
        if (ws) {
          updateMergedCellInExcelJS(ws, edit.cell, edit.newValue);
        }
      });
      setExceljsWorkbook(ejWb);
      return { wb: updatedWb, ejWb };
    } catch (e) {
      console.error("Failed to load workbook states", e);
      throw e;
    }
  };
  const handleColumnClick = (colIndex: number) => {
    const colLetter = XLSX.utils.encode_col(colIndex);

    setDragStart(null);
    setDragEnd(null);
    appendRange(`${colLetter}:${colLetter}`);
  };


  const handleRowClick = (rowIndex: number) => {
    const rowNumber = rowIndex + 1;

    setDragStart(null);
    setDragEnd(null);
    appendRange(`${rowNumber}:${rowNumber}`);
  };
  const handleSelectProject = async (id: string) => {
    setHistory([]); // Clear undo history for newly selected project
    const project = await api.getProject(id);
    setSelectedProject(project);
    setRanges(project.editableRanges || {});
    const projectEdits = await api.getEdits(id);
    setEdits(projectEdits);

    try {
      const { wb } = await updateWorkbookStateAndExcelJS(project.fileBase64, projectEdits);
      if (wb.SheetNames.length > 0) {
        setActiveSheet(wb.SheetNames[0]);
        setSheetData(getSheetData(wb, wb.SheetNames[0]));
      }
    } catch (e) {
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa báo giá này không?")) return;
    try {
      await api.deleteProject(id);
      toast.success("Đã xóa báo giá");
      if (selectedProject?.id === id) {
        setSelectedProject(null);
      }
      loadProjects();
    } catch (e: any) {
      toast.error(e.message || "Xóa thất bại");
    }
  };

  const handleTabChange = (sheetName: string) => {
    if (!workbook) return;
    setActiveSheet(sheetName);
    setSheetData(getSheetData(workbook, sheetName));
  };

  const appendRange = (rangePart: string) => {
    const currentRange = ranges[activeSheet] || "";
    const parts = currentRange.split(",").map((r: string) => r.trim()).filter(Boolean);
    if (parts.includes(rangePart)) {
      setRanges({ ...ranges, [activeSheet]: parts.filter((r: string) => r !== rangePart).join(", ") });
    } else {
      setRanges({ ...ranges, [activeSheet]: [...parts, rangePart].join(", ") });
    }
  };


  const handleCellMouseDown = (r: number, c: number) => {
    setDragStart({ r, c });
    setDragEnd({ r, c });
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (dragStart) setDragEnd({ r, c });
  };

  const handleCellMouseUp = () => {
    if (!dragStart || !dragEnd) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }
    const r1 = Math.min(dragStart.r, dragEnd.r);
    const r2 = Math.max(dragStart.r, dragEnd.r);
    const c1 = Math.min(dragStart.c, dragEnd.c);
    const c2 = Math.max(dragStart.c, dragEnd.c);
    const start = XLSX.utils.encode_cell({ r: r1, c: c1 });
    const end = XLSX.utils.encode_cell({ r: r2, c: c2 });
    const rangePart = start === end ? start : `${start}:${end}`;
    appendRange(rangePart);
    setDragStart(null);
    setDragEnd(null);
  };

  const isInDragSelection = (r: number, c: number) => {
    if (!dragStart || !dragEnd) return false;
    const r1 = Math.min(dragStart.r, dragEnd.r);
    const r2 = Math.max(dragStart.r, dragEnd.r);
    const c1 = Math.min(dragStart.c, dragEnd.c);
    const c2 = Math.max(dragStart.c, dragEnd.c);
    return r >= r1 && r <= r2 && c >= c1 && c <= c2;
  };

  const handleUndo = async () => {
    if (history.length === 0 || !selectedProject) return;
    const previousBase64 = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    try {
      const { wb } = await updateWorkbookStateAndExcelJS(previousBase64, edits);
      await api.updateProjectFile(selectedProject.id, previousBase64, wb.SheetNames);

      setHistory(newHistory);
      if (wb.SheetNames.includes(activeSheet)) {
        setSheetData(getSheetData(wb, activeSheet));
      } else if (wb.SheetNames.length > 0) {
        setActiveSheet(wb.SheetNames[0]);
        setSheetData(getSheetData(wb, wb.SheetNames[0]));
      }
      setSelectedProject((prev: any) => prev ? { ...prev, fileBase64: previousBase64 } : null);
      toast.success("Đã hoàn tác thao tác vừa rồi!");
    } catch (error) {
      console.error(error);
      toast.error("Không thể hoàn tác!");
    }
  };
  const handleCellEdit = async (r: number, c: number, newValue: string) => {
    if (!workbook || !selectedProject) return;

    pushToHistory(selectedProject.fileBase64);

    const cellRef = XLSX.utils.encode_cell({ r, c });
    const sheetName = activeSheet;

    const newEdit = {
      sheetName,
      cell: cellRef,
      oldValue: sheetData[r][c] || "",
      newValue: newValue || "",
      username: user?.username || "Admin",
      timestamp: new Date().toISOString()
    };

    try {
      const newSheetData = [...sheetData];
      if (!newSheetData[r]) newSheetData[r] = [];
      newSheetData[r][c] = newValue;
      setSheetData(newSheetData);


      await api.saveEdit(selectedProject.id, newEdit);
      const editsToApply = [...edits, newEdit];
      setEdits(editsToApply);


      const { wb, ejWb } = await updateWorkbookStateAndExcelJS(selectedProject.fileBase64, [newEdit]);
      const buffer = await ejWb.xlsx.writeBuffer();


      let binary = '';
      const bytes = new Uint8Array(buffer as ArrayBuffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64String = window.btoa(binary);

      
      await api.updateProjectFile(selectedProject.id, base64String, wb.SheetNames);
      setSelectedProject({ ...selectedProject, fileBase64: base64String });

      toast.success(`Đã cập nhật ô ${cellRef}`);
    } catch (e: any) {
      console.error(e);
      toast.error("Lỗi khi lưu dữ liệu! Vui lòng nhấn F12 để xem chi tiết.");
    }
    
  };
  const handleAddRow = async () => {
    if (!workbook || !selectedProject) return;

    let targetRowIndex = sheetData.length; // Default to append at the end
    if (rowInsertIndex.trim()) {
      const idx = parseInt(rowInsertIndex.trim(), 10) - 1;
      if (!isNaN(idx) && idx >= 0 && idx <= sheetData.length) {
        targetRowIndex = idx;
      } else {
        toast.error("Vị trí dòng không hợp lệ!");
        return;
      }
    }

    pushToHistory(selectedProject.fileBase64);

    try {
      const newBase64 = await insertRowWithExcelJS(selectedProject.fileBase64, activeSheet, targetRowIndex);
      const { wb } = await updateWorkbookStateAndExcelJS(newBase64, edits);
      setSheetData(getSheetData(wb, activeSheet));

      await api.updateProjectFile(selectedProject.id, newBase64, wb.SheetNames);
      toast.success(`Đã thêm dòng số ${targetRowIndex + 1} thành công (Giữ nguyên định dạng & hình ảnh!)`);
      setRowInsertIndex(""); // clear input

      setSelectedProject((prev: any) => prev ? { ...prev, fileBase64: newBase64 } : null);
    } catch (error) {
      console.error(error);
      toast.error("Thêm dòng thất bại (Vui lòng thử lại!)");
    }
  };

  const handleAddColumn = async () => {
    if (!workbook || !selectedProject) return;

    let targetColIndex: number | undefined = undefined; // Undefined = append at the end
    const colCount = sheetData[0]?.length || 0;
    if (colInsertIndex.trim()) {
      const normalized = colInsertIndex.trim().toUpperCase();
      if (/^[A-Z]+$/.test(normalized)) {
        targetColIndex = XLSX.utils.decode_col(normalized);
      } else if (/^\d+$/.test(normalized)) {
        targetColIndex = parseInt(normalized, 10) - 1;
      }

      if (targetColIndex === undefined || isNaN(targetColIndex) || targetColIndex < 0) {
        toast.error("Vị trí cột không hợp lệ!");
        return;
      }
    }

    pushToHistory(selectedProject.fileBase64);

    try {
      const colIdxToInsert = targetColIndex !== undefined ? targetColIndex : colCount;
      const newBase64 = await insertColWithExcelJS(selectedProject.fileBase64, activeSheet, colIdxToInsert);
      const { wb } = await updateWorkbookStateAndExcelJS(newBase64, edits);
      setSheetData(getSheetData(wb, activeSheet));

      await api.updateProjectFile(selectedProject.id, newBase64, wb.SheetNames);

      const posLabel = targetColIndex !== undefined ? XLSX.utils.encode_col(targetColIndex) : "cuối";
      toast.success(`Đã thêm cột ở vị trí ${posLabel} thành công (Giữ nguyên định dạng!)`);
      setColInsertIndex(""); // clear input

      setSelectedProject((prev: any) => prev ? { ...prev, fileBase64: newBase64 } : null);
    } catch (error) {
      console.error(error);
      toast.error("Thêm cột thất bại (Vui lòng thử lại!)");
    }
  };

  const handleDeleteRow = async () => {
    if (!workbook || !selectedProject) return;
    if (sheetData.length === 0) {
      toast.error("Bảng tính không có dòng nào để xóa!");
      return;
    }

    let targetRowIndex = sheetData.length - 1; // Default to delete last row
    if (rowDeleteIndex.trim()) {
      const idx = parseInt(rowDeleteIndex.trim(), 10) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < sheetData.length) {
        targetRowIndex = idx;
      } else {
        toast.error("Vị trí dòng xóa không hợp lệ!");
        return;
      }
    }

    pushToHistory(selectedProject.fileBase64);

    try {
      const newBase64 = await deleteRowWithExcelJS(selectedProject.fileBase64, activeSheet, targetRowIndex);
      const { wb } = await updateWorkbookStateAndExcelJS(newBase64, edits);
      setSheetData(getSheetData(wb, activeSheet));

      await api.updateProjectFile(selectedProject.id, newBase64, wb.SheetNames);
      toast.success(`Đã xóa dòng số ${targetRowIndex + 1} thành công`);
      setRowDeleteIndex(""); // clear input

      setSelectedProject((prev: any) => prev ? { ...prev, fileBase64: newBase64 } : null);
    } catch (error) {
      console.error(error);
      toast.error("Xóa dòng thất bại!");
    }
  };

  const handleDeleteColumn = async () => {
    if (!workbook || !selectedProject) return;
    const colCount = sheetData[0]?.length || 0;
    if (colCount === 0) {
      toast.error("Bảng tính không có cột nào để xóa!");
      return;
    }

    let targetColIndex = colCount - 1; // Default to last column
    if (colDeleteIndex.trim()) {
      const normalized = colDeleteIndex.trim().toUpperCase();
      if (/^[A-Z]+$/.test(normalized)) {
        targetColIndex = XLSX.utils.decode_col(normalized);
      } else if (/^\d+$/.test(normalized)) {
        targetColIndex = parseInt(normalized, 10) - 1;
      }

      if (targetColIndex === undefined || isNaN(targetColIndex) || targetColIndex < 0 || targetColIndex >= colCount) {
        toast.error("Vị trí cột xóa không hợp lệ!");
        return;
      }
    }

    pushToHistory(selectedProject.fileBase64);

    try {
      const newBase64 = await deleteColWithExcelJS(selectedProject.fileBase64, activeSheet, targetColIndex);
      const { wb } = await updateWorkbookStateAndExcelJS(newBase64, edits);
      setSheetData(getSheetData(wb, activeSheet));

      await api.updateProjectFile(selectedProject.id, newBase64, wb.SheetNames);

      const posLabel = XLSX.utils.encode_col(targetColIndex);
      toast.success(`Đã xóa cột ${posLabel} thành công`);
      setColDeleteIndex(""); // clear input

      setSelectedProject((prev: any) => prev ? { ...prev, fileBase64: newBase64 } : null);
    } catch (error) {
      console.error(error);
      toast.error("Xóa cột thất bại!");
    }
  };

  const handleSaveRanges = async () => {
    if (!selectedProject) return;
    try {
      await api.updateRanges(selectedProject.id, ranges);
      toast.success("Đã cập nhật phạm vi chỉnh sửa thành công!");
    } catch (error) {
      toast.error("Không thể cập nhật phạm vi chỉnh sửa!");
    }
  };

  const centerColSpan = (() => {
    const leftOpen = showLeftPanel;
    const rightOpen = showRightPanel && selectedProject;
    if (leftOpen && rightOpen) return "lg:col-span-6";
    if (!leftOpen && !rightOpen) return "lg:col-span-12";
    return "lg:col-span-9";
  })();

  return (
    <div className="h-screen flex bg-[#f4f8ff] text-slate-900 overflow-hidden">
      <AdminSidebar
        userRole={user?.role}
        mainTab={mainTab}
        pendingCount={pendingCount}
        isMobileOpen={showMobileNav}
        isCollapsed={isSidebarCollapsed}
        isQuotesExpanded={isQuotesNavExpanded}
        isAccountsExpanded={isAccountsNavExpanded}
        selectedProject={selectedProject}
        onMainTabChange={setMainTab}
        onMobileOpenChange={setShowMobileNav}
        onQuotesExpandedChange={() => setIsQuotesNavExpanded(prev => !prev)}
        onAccountsExpandedChange={() => setIsAccountsNavExpanded(prev => !prev)}
        onProjectDialogOpen={() => setIsProjectDialogOpen(true)}
        onTemplateDialogOpen={() => setIsTemplateDialogOpen(true)}
        onUserDialogOpen={() => setIsUserDialogOpen(true)}
        onDeletedProjectsOpen={() => { setIsDeletedProjectsDialogOpen(true); loadDeletedProjects(); }}
        onLogout={logout}
      />

      <div className="min-w-0 flex-1 flex flex-col">
        <AdminHeader
          selectedProject={selectedProject}
          username={user?.username}
          onLogout={logout}
          onToggleNavigation={() => { if (window.innerWidth >= 768) setIsSidebarCollapsed(prev => !prev); else setShowMobileNav(true); }}
        />
        <main className="min-h-0 flex-1 flex flex-col">
        {mainTab === "dashboard" ? (
          <AdminHome
            projects={projects}
            edits={edits}
            pendingCount={pendingCount}
            selectedProject={selectedProject}
            onUploadFile={(file) => onDrop([file])}
            onSelectProject={handleSelectProject}
          />
        ) : (
          <>
      {/* Top Ribbon */}
      <div className="bg-white flex flex-col shrink-0 border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="sr-only">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="file" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none px-4 text-xs bg-transparent data-[state=active]:bg-white">Tệp</TabsTrigger>
            <TabsTrigger value="home" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none px-4 text-xs bg-transparent data-[state=active]:bg-white">Trang chủ</TabsTrigger>
            {user?.role === "admin" && (
              <TabsTrigger value="admin" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none px-4 text-xs bg-transparent data-[state=active]:bg-white">Hệ thống</TabsTrigger>
            )}
          </TabsList>
          
          <div className="h-24 bg-white/50 px-2 py-1 flex items-start gap-4 overflow-x-auto custom-scrollbar">
            <TabsContent value="dashboard" className="m-0 w-full h-full flex items-center gap-3 px-3 data-[state=inactive]:hidden">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2"><p className="text-[11px] font-medium text-blue-600">Tổng báo giá</p><p className="text-xl font-bold text-blue-900">{projects.length}</p></div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-2"><p className="text-[11px] font-medium text-amber-700">Đang xử lý</p><p className="text-xl font-bold text-amber-900">{pendingCount}</p></div>
              <p className="hidden sm:block text-xs text-slate-500">Chọn một chức năng ở thanh điều hướng để bắt đầu.</p>
            </TabsContent>
            
            <TabsContent value="file" className="m-0 h-full flex items-start gap-2 pt-1 data-[state=inactive]:hidden">
              <div className="flex flex-col items-center">
                <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
                    <DialogTrigger render={<Button variant="ghost" className="h-14 w-20 flex flex-col gap-1 rounded-sm hover:bg-indigo-50" />}>
                      <FolderOpen className="w-6 h-6 text-indigo-600" strokeWidth={1.5} />
                      <span className="text-[10px] font-medium leading-none">Mở dự án</span>
                    </DialogTrigger>
                  <DialogContent className="sm:max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Quản lý Báo Giá</DialogTitle>
                    </DialogHeader>
                    {/* The project list and upload component goes here - reusing the old layout for now to keep state working */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-2">
                        <div className="lg:col-span-4 space-y-4">
                          <Card className="shadow-xs border-slate-200 bg-white">
                            <CardHeader className="pb-3 border-b bg-slate-50/50">
                              <CardTitle className="text-xs font-bold text-slate-800">Tải Lên File Excel (.xlsx)</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-3 px-3 pb-3">
                              <div {...getRootProps()} className={`border-2 border-dashed p-4 text-center cursor-pointer rounded-xl transition-all duration-200 ${isDragActive ? "border-blue-500 bg-blue-50/70" : "border-slate-200"}`}>
                                <input {...getInputProps()} />
                                <div className="mx-auto w-8 h-8 rounded-full bg-white flex items-center justify-center border shadow-2xs mb-2">
                                  <Plus className="h-4.5 w-4.5 text-indigo-600" />
                                </div>
                                <span className="text-xs font-bold text-slate-700 block mb-0.5">
                                  {isDragActive ? "Thả file..." : "Kéo thả file Excel vào đây"}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      <div className={user?.role === "admin" ? "lg:col-span-12" : "lg:col-span-8"}>
                        <Card className="shadow-xs border-slate-200 bg-white h-full flex flex-col">
                          <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <CardTitle className="text-xs font-bold text-slate-800 shrink-0">Danh sách dự án ({projects.length})</CardTitle>
                            <div className="flex gap-2">
                              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-slate-200 rounded-md h-7 px-2 text-xs">
                                <option value="">Tất cả TT</option>
                                {Object.entries(TRANG_THAI_LABELS).map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                              <Input placeholder="Tìm tên..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="h-7 w-32 text-xs bg-white" />
                            </div>
                          </CardHeader>
                          <CardContent className="p-0 flex-1 overflow-auto max-h-[400px]">
                            <ul className="divide-y divide-slate-100">
                              {projects.map((p) => (
                                <li key={p.id} className={`p-3 hover:bg-slate-50 flex justify-between items-center group ${selectedProject?.id === p.id ? "bg-indigo-50/50" : ""}`}>
                                  <DialogClose render={<button type="button" className="flex-1 cursor-pointer text-left" onClick={() => handleSelectProject(p.id)} />}>
                                    <p className="font-bold text-slate-800 text-xs mb-0.5 text-left group-hover:text-indigo-600">{p.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <StatusBadge status={p.trangThai as TrangThai} />
                                      <span className="text-[10px] text-slate-400 font-medium">BG: {p.soBaoGia || "—"}</span>
                                    </div>
                                  </DialogClose>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteProject(p.id)} className="h-7 px-2 text-red-500 hover:bg-red-50 ml-2 shrink-0">Xóa</Button>
                                </li>
                              ))}
                              {projects.length === 0 && <li className="p-4 text-center text-xs text-slate-400">Chưa có dự án nào.</li>}
                            </ul>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Tệp tin</div>
              </div>
              


                  <div className="w-px h-14 bg-slate-200 mx-2" />
                  <div className="flex flex-col items-center">
                    <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                      <DialogTrigger render={<Button variant="ghost" className="h-14 w-20 flex flex-col gap-1 rounded-sm hover:bg-indigo-50" />}>
                          <FileText className="w-6 h-6 text-emerald-600" strokeWidth={1.5} />
                          <span className="text-[10px] font-medium leading-none">Templates</span>
                        </DialogTrigger>
                      <DialogContent className="sm:max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Thư viện Templates</DialogTitle></DialogHeader>
                        <TemplateLibrary onCloned={() => loadProjects()} />
                      </DialogContent>
                    </Dialog>
                    <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Mẫu</div>
                  </div>


            </TabsContent>
            
            <TabsContent value="home" className="m-0 h-full flex items-start gap-4 pt-1 data-[state=inactive]:hidden w-full">
              {!selectedProject ? (
                <div className="flex items-center justify-center w-full h-full">
                  <p className="text-xs text-slate-400 italic">Vui lòng chọn báo giá ở tab Tệp để mở khóa các công cụ</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center">
                    <Dialog>
                      <DialogTrigger render={<Button variant="ghost" className="h-14 w-20 flex flex-col gap-1 rounded-sm hover:bg-amber-50" />}>
                          <Settings className="w-6 h-6 text-amber-600" strokeWidth={1.5} />
                          <span className="text-[10px] font-medium leading-none">Cấu hình</span>
                        </DialogTrigger>
                      <DialogContent className="sm:max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-slate-50">
                        <DialogHeader><DialogTitle>Cấu hình & Nhật ký</DialogTitle></DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-4">

                            <ProjectMetaForm project={selectedProject} onUpdated={(p) => { setSelectedProject(p); loadProjects(); }} onDeleted={() => { setSelectedProject(null); loadProjects(); }} />
                            )

                            <Card className="shadow-xs border-slate-200 bg-white">
                              <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50"><CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">Trạng thái xử lý</CardTitle></CardHeader>
                              <CardContent className="p-3">
                                <StatusWorkflow project={selectedProject} role={user?.role} onUpdated={(p) => { setSelectedProject(p); loadProjects(); }} />
                              </CardContent>
                            </Card>
                            )

                            <Card className="shadow-xs border-slate-200 bg-white">
                              <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">Vùng ô mở quyền sửa</CardTitle>
                                <Button onClick={handleSaveRanges} size="sm" className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700 px-2 font-bold">Lưu</Button>
                              </CardHeader>
                              <CardContent className="p-3 space-y-2.5">
                                {selectedProject.sheets?.map((sheet: string) => (
                                  <div key={sheet} className="space-y-1">
                                    <span className="text-[11px] font-bold text-slate-700 block truncate">{sheet}</span>
                                    <Input placeholder="Ví dụ: A1:D10, A:A" value={ranges[sheet] || ""} onChange={(e) => setRanges({ ...ranges, [sheet]: e.target.value })} className="h-7 text-xs" />
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                            )
                          </div>
                          <div>
                            <Card className="shadow-xs border-slate-200 bg-white h-full">
                              <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50">
                                <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">Nhật ký nhân viên ({edits.length})</CardTitle>
                              </CardHeader>
                              <CardContent className="p-3">
                                {edits.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic text-center py-2">Chưa có chỉnh sửa.</p>
                                ) : (
                                  <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar pr-0.5">
                                    {edits.map((ed: any, idx: number) => (
                                      <div key={idx} className="text-[11px] p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-indigo-600">{ed.username || "User"}</span>
                                          <span className="text-[9px] text-slate-400">{new Date(ed.timestamp).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="text-slate-700">Ô <span className="font-mono font-bold">{ed.cell}</span> ({ed.sheetName}):</div>
                                        <div className="truncate text-slate-600"><span className="line-through text-rose-500 mr-1">{ed.oldValue || "(trống)"}</span> → <span className="font-bold text-emerald-600">{ed.newValue || "(trống)"}</span></div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Cài đặt & Logs</div>
                  </div>
                  
                    <>
                      <div className="w-px h-14 bg-slate-200 mx-2" />
                      <div className="flex flex-col items-center">
                        <div className="flex h-14 items-center gap-1">
                          <div className="flex flex-col gap-1 border-r border-slate-200 pr-2 mr-1">
                            <div className="flex items-center gap-1">
                              <Input type="number" min="1" placeholder="Dòng..." value={rowInsertIndex} onChange={(e) => setRowInsertIndex(e.target.value)} className="w-16 h-6 text-[10px] py-0 bg-white" />
                              <Button size="icon" variant="ghost" onClick={handleAddRow} className="h-6 w-6 text-indigo-600 hover:bg-indigo-50"><Plus className="w-3 h-3" /></Button>
                              <Button size="icon" variant="ghost" onClick={handleDeleteRow} className="h-6 w-6 text-red-600 hover:bg-red-50"><Minus className="w-3 h-3" /></Button>
                            </div>
                            <div className="flex items-center gap-1">
                              <Input type="number" min="1" placeholder="Cột..." value={colInsertIndex} onChange={(e) => setColInsertIndex(e.target.value)} className="w-16 h-6 text-[10px] py-0 bg-white" />
                              <Button size="icon" variant="ghost" onClick={handleAddColumn} className="h-6 w-6 text-indigo-600 hover:bg-indigo-50"><Plus className="w-3 h-3" /></Button>
                              <Button size="icon" variant="ghost" onClick={handleDeleteColumn} className="h-6 w-6 text-red-600 hover:bg-red-50"><Minus className="w-3 h-3" /></Button>
                            </div>
                          </div>
                          
                          <Button variant="ghost" onClick={handleUndo} disabled={history.length === 0} className="h-14 w-14 flex flex-col gap-1 rounded-sm text-slate-600 hover:bg-purple-50 hover:text-purple-700">
                            <Undo className="w-5 h-5" strokeWidth={1.5} />
                            <span className="text-[10px] font-medium leading-none">Hoàn tác</span>
                          </Button>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Chỉnh sửa</div>
                      </div>
                    </>
                  )
                  
                  <div className="w-px h-14 bg-slate-200 mx-2" />
                  <div className="flex flex-col items-center">
                    <div className="flex h-14 items-center px-2">
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-500" />
                        <select
                          value={previewLimit === -1 ? "all" : previewLimit}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPreviewLimit(val === "all" ? -1 : Number(val));
                          }}
                          className="border border-slate-200 rounded-md h-7 px-2 text-xs bg-white focus:outline-none"
                        >
                          <option value={10}>10 dòng</option>
                          <option value={20}>20 dòng</option>
                          <option value={55}>55 dòng</option>
                          <option value={100}>100 dòng</option>
                          <option value="all">Tất cả</option>
                        </select>
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Chế độ xem</div>
                  </div>
                </>
              )}
            </TabsContent>
            
            {user?.role === "admin" && (
              <TabsContent value="admin" className="m-0 h-full flex items-start gap-2 pt-1 data-[state=inactive]:hidden">
                <div className="flex flex-col items-center">
                  <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                    <DialogTrigger render={<Button variant="ghost" className="h-14 w-20 flex flex-col gap-1 rounded-sm hover:bg-blue-50" />}>
                        <Users className="w-6 h-6 text-blue-600" strokeWidth={1.5} />
                        <span className="text-[10px] font-medium leading-none">Tài khoản</span>
                      </DialogTrigger>
                    <DialogContent className="sm:max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                      <DialogHeader><DialogTitle>Quản lý Tài Khoản</DialogTitle></DialogHeader>
                      <UserManagement />
                    </DialogContent>
                  </Dialog>
                  <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Bảo mật</div>
                </div>
                <div className="flex flex-col items-center">
                  <Dialog open={isDeletedProjectsDialogOpen} onOpenChange={setIsDeletedProjectsDialogOpen}>
                    <DialogTrigger render={<Button variant="ghost" className="h-14 w-20 flex flex-col gap-1 rounded-sm hover:bg-amber-50" />}>
                      <RotateCcw className="w-6 h-6 text-amber-600" strokeWidth={1.5} />
                      <span className="text-[10px] font-medium leading-none">Khôi phục file</span>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <DialogHeader><DialogTitle>Khôi phục file đã xóa</DialogTitle></DialogHeader>
                      <div className="mt-2 space-y-2">
                        {deletedProjects.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Không có file nào trong danh sách đã xóa.</p> : deletedProjects.map((project) => (
                          <div key={project.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><RotateCcw className="h-4 w-4" /></div>
                            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{project.name}</p><p className="mt-1 text-[11px] text-slate-500">Đã xóa: {project.deletedAt ? new Date(project.deletedAt).toLocaleString("vi-VN") : "Không rõ thời điểm"}</p></div>
                            <Button size="sm" onClick={() => handleRestoreProject(project.id)} className="shrink-0 bg-[#0b4f9c] text-xs hover:bg-[#083f7d]">Khôi phục</Button>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Khôi phục</div>
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
      
      {/* Full-screen Spreadsheet Area */}
      <div className="flex-1 bg-slate-200 p-2 overflow-hidden flex flex-col">
        {!selectedProject ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-slate-300 rounded-xl bg-white shadow-sm">
            <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-bold text-base text-slate-800 mb-1">Chưa chọn báo giá</h3>
            <p className="text-xs text-slate-500">Mở danh sách báo giá ở thanh công cụ phía trên để bắt đầu.</p>
          </div>
        ) : (
          <div className="flex-1 bg-white shadow-xl rounded-xl border border-slate-300 flex flex-col overflow-hidden">
            <div className="bg-slate-100 border-b flex px-2 pt-2 gap-1 overflow-x-auto shrink-0 custom-scrollbar">
              {selectedProject.sheets?.map((sheet: string) => (
                <button
                  key={sheet}
                  onClick={() => handleTabChange(sheet)}
                  className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border border-b-0 ${activeSheet === sheet ? "bg-white text-indigo-700 border-slate-300 relative translate-y-[1px]" : "bg-slate-200 text-slate-600 hover:bg-slate-300 border-transparent"}`}
                >
                  {sheet}
                </button>
              ))}
            </div>
            <div 
              className="flex-1 overflow-hidden flex flex-col relative"
              onMouseUp={handleCellMouseUp}
              onMouseLeave={() => { if (dragStart) handleCellMouseUp(); }}
            >
              <SpreadsheetViewer
                  workbook={workbook}
                  exceljsWorkbook={exceljsWorkbook}
                  sheetData={sheetData}
                  activeSheet={activeSheet}
                  mode="admin"
                  editableRange={ranges[activeSheet] || ""}
                  selectedRange={(() => {
                    if (!dragStart || !dragEnd) return "";
                    const r1 = Math.min(dragStart.r, dragEnd.r);
                    const r2 = Math.max(dragStart.r, dragEnd.r);
                    const c1 = Math.min(dragStart.c, dragEnd.c);
                    const c2 = Math.max(dragStart.c, dragEnd.c);
                    return `${XLSX.utils.encode_cell({ r: r1, c: c1 })}:${XLSX.utils.encode_cell({ r: r2, c: c2 })}`;
                  })()}
                  previewLimit={previewLimit}

                  onColumnClick={handleColumnClick}
                  onRowClick={handleRowClick}
                  onCellMouseDown={handleCellMouseDown}
                  onCellMouseEnter={handleCellMouseEnter}
                  onCellEdit={handleCellEdit}
              />
            </div>
            <div className="bg-slate-50 border-t px-4 py-1.5 shrink-0 flex justify-between items-center text-[11px] text-slate-500 font-medium">
              <span>Đang hiển thị {previewLimit === -1 ? sheetData.length : Math.min(previewLimit, sheetData.length)} / {sheetData.length} dòng.</span>
              <span>Click chữ cái cột để bật/tắt quyền sửa.</span>
            </div>
          </div>
        )}
      </div>
          </>
        )}
         </main>
      </div>
    </div>
  );
};

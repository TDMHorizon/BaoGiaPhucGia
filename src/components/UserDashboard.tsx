import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { parseExcel, getSheetData, applyEditsToWorkbook, downloadBase64File } from "../lib/excel";
import { isCellInEditableRange, isCellInRange } from "../lib/utils-excel";

import {
  loadExcelJSWorkbook,
  updateMergedCellInExcelJS,
  workbookToBase64,
  insertRowWithExcelJS,
  deleteRowWithExcelJS,
  insertColWithExcelJS,
  deleteColWithExcelJS,
} from "../lib/exceljs-helper";
import { convertToUniverWorkbook } from "../lib/excelToUniver";
import { UniverSpreadsheet } from "./SpreadsheetViewer/UniverSpreadsheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "./ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  FolderOpen,
  Download,
  Printer,
  FileSpreadsheet,
  Sparkles,
  Info,
  Search,
  X,
  ArrowRight,
  CheckCircle2,
  Building,
  Hash,
  Calendar,
  Undo,
  Replace,
  Filter,
  Table,
  Settings,
  Plus,
  Minus,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { StatusWorkflow } from "./StatusWorkflow";
import { isLockedStatus, TRANG_THAI_LABELS, type TrangThai } from "../lib/constants";
import { printProjectAsPdf } from "../lib/printPdf";
import { UserLayout } from "../layout/UserLayout";
import { UserHome } from "./pages/UserHome";
import { ROUTES } from "../router";
import { syncUniverToExcelJS } from "@/layout/mapperUniverToExcel";

function getEditableRange(project: any, sheetName: string): string {
  if (!project?.editableRanges) return "";

  try {
    let ranges = project.editableRanges;
    if (typeof ranges === "string") {
      ranges = ranges.trim().startsWith("{") ? JSON.parse(ranges) : { [sheetName]: ranges };
    }
    if (typeof ranges === "string") return ranges;
    if (ranges && typeof ranges === "object") {
      if (typeof ranges[sheetName] === "string" && ranges[sheetName].trim()) {
        return ranges[sheetName].trim();
      }
      if (typeof ranges[""] === "string" && ranges[""].trim()) {
        return ranges[""].trim();
      }
      const keys = Object.keys(ranges);
      if (keys.length === 1 && typeof ranges[keys[0]] === "string") {
        return ranges[keys[0]].trim();
      }
    }
    return "";
  } catch {
    return typeof project.editableRanges === "string" ? project.editableRanges : "";
  }
}

function formatDate(val: string | null) {
  if (!val) return "Chưa cập nhật";
  try {
    return new Date(val).toLocaleDateString("vi-VN");
  } catch {
    return val;
  }
}

export function UserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [exceljsWorkbook, setExceljsWorkbook] = useState<any | null>(null);
  const [univerSnapshot, setUniverSnapshot] = useState<any | null>(null);
  const [univerAPI, setUniverAPI] = useState<any | null>(null);
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [edits, setEdits] = useState<any[]>([]);
  const [history, setHistory] = useState<string[]>([]); // undo history with base64 backups
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const [previewLimit, setPreviewLimit] = useState<number>(55);
  // Row / Col insert & delete inputs
  const [rowInsertIndex, setRowInsertIndex] = useState<string>("");
  const [colInsertIndex, setColInsertIndex] = useState<string>("");

  // Dialogs
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Find & Replace
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);

  const [activeTab, setActiveTab] = useState("home");
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const locked = isLockedStatus(selectedProject?.trangThai);

  const pushToHistory = (fileBase64: string) => {
    setHistory((prev) => [...prev, fileBase64]);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await api.getProjectByUserId();
      setProjects(data);
    } catch (e: any) {
      toast.error(e.message || "Không tải được danh sách");
    }
  };

  const filteredProjects = useMemo(() => {
    const query = searchQ.trim().toLowerCase();
    return projects.filter((project: any) => {
      if (filterStatus !== "all" && project.trangThai !== filterStatus) return false;
      if (!query) return true;
      return `${project.name} ${project.soBaoGia || ""} ${project.tenKhachHang || ""} ${
        project.ghiChu || ""
      }`
        .toLowerCase()
        .includes(query);
    });
  }, [projects, searchQ, filterStatus]);

  const stats = useMemo(() => {
    const total = projects.length;
    const moiGiao = projects.filter((p) => p.trangThai === "moi_tao" || !p.trangThai).length;
    const dangXuLy = projects.filter(
      (p) => p.trangThai === "dang_thuc_hien" || p.trangThai === "cho_duyet"
    ).length;
    const daDuyet = projects.filter(
      (p) => p.trangThai === "da_duyet" || p.trangThai === "da_gui_khach"
    ).length;
    return { total, moiGiao, dangXuLy, daDuyet };
  }, [projects]);

  const handleSelectProject = async (id: string) => {
    setHistory([]);
    try {
      const project = await api.getProject(id);
      if (!project.fileBase64) throw new Error("Báo giá chưa có tệp Excel.");

      const wb = await parseExcel(project.fileBase64);
      const projectEdits = await api.getEdits(id);
      const updatedWb = applyEditsToWorkbook(wb, projectEdits);

      const ejWb = await loadExcelJSWorkbook(project.fileBase64);
      projectEdits.forEach((edit: any) => {
        const ws = ejWb.getWorksheet(edit.sheetName);
        if (ws) {
          updateMergedCellInExcelJS(ws, edit.cell, edit.newValue);
        }
      });

      setSelectedProject(project);
      setEdits(projectEdits);
      setWorkbook(updatedWb);
      setExceljsWorkbook(ejWb);

      const firstSheet = updatedWb.SheetNames[0] || "";
      setActiveSheet(firstSheet);
      setSheetData(firstSheet ? getSheetData(updatedWb, firstSheet) : []);

      const univerData = convertToUniverWorkbook(updatedWb, ejWb, project.editableRanges);
      setUniverSnapshot(univerData);

      setIsDialogOpen(false);
      setActiveTab("home");
      toast.success(`Đã mở thành công: ${project.name}`);
    } catch (e: any) {
      console.error("Lỗi khi tải file Excel:", e);
      setSelectedProject(null);
      setWorkbook(null);
      setExceljsWorkbook(null);
      setUniverSnapshot(null);
      setSheetData([]);
      setActiveSheet("");
      toast.error(e.message || "Không thể hiển thị file Excel.");
    }
  };

  const handleTabChange = (sheetName: string, wb = workbook) => {
    if (!wb) return;
    setActiveSheet(sheetName);
    const data = getSheetData(wb, sheetName);
    setSheetData(data);
    setSelectedColumn(null);

    if (univerAPI) {
      try {
        const activeWb = univerAPI.getActiveWorkbook?.();
        const allSheets = activeWb?.getSheets?.() || [];
        const targetSheet =
          activeWb?.getSheetByName?.(sheetName) ||
          activeWb?.getSheetBySheetId?.(sheetName) ||
          allSheets.find((s: any) => s.getSheetName?.() === sheetName || s.getSheetId?.() === sheetName);
        if (targetSheet && activeWb?.setActiveSheet) {
          activeWb.setActiveSheet(targetSheet);
        }
      } catch (err) {
        console.warn("Could not switch Univer active sheet:", err);
      }
    }
  };

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
      const univerData = convertToUniverWorkbook(updatedWb, ejWb, selectedProject?.editableRanges);
      setUniverSnapshot(univerData);
      return { wb: updatedWb, ejWb };
    } catch (e) {
      console.error("Failed to load workbook states", e);
      throw e;
    }
  };

  // Đồng bộ và lưu cell sửa đổi
  const saveCellUpdate = async (sheetName: string, cellRef: string, newValue: string) => {
    if (!selectedProject || !workbook || !exceljsWorkbook) return;

    if (locked) {
      toast.error("Báo giá đã khóa, không thể chỉnh sửa.");
      if (univerAPI) {
        try {
          const ws = workbook.Sheets[sheetName];
          const cellObj = ws ? ws[cellRef] : null;
          const origVal = cellObj && cellObj.v !== undefined && cellObj.v !== null ? cellObj.v : "";
          const activeWb = univerAPI.getActiveWorkbook?.();
          const sheet = activeWb?.getSheetByName?.(sheetName) || activeWb?.getActiveSheet?.();
          const decoded = XLSX.utils.decode_cell(cellRef);
          sheet?.getRange?.(decoded.r, decoded.c)?.setValue?.(origVal);
        } catch {}
      }
      return;
    }

    const rangeStr = getEditableRange(selectedProject, sheetName);
    if (!isCellInEditableRange(cellRef, rangeStr)) {
      toast.error(`Bạn không có quyền sửa ô ${cellRef} (Vùng được cấp quyền: ${rangeStr || "Không có"})`);
      if (univerAPI) {
        try {
          const ws = workbook.Sheets[sheetName];
          const cellObj = ws ? ws[cellRef] : null;
          const origVal = cellObj && cellObj.v !== undefined && cellObj.v !== null ? cellObj.v : "";
          const activeWb = univerAPI.getActiveWorkbook?.();
          const sheet = activeWb?.getSheetByName?.(sheetName) || activeWb?.getActiveSheet?.();
          const decoded = XLSX.utils.decode_cell(cellRef);
          sheet?.getRange?.(decoded.r, decoded.c)?.setValue?.(origVal);
        } catch {}
      }
      return;
    }

    const ws = workbook.Sheets[sheetName];
    const cellObj = ws ? ws[cellRef] : null;
    const oldValue = cellObj && cellObj.v !== undefined && cellObj.v !== null ? String(cellObj.v) : "";
    const strNewVal = newValue !== null && newValue !== undefined ? String(newValue) : "";

    if (oldValue === strNewVal) return;

    pushToHistory(selectedProject.fileBase64);

    try {
      const editData = {
        userId: user?.id,
        username: user?.username,
        sheetName,
        cell: cellRef,
        oldValue,
        newValue: strNewVal,
      };

      const savedEdit = await api.saveEdit(selectedProject.id, editData);
      setEdits((prev) => [...prev, savedEdit]);

      applyEditsToWorkbook(workbook, [savedEdit]);

      const ejWs = exceljsWorkbook.getWorksheet(sheetName);
      if (ejWs) {
        updateMergedCellInExcelJS(ejWs, cellRef, strNewVal);
      }

      const updatedBase64 = await workbookToBase64(exceljsWorkbook);
      await api.updateProjectFile(selectedProject.id, updatedBase64, workbook.SheetNames);
      setSelectedProject((prev: any) => (prev ? { ...prev, fileBase64: updatedBase64 } : null));

      if (activeSheet === sheetName) {
        setSheetData(getSheetData(workbook, sheetName));
      }

      // Sync live cell value to Univer if active
      if (univerAPI) {
        try {
          const activeWb = univerAPI.getActiveWorkbook?.();
          const ws = activeWb?.getSheetByName?.(sheetName) || activeWb?.getActiveSheet?.();
          const { r: row, c: col } = XLSX.utils.decode_cell(cellRef);
          const fRange = ws?.getRange?.(row, col);
          if (fRange?.setValue) {
            fRange.setValue(strNewVal);
          }
        } catch (err) {
          console.warn("Could not sync cell to Univer:", err);
        }
      }

      const newUniverData = convertToUniverWorkbook(workbook, exceljsWorkbook, selectedProject?.editableRanges);
      setUniverSnapshot(newUniverData);

      toast.success(`Đã lưu ô ${cellRef}: ${strNewVal}`);
    } catch (error: any) {
      toast.error(error.message || "Lưu thay đổi thất bại");
    }
  };

  const handleUniverCellChange = (sheetName: string, cellRef: string, newValue: any) => {
    saveCellUpdate(sheetName, cellRef, String(newValue ?? ""));
  };

  const handleStandardCellEdit = (r: number, c: number, newValue: string) => {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    saveCellUpdate(activeSheet, cellRef, newValue);
  };

  // Hoàn tác (Undo)
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
      setSelectedProject((prev: any) => (prev ? { ...prev, fileBase64: previousBase64 } : null));
      toast.success("Đã hoàn tác thao tác vừa rồi!");
    } catch (error) {
      console.error(error);
      toast.error("Không thể hoàn tác!");
    }
  };

  // Thêm dòng
  const handleAddRow = async () => {
    if (!workbook || !selectedProject) return;

    let targetRowIndex = sheetData.length;
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
      toast.success(`Đã thêm dòng số ${targetRowIndex + 1} thành công`);
      setRowInsertIndex("");
      setSelectedProject((prev: any) => (prev ? { ...prev, fileBase64: newBase64 } : null));
    } catch (error) {
      console.error(error);
      toast.error("Thêm dòng thất bại!");
    }
  };

  // Xóa dòng
  const handleDeleteRow = async () => {
    if (!workbook || !selectedProject) return;
    if (sheetData.length === 0) {
      toast.error("Bảng tính không có dòng nào để xóa!");
      return;
    }

    let targetRowIndex = sheetData.length - 1;
    if (rowInsertIndex.trim()) {
      const idx = parseInt(rowInsertIndex.trim(), 10) - 1;
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
      setRowInsertIndex("");
      setSelectedProject((prev: any) => (prev ? { ...prev, fileBase64: newBase64 } : null));
    } catch (error) {
      console.error(error);
      toast.error("Xóa dòng thất bại!");
    }
  };

  // Thêm cột
  const handleAddColumn = async () => {
    if (!workbook || !selectedProject) return;

    let targetColIndex: number | undefined = undefined;
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
      toast.success(`Đã thêm cột ở vị trí ${posLabel} thành công`);
      setColInsertIndex("");
      setSelectedProject((prev: any) => (prev ? { ...prev, fileBase64: newBase64 } : null));
    } catch (error) {
      console.error(error);
      toast.error("Thêm cột thất bại!");
    }
  };

  // Xóa cột
  const handleDeleteColumn = async () => {
    if (!workbook || !selectedProject) return;
    const colCount = sheetData[0]?.length || 0;
    if (colCount === 0) {
      toast.error("Bảng tính không có cột nào để xóa!");
      return;
    }

    let targetColIndex = colCount - 1;
    if (colInsertIndex.trim()) {
      const normalized = colInsertIndex.trim().toUpperCase();
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
      setColInsertIndex("");
      setSelectedProject((prev: any) => (prev ? { ...prev, fileBase64: newBase64 } : null));
    } catch (error) {
      console.error(error);
      toast.error("Xóa cột thất bại!");
    }
  };

  // Tìm & Thay thế
  const handleSearchReplace = async () => {
    if (!searchQuery || !selectedProject || !workbook || !exceljsWorkbook) return;
    if (locked) {
      toast.error("Báo giá đã khóa, không thể chỉnh sửa.");
      return;
    }
    const rangeStr = getEditableRange(selectedProject, activeSheet);

    let replacedCount = 0;
    const newEdits: any[] = [];
    const newData = [...sheetData];

    const escapedSearchQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedSearchQuery, matchCase ? "g" : "gi");

    for (let r = 0; r < newData.length; r++) {
      if (!newData[r]) continue;
      let rowCopied = false;
      for (let c = 0; c < newData[r].length; c++) {
        const cellValue = String(newData[r][c] || "");
        if (cellValue.match(searchRegex)) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (isCellInRange(cellRef, rangeStr)) {
            if (!rowCopied) {
              newData[r] = [...newData[r]];
              rowCopied = true;
            }
            const newValue = cellValue.replace(searchRegex, replaceQuery);
            newData[r][c] = newValue;

            newEdits.push({
              userId: user?.id,
              username: user?.username,
              sheetName: activeSheet,
              cell: cellRef,
              oldValue: cellValue,
              newValue,
            });
            replacedCount++;
          }
        }
      }
    }

    if (replacedCount > 0) {
      setSheetData(newData);
      for (const edit of newEdits) {
        const savedEdit = await api.saveEdit(selectedProject.id, edit);
        setEdits((prev) => [...prev, savedEdit]);
        applyEditsToWorkbook(workbook, [savedEdit]);

        const ejWs = exceljsWorkbook.getWorksheet(edit.sheetName);
        if (ejWs) {
          updateMergedCellInExcelJS(ejWs, edit.cell, edit.newValue);
        }
      }

      const newUniverData = convertToUniverWorkbook(workbook, exceljsWorkbook);
      setUniverSnapshot(newUniverData);

      setIsFindReplaceOpen(false);
      toast.success(`Đã thay thế thành công ${replacedCount} vị trí.`);
    } else {
      toast.info("Không tìm thấy nội dung phù hợp trong vùng được phép sửa.");
    }
  };

 
  const handleExport = async () => {
    if (!selectedProject || !exceljsWorkbook) return;
    setIsExporting(true);
    try {
      // Synchronize latest styling, font colors, background colors, and values from Univer
      let currentSnapshot = univerSnapshot;
      if (univerAPI) {
        try {
          const activeWb = univerAPI.getActiveWorkbook?.();
          const snap = activeWb?.save?.() || activeWb?.getSnapshot?.();
          if (snap) currentSnapshot = snap;
        } catch (e) {
          console.warn("Could not retrieve active workbook snapshot from API:", e);
        }
      }

      if (currentSnapshot) {
        syncUniverToExcelJS(currentSnapshot, exceljsWorkbook);
      }

      const base64 = await workbookToBase64(exceljsWorkbook);
      const filename = selectedProject.name?.replace(/\.xlsx$/i, "") || "BaoGia";
      downloadBase64File(base64, filename);
      toast.success("Đã tải tệp Excel thành công (đầy đủ màu sắc, định dạng & nội dung).");
    } catch (e) {
      console.error(e);
      toast.error("Không thể xuất tệp Excel!");
    } finally {
      setIsExporting(false);
    }
  };
//     const handleExport = async () => {
//     // 2. Sử dụng univerAPI tại đây
//     if (!selectedProject || !exceljsWorkbook || !univerAPI) return;
    
//     try {
//       // Lấy snapshot chứa toàn bộ định dạng màu sắc, cỡ chữ
//       const currentUniverSnapshot = univerAPI.getActiveWorkbook().save();

//       // Đồng bộ đè lên ExcelJS
//       const updatedExcelJS = syncUniverToExcelJS(currentUniverSnapshot, exceljsWorkbook);

//       // Xuất file
//       const buffer = await updatedExcelJS.xlsx.writeBuffer();
//       const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
//       const url = window.URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = `${selectedProject.name}_formatted.xlsx`;
//       a.click();
//       window.URL.revokeObjectURL(url);
//     } catch (error) {
//       console.error("Lỗi:", error);
//     }
//   };

//   return (
//     // ... giao diện ...
//     <UniverSpreadsheet 
//       initialData={buildUniverData(sheetData, activeSheet)}
//       onReady={(api) => setUniverAPI(api)} // 3. Bắt lấy API khi Univer render xong
//     />
//   );
//}
  const currentEditableRange = useMemo(() => {
    if (!selectedProject || !activeSheet) return "";
    return getEditableRange(selectedProject, activeSheet);
  }, [selectedProject, activeSheet]);

  return (
    <UserLayout
      username={user?.username}
      selectedProject={selectedProject}
      pendingCount={stats.dangXuLy}
      activeTab={activeTab}
      isMobileOpen={showMobileNav}
      isCollapsed={isSidebarCollapsed}
      onTabChange={(t) => {
        if (t === "file") {
          setIsDialogOpen(true);
        } else {
          setActiveTab(t);
        }
      }}
      onMobileOpenChange={setShowMobileNav}
      onToggleNavigation={() => {
        if (window.innerWidth >= 768) setIsSidebarCollapsed((prev) => !prev);
        else setShowMobileNav(true);
      }}
      onProfile={() => navigate(ROUTES.profile)}
      onLogout={logout}
    >
      {activeTab === "dashboard" ? (
        <UserHome
          projects={projects}
          edits={edits}
          selectedProject={selectedProject}
          onSelectProject={handleSelectProject}
          onOpenProjects={() => {
            setIsDialogOpen(true);
          }}
        />
      ) : (
        <div className="flex h-full flex-col bg-[#f4f8ff] overflow-hidden">
          {/* Top Ribbon Toolbar matching Admin exactly */}
          <div className="bg-white flex flex-col shrink-0 border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="h-24 bg-white px-3 py-1 flex items-start gap-3 overflow-x-auto custom-scrollbar">
              {/* Group 1: Cấu hình & Logs */}
              <div className="flex flex-col items-center shrink-0">
                <Button
                  variant="ghost"
                  onClick={() => setIsConfigDialogOpen(true)}
                  disabled={!selectedProject}
                  className="h-14 w-20 flex flex-col gap-1 rounded-lg hover:bg-amber-50 text-slate-700 disabled:opacity-40"
                >
                  <Settings className="w-6 h-6 text-amber-600" strokeWidth={1.5} />
                  <span className="text-[10px] font-semibold leading-none">Cấu hình</span>
                </Button>
                <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-bold">Cài đặt & logs</div>
              </div>

              <div className="w-px h-14 bg-slate-200 mx-1 shrink-0 self-center" />

              {/* Group 2: Chỉnh sửa (Dòng, Cột, Hoàn tác, Tìm/Thay thế) */}
              <div className="flex flex-col items-center shrink-0">
                <div className="flex h-14 items-center gap-1.5">
                  {/* Row & Col buttons */}
                  <div className="flex flex-col gap-1 border-r border-slate-200 pr-2 mr-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 w-7">Dòng</span>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Vị trí..."
                        value={rowInsertIndex}
                        onChange={(e) => setRowInsertIndex(e.target.value)}
                        disabled={!selectedProject || locked}
                        className="w-14 h-6 text-[10px] py-0 px-1.5 bg-slate-50 border-slate-200"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleAddRow}
                        disabled={!selectedProject || locked}
                        className="h-6 w-6 text-indigo-600 hover:bg-indigo-50"
                        title="Thêm dòng"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleDeleteRow}
                        disabled={!selectedProject || locked}
                        className="h-6 w-6 text-red-600 hover:bg-red-50"
                        title="Xóa dòng"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 w-7">Cột</span>
                      <Input
                        type="text"
                        placeholder="Vị trí..."
                        value={colInsertIndex}
                        onChange={(e) => setColInsertIndex(e.target.value)}
                        disabled={!selectedProject || locked}
                        className="w-14 h-6 text-[10px] py-0 px-1.5 bg-slate-50 border-slate-200 uppercase"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleAddColumn}
                        disabled={!selectedProject || locked}
                        className="h-6 w-6 text-indigo-600 hover:bg-indigo-50"
                        title="Thêm cột"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleDeleteColumn}
                        disabled={!selectedProject || locked}
                        className="h-6 w-6 text-red-600 hover:bg-red-50"
                        title="Xóa cột"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Undo Button */}
                  <Button
                    variant="ghost"
                    onClick={handleUndo}
                    disabled={history.length === 0 || locked}
                    className="h-14 w-16 flex flex-col gap-1 rounded-lg text-slate-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40"
                  >
                    <Undo className="w-5 h-5" strokeWidth={1.5} />
                    <span className="text-[10px] font-semibold leading-none">Hoàn tác</span>
                  </Button>

                  {/* Find & Replace Button */}
                  {!locked && selectedProject && (
                    <Button
                      variant="ghost"
                      onClick={() => setIsFindReplaceOpen(true)}
                      className="h-14 w-16 flex flex-col gap-1 rounded-lg text-blue-600 hover:bg-blue-50"
                    >
                      <Replace className="w-5 h-5" strokeWidth={1.5} />
                      <span className="text-[10px] font-semibold leading-none">Tìm/Thay</span>
                    </Button>
                  )}
                </div>
                <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-bold">Chỉnh sửa</div>
              </div>

              <div className="w-px h-14 bg-slate-200 mx-1 shrink-0 self-center" />

              {/* Group 3: Chế độ xem & Bộ lọc */}
              <div className="flex flex-col items-center shrink-0">
                <div className="flex h-14 items-center gap-2 px-1">
                  {/* Row count filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-8">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={previewLimit === -1 ? "all" : previewLimit}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPreviewLimit(val === "all" ? -1 : Number(val));
                      }}
                      className="border-none bg-transparent text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value={10}>10 dòng</option>
                      <option value={20}>20 dòng</option>
                      <option value={55}>55 dòng</option>
                      <option value={100}>100 dòng</option>
                      <option value="all">Tất cả</option>
                    </select>
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-bold">Giới hạn xem</div>
              </div>

              <div className="w-px h-14 bg-slate-200 mx-1 shrink-0 self-center" />

              {/* Group 4: Quy trình & Xuất file */}
              {selectedProject && (
                <div className="flex flex-col items-center shrink-0">
                  <div className="flex h-14 items-center gap-2">
                    <StatusWorkflow
                      project={selectedProject}
                      role="user"
                      onUpdated={(p) => {
                        setSelectedProject(p);
                        loadProjects();
                      }}
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      disabled={isExporting}
                      className="h-8 gap-1.5 rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-bold px-3 shadow-xs"
                    >
                      <Download className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-xs">Tải Excel</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!printProjectAsPdf(selectedProject, sheetData, activeSheet)) {
                          toast.error("Trình duyệt chặn cửa sổ in PDF");
                        }
                      }}
                      className="h-8 gap-1.5 rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-bold px-3 shadow-xs"
                    >
                      <Printer className="h-3.5 w-3.5 text-rose-600" />
                      <span className="text-xs">Xuất PDF</span>
                    </Button>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-bold">Quy trình & xuất</div>
                </div>
              )}
            </div>
          </div>

          {/* Full-screen Spreadsheet Area */}
          <div className="flex-1 bg-slate-200 p-2 overflow-hidden flex flex-col">
            {!selectedProject ? (
              <div className="flex-1 flex flex-col items-center justify-center border border-slate-300 rounded-xl bg-white shadow-sm">
                <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0b4f9c] mb-4 shadow-xs">
                  <FileSpreadsheet className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-base text-slate-800 mb-1">Chưa chọn báo giá</h3>
                <p className="text-xs text-slate-500 mb-4 max-w-sm text-center">
                  Mở danh sách báo giá để xem và điền dữ liệu vào các ô được phân quyền.
                </p>
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  className="gap-2 bg-[#0b4f9c] hover:bg-[#083f7d] text-white font-bold rounded-xl px-5 h-10 shadow-sm"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Mở danh sách báo giá</span>
                </Button>
              </div>
            ) : (
              <div className="flex-1 bg-white shadow-xl rounded-xl border border-slate-300 flex flex-col overflow-hidden">
                {/* Multi-Sheet Tabs Bar visible for both Standard and Univer views */}
                <div className="bg-slate-100 border-b flex px-2 pt-2 gap-1 overflow-x-auto shrink-0 custom-scrollbar">
                  {selectedProject.sheets?.map((sheet: string) => (
                    <button
                      key={sheet}
                      onClick={() => handleTabChange(sheet)}
                      className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border border-b-0 ${
                        activeSheet === sheet
                          ? "bg-white text-[#0b4f9c] border-slate-300 relative translate-y-[1px] shadow-2xs"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300 border-transparent"
                      }`}
                    >
                      {sheet}
                    </button>
                  ))}
                </div>

                {/* Univer Spreadsheet View (Exclusive & High-Performance) */}
                <div className="flex-1 w-full h-full overflow-hidden flex flex-col relative">
                  <div className="flex-1 w-full h-full overflow-hidden relative">
                    {univerSnapshot ? (
                      <UniverSpreadsheet
                        key={selectedProject.id}
                        initialData={univerSnapshot}
                        activeSheet={activeSheet}
                        mode="user"
                        locked={locked}
                        editableRange={currentEditableRange}
                        onReady={(api) => setUniverAPI(api)}
                        onCellChange={handleUniverCellChange}
                        onSheetChange={handleTabChange}
                        onDataChange={(snapshot) => {
                          setUniverSnapshot(snapshot);
                        }}
                        className="w-full h-full min-h-[560px]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400 font-semibold text-sm">
                        Đang chuẩn bị bảng tính Univer...
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 border-t px-4 py-1.5 shrink-0 flex justify-between items-center text-[11px] text-slate-600 font-medium">
                    <span>
                      {locked ? (
                        <span className="text-amber-700 font-bold">Báo giá đã khóa, chế độ chỉ xem.</span>
                      ) : (
                        "Double-click vào ô được cấp quyền để chỉnh sửa văn bản/dữ liệu."
                      )}
                    </span>
                    <span>
                      {currentEditableRange ? (
                        <span className="text-emerald-700 font-bold">
                          Vùng ô bạn được phép sửa ({activeSheet}): {currentEditableRange}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Không có vùng ô nào được mở quyền sửa ở sheet này.</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CẤU HÌNH & NHẬT KÝ */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="sm:max-w-3xl w-full max-h-[90vh] overflow-y-auto bg-slate-50">
          <DialogHeader>
            <DialogTitle>Thông tin Báo giá & Nhật ký chỉnh sửa</DialogTitle>
          </DialogHeader>

          {selectedProject && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {/* Left: Info */}
              <div className="space-y-4">
                <Card className="shadow-xs border-slate-200 bg-white">
                  <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50">
                    <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Thông tin chung
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium">Tên file:</span>{" "}
                      <strong className="text-slate-900">{selectedProject.name}</strong>
                    </div>
                    {selectedProject.soBaoGia && (
                      <div>
                        <span className="text-slate-500 font-medium">Số báo giá:</span>{" "}
                        <strong>{selectedProject.soBaoGia}</strong>
                      </div>
                    )}
                    {selectedProject.tenKhachHang && (
                      <div>
                        <span className="text-slate-500 font-medium">Khách hàng:</span>{" "}
                        <strong>{selectedProject.tenKhachHang}</strong>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 font-medium">Trạng thái:</span>{" "}
                      <StatusBadge status={selectedProject.trangThai as TrangThai} />
                    </div>
                    {currentEditableRange && (
                      <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800">
                        <span className="font-bold">Vùng được sửa ({activeSheet}):</span> {currentEditableRange}
                      </div>
                    )}
                    {selectedProject.ghiChu && (
                      <div className="italic text-slate-600">
                        <span className="font-semibold">Ghi chú:</span> {selectedProject.ghiChu}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right: Edits log */}
              <div>
                <Card className="shadow-xs border-slate-200 bg-white h-full">
                  <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50">
                    <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Lịch sử chỉnh sửa ({edits.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    {edits.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic text-center py-4">Chưa có chỉnh sửa nào.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar pr-0.5">
                        {edits.map((ed: any, idx: number) => (
                          <div key={idx} className="text-[11px] p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#0b4f9c]">{ed.username || "Nhân viên"}</span>
                              <span className="text-[9px] text-slate-400">
                                {ed.timestamp ? new Date(ed.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>
                            </div>
                            <div className="text-slate-700">
                              Ô <span className="font-mono font-bold">{ed.cell}</span> ({ed.sheetName}):
                            </div>
                            <div className="truncate text-slate-600">
                              <span className="line-through text-rose-500 mr-1">{ed.oldValue || "(trống)"}</span> →{" "}
                              <span className="font-bold text-emerald-600">{ed.newValue || "(trống)"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL MỞ / CHỌN BÁO GIÁ HIỆN ĐẠI & RỘNG RÃI */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl p-0 border border-slate-200 shadow-2xl bg-white flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#0b4f9c] shadow-xs">
                <FolderOpen className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Danh sách Báo giá được giao</h2>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-[#0b4f9c]">
                    {filteredProjects.length} file
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Chọn báo giá để mở bảng tính, cập nhật dữ liệu vào các ô được phân quyền và xuất file Excel.
                </p>
              </div>
            </div>
            {/* Đã xóa <DialogClose> chứa icon <X /> ở đây */}
          </div>

          {/* Quick Filter Tabs */}
          <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  filterStatus === "all"
                    ? "bg-[#0b4f9c] text-white shadow-sm shadow-blue-500/20"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Tất cả ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("moi_tao")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  filterStatus === "moi_tao"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Mới giao ({stats.moiGiao})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("dang_thuc_hien")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  filterStatus === "dang_thuc_hien"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Đang thực hiện ({stats.dangXuLy})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("da_duyet")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  filterStatus === "da_duyet"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Đã duyệt / Gửi khách ({stats.daDuyet})
              </button>
            </div>

            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Hiển thị {filteredProjects.length} / {projects.length} báo giá
            </span>
          </div>

          {/* Search bar */}
          <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-100 bg-white shrink-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tìm kiếm báo giá theo tên file, số báo giá, tên khách hàng, ghi chú..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="h-12 pl-12 pr-10 text-sm sm:text-base rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#0b4f9c] focus:ring-4 focus:ring-[#0b4f9c]/10"
              />
              {searchQ && (
                <button
                  type="button"
                  onClick={() => setSearchQ("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Projects List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/40">
            {filteredProjects.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800 mb-1">Không tìm thấy báo giá nào</h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  Không có file báo giá nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredProjects.map((p) => {
                  const isCurrent = selectedProject?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProject(p.id)}
                      className={`group relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                        isCurrent
                          ? "bg-blue-50/70 border-[#0b4f9c] shadow-md ring-2 ring-[#0b4f9c]/30"
                          : "bg-white border-slate-200 hover:border-[#0b4f9c]/60 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5"
                      }`}
                    >
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-xs transition-colors ${
                            isCurrent
                              ? "bg-[#0b4f9c] text-white"
                              : "bg-emerald-100 text-emerald-700 group-hover:bg-[#0b4f9c] group-hover:text-white"
                          }`}
                        >
                          <FileSpreadsheet className="h-6 w-6" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#0b4f9c] transition-colors truncate">
                              {p.name}
                            </h3>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-[#0b4f9c]">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Đang mở
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-600 mt-2">
                            {p.soBaoGia && (
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg font-medium border border-slate-200/80">
                                <Hash className="h-3.5 w-3.5 text-slate-400" />
                                <span>Số: <strong>{p.soBaoGia}</strong></span>
                              </span>
                            )}
                            {p.tenKhachHang && (
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg font-medium border border-slate-200/80">
                                <Building className="h-3.5 w-3.5 text-slate-400" />
                                <span>KH: <strong>{p.tenKhachHang}</strong></span>
                              </span>
                            )}
                            {p.updated_at && (
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg font-medium border border-slate-200/80 text-slate-500">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                <span>Cập nhật: {formatDate(p.updated_at)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                        <StatusBadge status={p.trangThai as TrangThai} />
                        <Button
                          type="button"
                          className={`gap-1.5 rounded-xl h-10 px-4 text-xs sm:text-sm font-bold shadow-xs transition-all ${
                            isCurrent
                              ? "bg-[#0b4f9c] text-white hover:bg-[#083f7d]"
                              : "bg-slate-100 text-slate-800 hover:bg-[#0b4f9c] hover:text-white group-hover:bg-[#0b4f9c] group-hover:text-white"
                          }`}
                        >
                          <span>{isCurrent ? "Đang mở" : "Mở bảng tính"}</span>
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 shrink-0">
            <span className="text-xs text-slate-400">
              Nhấn vào bất kỳ báo giá nào ở trên để mở bảng tính làm việc ngay.
            </span>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-xl h-10 px-5 text-slate-600 font-semibold">
                Đóng cửa sổ
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL TÌM & THAY THẾ */}
      <Dialog open={isFindReplaceOpen} onOpenChange={setIsFindReplaceOpen}>
        <DialogContent className="w-full max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Tìm & thay thế (chỉ ô được phép)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Tìm kiếm</label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nội dung cần tìm..."
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Thay thế bằng</label>
              <Input
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder="Nội dung thay thế..."
                className="h-10 rounded-xl"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="userMatchCase"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="rounded border-slate-300 w-4 h-4 text-[#0b4f9c] focus:ring-[#0b4f9c]"
              />
              <label htmlFor="userMatchCase" className="text-xs font-medium text-slate-700 select-none">
                Phân biệt chữ hoa / chữ thường
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFindReplaceOpen(false)}
                className="rounded-xl h-10 text-xs font-semibold"
              >
                Hủy
              </Button>
              <Button
                type="button"
                onClick={handleSearchReplace}
                className="rounded-xl h-10 px-5 bg-[#0b4f9c] hover:bg-[#083f7d] text-white text-xs font-bold"
              >
                Thay thế tất cả
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </UserLayout>
  );
}

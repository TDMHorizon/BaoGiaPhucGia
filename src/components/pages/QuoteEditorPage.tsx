import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import {
  FolderOpen,
  Settings,
  FileText,
  Undo,
  Plus,
  Minus,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  Download,
  Printer,
  Sliders,
  CheckCircle,
  AlertCircle,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Users,
  Sigma,
  FunctionSquare,
  Check,
  X,
  Search,
  Home,
  Shield,
  Lock,
  Unlock,
  FileUp,
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { getSocket, joinProjectRoom, leaveProjectRoom } from "../../lib/socket";
import {
  insertRowWithExcelJS,
  insertColWithExcelJS,
  loadExcelJSWorkbook,
  updateMergedCellInExcelJS,
  workbookToBase64,
} from "../../lib/exceljs-helper";
import {
  fileToBase64,
  getSheetData,
  applyEditsToWorkbook,
  downloadBase64File,
  parseExcel,
  generateExcelBase64,
} from "../../lib/excel";
import { isCellDisabled } from "../../lib/utils-excel";
import { evaluateCellValue } from "../../lib/formulaEvaluator";
import { SpreadsheetViewer } from "../SpreadsheetViewer";
import { ActiveEditor } from "../SpreadsheetViewer/components/Cell";
import { ProjectMetaForm } from "../ProjectMetaForm";
import { StatusWorkflow } from "../StatusWorkflow";
import { StatusBadge } from "../StatusBadge";
import { TemplateLibrary } from "../TemplateLibrary";
import { AuditLogsModal } from "../AuditLogsModal";
import { VisualConflictResolverModal, type ConflictInfo } from "../VisualConflictResolverModal";
import { EditorInspector } from "../editor/EditorInspector";
import { printProjectAsPdf } from "../../lib/printPdf";
import { TRANG_THAI_LABELS, type TrangThai } from "../../lib/constants";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "../ui/dialog";
import { ROUTES } from "../../router";

export type SaveStatus = "saved" | "saving" | "unsaved" | "error" | "conflict";

interface SelectedCellState {
  r: number;
  c: number;
  coord: string;
  rawValue: string;
}

export const QuoteEditorPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "manager";

  // Project & Access State
  const [project, setProject] = useState<any>(null);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [searchProjectQ, setSearchProjectQ] = useState("");
  const [filterProjectStatus, setFilterProjectStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  // Ribbon Dialog States
  const [activeRibbonTab, setActiveRibbonTab] = useState<string>("home");
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isDeletedProjectsDialogOpen, setIsDeletedProjectsDialogOpen] = useState(false);
  const [deletedProjects, setDeletedProjects] = useState<any[]>([]);

  // Excel State
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [exceljsWorkbook, setExceljsWorkbook] = useState<ExcelJS.Workbook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [ranges, setRanges] = useState<Record<string, string>>({});
  const [disabledRanges, setDisabledRanges] = useState<Record<string, any>>({});
  const [edits, setEdits] = useState<any[]>([]);
  const [cellRevisions, setCellRevisions] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [previewLimit, setPreviewLimit] = useState<number>(55);
  const [activeEditors, setActiveEditors] = useState<Record<string, ActiveEditor>>({});

  // Active Cell & Formula Bar State
  const [selectedCell, setSelectedCell] = useState<SelectedCellState | null>(null);
  const [formulaBarInput, setFormulaBarInput] = useState<string>("");
  const formulaInputRef = useRef<HTMLInputElement>(null);

  // Conflict Resolution State (Chương 13 & 14)
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);

  // Drag selection for Admin range configuration
  const [dragStart, setDragStart] = useState<{ r: number; c: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ r: number; c: number } | null>(null);

  // Inspector & Context State
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [selectedCellInfo, setSelectedCellInfo] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Insertion indexes
  const [rowInsertIndex, setRowInsertIndex] = useState<string>("");
  const [colInsertIndex, setColInsertIndex] = useState<string>("");

  const pushToHistory = (fileBase64: string) => {
    if (!fileBase64) return;
    setHistory((prev) => [...prev, fileBase64]);
  };

  const updateWorkbookStateAndExcelJS = async (base64: string, applyEditsList: any[] = []) => {
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
  };

  const loadProjectsList = async () => {
    try {
      const data = await api.getProjects({ q: searchProjectQ || undefined, status: filterProjectStatus || undefined });
      setProjectsList(data || []);
    } catch {
      setProjectsList([]);
    }
  };

  useEffect(() => {
    if (isProjectDialogOpen) {
      loadProjectsList();
    }
  }, [isProjectDialogOpen, searchProjectQ, filterProjectStatus]);

  // 1. Load Project Data
  const loadProjectData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const proj = await api.getProject(projectId);
      setProject(proj);
      setRanges(proj.editableRanges || {});
      setDisabledRanges(proj.disabledRanges || {});

      // Permission check for user role
      if (user?.role === "user") {
        const isOwner = proj.nguoi_phu_trach_id === user.id || proj.nguoiPhuTrachId === user.id;
        const isMember = Array.isArray(proj.memberIds) && proj.memberIds.includes(user.id);
        if (!isOwner && !isMember) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      }

      // Load edits & cell revisions & users
      const [editsList, cellValuesMap, usersList] = await Promise.all([
        api.getEdits(projectId).catch(() => []),
        api.getCellValues(projectId).catch(() => ({})),
        api.getActiveUsers().catch(() => []),
      ]);
      setEdits(editsList || []);
      setAllUsers(usersList || []);

      const revs: Record<string, number> = {};
      for (const [s, cells] of Object.entries(cellValuesMap as any)) {
        for (const [c, info] of Object.entries(cells as any)) {
          revs[`${s}!${c}`] = (info as any).revision;
        }
      }
      setCellRevisions(revs);

      // Join socket room
      joinProjectRoom(projectId);

      // Load workbook
      if (proj.fileBase64) {
        const { wb } = await updateWorkbookStateAndExcelJS(proj.fileBase64, editsList || []);
        if (wb.SheetNames.length > 0) {
          const initialSheet = wb.SheetNames[0];
          setActiveSheet(initialSheet);
          const sData = getSheetData(wb, initialSheet);
          setSheetData(sData);

          // Default selected cell to A1 if data exists
          if (sData.length > 0 && sData[0]?.length > 0) {
            const rawVal = sData[0][0] !== undefined ? String(sData[0][0]) : "";
            setSelectedCell({ r: 0, c: 0, coord: "A1", rawValue: rawVal });
            setFormulaBarInput(rawVal);
          }
        }
      }
    } catch (e: any) {
      console.error("Failed to load quote editor:", e);
      if (e?.status === 403) setAccessDenied(true);
      else toast.error(e?.message || "Lỗi tải bảng tính");
    } finally {
      setLoading(false);
    }
  }, [projectId, user]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  // 2. Realtime Socket.IO Sync (Multiplayer Presence & Edits)
  useEffect(() => {
    if (!projectId) return;
    const socket = getSocket();

    const handleCellUpdated = (payload: any) => {
      if (payload.projectId !== projectId) return;
      setCellRevisions((prev) => ({
        ...prev,
        [`${payload.sheetName}!${payload.cell}`]: payload.revision,
      }));
      setEdits((prev) => [...prev, payload]);

      if (workbook) {
        applyEditsToWorkbook(workbook, [payload]);
      }
      if (exceljsWorkbook) {
        try {
          const ws = exceljsWorkbook.getWorksheet(payload.sheetName);
          if (ws) updateMergedCellInExcelJS(ws, payload.cell, payload.newValue);
        } catch { }
      }

      if (payload.sheetName === activeSheet) {
        const parsed = XLSX.utils.decode_cell(payload.cell);
        setSheetData((prev) => {
          const copy = [...prev];
          if (!copy[parsed.r]) copy[parsed.r] = [];
          else copy[parsed.r] = [...copy[parsed.r]];
          copy[parsed.r][parsed.c] = payload.newValue;
          return copy;
        });

        // If currently focused on this cell, update formula bar
        setSelectedCell((curr) => {
          if (curr && curr.coord === payload.cell) {
            setFormulaBarInput(payload.newValue);
            return { ...curr, rawValue: payload.newValue };
          }
          return curr;
        });
      }

      setActiveEditors((prev) => {
        const copy = { ...prev };
        delete copy[`${payload.sheetName}!${payload.cell}`];
        delete copy[payload.cell];
        return copy;
      });

      if (payload.userId !== user?.id) {
        toast.info(
          `${payload.updatedBy || "Thành viên"} vừa cập nhật ô ${payload.cell} (${payload.sheetName}): "${payload.newValue}"`
        );
      }
    };

    const handleCellFocused = (payload: any) => {
      if (payload?.projectId !== projectId) return;
      if (payload?.user?.id === user?.id) return;
      const keyFull = `${payload.sheetName}!${payload.cell}`;
      const keyShort = payload.cell;
      setActiveEditors((prev) => ({
        ...prev,
        [keyFull]: {
          userId: payload.user.id,
          username: payload.user.username,
          color: payload.user.color || "#6366f1",
        },
        ...(payload.sheetName === activeSheet
          ? {
            [keyShort]: {
              userId: payload.user.id,
              username: payload.user.username,
              color: payload.user.color || "#6366f1",
            },
          }
          : {}),
      }));
    };

    const handleCellBlurred = (payload: any) => {
      if (payload?.projectId !== projectId) return;
      const keyFull = `${payload.sheetName}!${payload.cell}`;
      const keyShort = payload.cell;
      setActiveEditors((prev) => {
        const next = { ...prev };
        delete next[keyFull];
        delete next[keyShort];
        return next;
      });
    };

    const handleRangesUpdated = (payload: any) => {
      if (payload.projectId === projectId) {
        setRanges(payload.editableRanges || {});
        setProject((prev: any) => (prev ? { ...prev, editableRanges: payload.editableRanges } : null));
        toast.info("Phạm vi quyền sửa của báo giá vừa được cập nhật.");
      }
    };

    const handleStatusUpdated = (payload: any) => {
      if (payload.projectId === projectId) {
        setProject((prev: any) => (prev ? { ...prev, trangThai: payload.status } : null));
        toast.info(
          `Trạng thái báo giá đã chuyển sang: ${TRANG_THAI_LABELS[payload.status as TrangThai] || payload.status}`
        );
      }
    };

    const handleRangeDisabled = (payload: any) => {
      if (payload?.projectId !== projectId) return;
      const newConfig = payload.disabledRanges || {};
      setDisabledRanges(newConfig);
      setProject((prev: any) => (prev ? { ...prev, disabledRanges: newConfig } : null));
      toast.info(`Quản trị viên đã vô hiệu hóa vùng tại sheet ${payload.sheetName || activeSheet}`);
    };

    const handleRangeEnabled = (payload: any) => {
      if (payload?.projectId !== projectId) return;
      const newConfig = payload.disabledRanges || {};
      setDisabledRanges(newConfig);
      setProject((prev: any) => (prev ? { ...prev, disabledRanges: newConfig } : null));
      toast.success(`Quản trị viên đã khôi phục vùng tại sheet ${payload.sheetName || activeSheet}`);
    };

    socket.on("cell.updated", handleCellUpdated);
    socket.on("cell_focused", handleCellFocused);
    socket.on("cell_blurred", handleCellBlurred);
    socket.on("ranges.updated", handleRangesUpdated);
    socket.on("status.updated", handleStatusUpdated);
    socket.on("range.disabled", handleRangeDisabled);
    socket.on("project:range:disabled", handleRangeDisabled);
    socket.on("range.enabled", handleRangeEnabled);
    socket.on("project:range:enabled", handleRangeEnabled);

    return () => {
      socket.off("cell.updated", handleCellUpdated);
      socket.off("cell_focused", handleCellFocused);
      socket.off("cell_blurred", handleCellBlurred);
      socket.off("ranges.updated", handleRangesUpdated);
      socket.off("status.updated", handleStatusUpdated);
      socket.off("range.disabled", handleRangeDisabled);
      socket.off("project:range:disabled", handleRangeDisabled);
      socket.off("range.enabled", handleRangeEnabled);
      socket.off("project:range:enabled", handleRangeEnabled);
      leaveProjectRoom(projectId);
    };
  }, [projectId, activeSheet, workbook, exceljsWorkbook, user?.id]);

  // 3. Switch sheet
  const handleSheetChange = (sheetName: string) => {
    if (!workbook) return;
    setActiveSheet(sheetName);
    const sData = getSheetData(workbook, sheetName);
    setSheetData(sData);
    setSelectedCellInfo(null);
    setDragStart(null);
    setDragEnd(null);

    // Reset selected cell to A1
    if (sData.length > 0 && sData[0]?.length > 0) {
      const rawVal = sData[0][0] !== undefined ? String(sData[0][0]) : "";
      setSelectedCell({ r: 0, c: 0, coord: "A1", rawValue: rawVal });
      setFormulaBarInput(rawVal);
    }
  };

  // 4. Handle Cell Edit & Conflict Resolution
  const handleCellEdit = async (r: number, c: number, newValue: string) => {
    if (!projectId || !workbook) return;
    const cellRef = XLSX.utils.encode_cell({ r, c });
    const sheetName = activeSheet;

    // Check if cell is disabled logically (UC04 T10)
    if (isCellDisabled(sheetName, cellRef, disabledRanges)) {
      toast.error(`Ô ${cellRef} đã bị vô hiệu hóa logic bởi Quản trị viên (UC04 T10)!`);
      return;
    }

    const ws = workbook.Sheets[sheetName];
    const cellObj = ws ? ws[cellRef] : null;
    const oldValue = cellObj && cellObj.v !== undefined && cellObj.v !== null ? String(cellObj.v) : "";
    if (oldValue === newValue) return;

    if (project?.fileBase64) {
      pushToHistory(project.fileBase64);
    }

    setSaveStatus("saving");

    // Optimistic UI update
    const newSheetData = [...sheetData];
    if (!newSheetData[r]) newSheetData[r] = [];
    else newSheetData[r] = [...newSheetData[r]];
    newSheetData[r][c] = newValue;
    setSheetData(newSheetData);

    // Update selected cell state & formula bar
    setSelectedCell({ r, c, coord: cellRef, rawValue: newValue });
    setFormulaBarInput(newValue);

    const cellKey = `${sheetName}!${cellRef}`;
    const expectedRevision = cellRevisions[cellKey] ?? 0;

    const editData = {
      sheetName,
      cell: cellRef,
      oldValue,
      newValue: newValue || "",
      username: user?.username || (isAdmin ? "Admin" : "User"),
      timestamp: new Date().toISOString(),
    };

    try {
      const savedEdit = await api.saveEdit(projectId, editData, expectedRevision);
      setSaveStatus("saved");
      setEdits((prev) => [...prev, savedEdit]);
      setCellRevisions((prev) => ({ ...prev, [cellKey]: savedEdit.revision }));

      applyEditsToWorkbook(workbook, [savedEdit]);

      if (exceljsWorkbook) {
        try {
          const ejWs = exceljsWorkbook.getWorksheet(sheetName);
          if (ejWs) {
            updateMergedCellInExcelJS(ejWs, cellRef, newValue);
          }
        } catch (ejErr) {
          console.warn("ExcelJS update cell skipped:", ejErr);
        }
      }

      toast.success(newValue === "" ? `Đã xoá ô ${cellRef}` : `Đã lưu ô ${cellRef}`);
    } catch (e: any) {
      console.error("Save edit error:", e);
      if (
        e.status === 409 ||
        e.data?.conflict ||
        e.message?.includes("Xung đột") ||
        e.message?.includes("Conflict")
      ) {
        setSaveStatus("conflict");
        const conflictData = e.data || {};
        const serverVal = conflictData.latestValue !== undefined ? String(conflictData.latestValue) : "";
        const serverRev =
          typeof conflictData.latestRevision === "number" ? conflictData.latestRevision : expectedRevision + 1;
        const serverUser = conflictData.updatedBy || "người khác";

        // Revert UI cell to server value
        const revertedData = [...sheetData];
        if (revertedData[r]) {
          revertedData[r] = [...revertedData[r]];
          revertedData[r][c] = serverVal;
          setSheetData(revertedData);
        }

        setCellRevisions((prev) => ({ ...prev, [cellKey]: serverRev }));

        // Trigger Visual Conflict Resolver Modal (Chương 13 & 14)
        setConflictInfo({
          cell: cellRef,
          sheetName,
          serverValue: serverVal,
          serverRevision: serverRev,
          serverUpdatedBy: serverUser,
          clientValue: newValue,
          oldValue,
        });

        toast.error(
          `Xung đột (409): Ô ${cellRef} vừa được ${serverUser} lưu giá trị khác. Vui lòng chọn cách hợp nhất!`
        );
      } else if (e?.status === 403) {
        setSaveStatus("error");
        const revertedData = [...sheetData];
        if (revertedData[r]) {
          revertedData[r] = [...revertedData[r]];
          revertedData[r][c] = oldValue;
          setSheetData(revertedData);
        }
        toast.error(e?.data?.error || "Bạn không có quyền chỉnh sửa ô này!");
      } else {
        setSaveStatus("error");
        const revertedData = [...sheetData];
        if (revertedData[r]) {
          revertedData[r] = [...revertedData[r]];
          revertedData[r][c] = oldValue;
          setSheetData(revertedData);
        }
        toast.error(e.message || "Lỗi khi lưu dữ liệu!");
      }
    }
  };

  // 5. Handle Conflict Resolution (Apply merge choice)
  const handleResolveConflict = async (chosenValue: string, expectedRevision: number) => {
    if (!conflictInfo || !projectId || !workbook) return;
    const { cell, sheetName, oldValue } = conflictInfo;
    const coords = XLSX.utils.decode_cell(cell);

    const newData = [...sheetData];
    if (!newData[coords.r]) newData[coords.r] = [];
    else newData[coords.r] = [...newData[coords.r]];
    newData[coords.r][coords.c] = chosenValue;
    setSheetData(newData);

    try {
      const editData = {
        sheetName,
        cell,
        oldValue: oldValue || "",
        newValue: chosenValue,
        username: user?.username || (isAdmin ? "Admin" : "User"),
      };
      const savedEdit = await api.saveEdit(projectId, editData, expectedRevision);
      setEdits((prev) => [...prev, savedEdit]);
      setCellRevisions((prev) => ({ ...prev, [`${sheetName}!${cell}`]: savedEdit.revision }));
      applyEditsToWorkbook(workbook, [savedEdit]);

      if (exceljsWorkbook) {
        try {
          const ejWs = exceljsWorkbook.getWorksheet(sheetName);
          if (ejWs) {
            updateMergedCellInExcelJS(ejWs, cell, chosenValue);
          }
        } catch (ejErr) {
          console.warn("ExcelJS update cell skipped:", ejErr);
        }
      }
      setSaveStatus("saved");
      toast.success(`Đã hợp nhất và lưu giá trị ô ${cell}: "${chosenValue}"`);
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu giá trị đã giải quyết xung đột.");
    } finally {
      setConflictInfo(null);
    }
  };

  // 6. Handle Cell Selection & Focus (Formula Bar Sync)
  const handleCellClick = (r: number, c: number, cellRef: string, val: string) => {
    const rawVal = sheetData[r]?.[c] !== undefined ? String(sheetData[r][c]) : val;
    setSelectedCell({ r, c, coord: cellRef, rawValue: rawVal });
    setFormulaBarInput(rawVal);

    // Also populate inspector details
    const ws = workbook?.Sheets?.[activeSheet];
    const cellObj = ws ? ws[cellRef] : null;
    const { displayValue, isFormula } = evaluateCellValue(rawVal, sheetData);

    setSelectedCellInfo({
      coord: cellRef,
      row: r + 1,
      col: XLSX.utils.encode_col(c),
      value: displayValue,
      rawValue: rawVal,
      formula: isFormula ? rawVal : undefined,
      type: cellObj?.t || "s",
      isFormula,
      isMerged: false,
    });
  };

  const handleCellFocus = (r: number, c: number, cell: string) => {
    const rawVal = sheetData[r]?.[c] !== undefined ? String(sheetData[r][c]) : "";
    setSelectedCell({ r, c, coord: cell, rawValue: rawVal });
    setFormulaBarInput(rawVal);

    if (projectId) {
      const socket = getSocket();
      socket.emit("cell_focused", {
        projectId,
        sheetName: activeSheet,
        cell,
        user: { id: user?.id, username: user?.username },
      });
    }
  };

  const handleCellBlur = (r: number, c: number, cell: string) => {
    if (projectId) {
      const socket = getSocket();
      socket.emit("cell_blurred", {
        projectId,
        sheetName: activeSheet,
        cell,
      });
    }
  };

  // 7. Formula Bar Submit / Cancel / Insert Function
  const handleFormulaBarSubmit = () => {
    if (!selectedCell) {
      toast.info("Vui lòng nhấp chọn một ô để nhập công thức!");
      return;
    }
    handleCellEdit(selectedCell.r, selectedCell.c, formulaBarInput);
  };

  const handleFormulaBarCancel = () => {
    if (selectedCell) {
      setFormulaBarInput(selectedCell.rawValue);
    }
  };

  const handleInsertFunction = (fnName: string) => {
    if (!selectedCell) {
      toast.warning("Vui lòng chọn một ô trên bảng tính trước khi chèn hàm!");
      return;
    }

    const { r, c } = selectedCell;
    const colLetter = XLSX.utils.encode_col(c);
    let formulaTemplate = `=${fnName}()`;

    if (fnName === "SUM" || fnName === "AVERAGE" || fnName === "COUNT" || fnName === "MAX" || fnName === "MIN") {
      // Suggest summing cells above current cell if row > 0
      if (r > 0) {
        formulaTemplate = `=${fnName}(${colLetter}1:${colLetter}${r})`;
      } else {
        formulaTemplate = `=${fnName}(${colLetter}1:${colLetter}10)`;
      }
    } else if (fnName === "IF") {
      formulaTemplate = `=${fnName}(${colLetter}1>0, "Đạt", "Không đạt")`;
    } else if (fnName === "ROUND") {
      formulaTemplate = `=${fnName}(${colLetter}1, 2)`;
    } else if (fnName === "CONCAT") {
      formulaTemplate = `=${fnName}(A1, " ", B1)`;
    }

    setFormulaBarInput(formulaTemplate);
    handleCellEdit(r, c, formulaTemplate);
    toast.success(`Đã chèn hàm ${fnName} vào ô ${selectedCell.coord}`);
    if (formulaInputRef.current) {
      formulaInputRef.current.focus();
    }
  };

  // 8. Visual Selection Range Configuration for Admin
  const appendRange = (newRangePart: string) => {
    if (!activeSheet) return;
    const current = ranges[activeSheet] ? ranges[activeSheet].split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (!current.includes(newRangePart)) {
      current.push(newRangePart);
      const updated = { ...ranges, [activeSheet]: current.join(", ") };
      setRanges(updated);
      if (projectId) {
        api.updateRanges(projectId, updated).then(() => {
          toast.success(`Đã cấp quyền vùng "${newRangePart}" cho sheet ${activeSheet}`);
        });
      }
    }
  };

  const handleColumnClick = (colIndex: number) => {
    if (!isAdmin) return;
    const colLetter = XLSX.utils.encode_col(colIndex);
    setDragStart(null);
    setDragEnd(null);
    appendRange(`${colLetter}:${colLetter}`);
  };

  const handleRowClick = (rowIndex: number) => {
    if (!isAdmin) return;
    const rowNumber = rowIndex + 1;
    setDragStart(null);
    setDragEnd(null);
    appendRange(`${rowNumber}:${rowNumber}`);
  };

  const handleCellMouseDown = (r: number, c: number) => {
    if (!isAdmin) return;
    setDragStart({ r, c });
    setDragEnd({ r, c });
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (!isAdmin || !dragStart) return;
    setDragEnd({ r, c });
  };

  const handleCellMouseUp = () => {
    if (!isAdmin || !dragStart || !dragEnd) {
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
    const rangePart = r1 === r2 && c1 === c2 ? start : `${start}:${end}`;
    appendRange(rangePart);

    setDragStart(null);
    setDragEnd(null);
  };

  // 9. Structural Row & Column Insertion
  const handleAddRow = async () => {
    if (!workbook || !project) return;
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

    if (targetRowIndex < sheetData.length && edits.length > 0) {
      toast.warning(
        "Báo giá đã có dữ liệu chỉnh sửa! Để tránh làm dịch chuyển tọa độ dòng, bạn nên thêm dòng ở cuối bảng tính hoặc sử dụng cơ chế Vô hiệu hóa dòng.",
        { duration: 6000 }
      );
    }

    pushToHistory(project.fileBase64);

    try {
      const newBase64 = await insertRowWithExcelJS(project.fileBase64, activeSheet, targetRowIndex);
      const { wb } = await updateWorkbookStateAndExcelJS(newBase64, edits);
      setSheetData(getSheetData(wb, activeSheet));

      await api.updateProjectFile(project.id, newBase64, wb.SheetNames);
      toast.success(`Đã thêm dòng số ${targetRowIndex + 1} thành công (Giữ nguyên định dạng & hình ảnh!)`);
      setRowInsertIndex("");
      setProject((prev: any) => (prev ? { ...prev, fileBase64: newBase64 } : null));
    } catch (error) {
      console.error(error);
      toast.error("Thêm dòng thất bại (Vui lòng thử lại!)");
    }
  };

  const handleAddColumn = async () => {
    if (!workbook || !project) return;
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

    pushToHistory(project.fileBase64);

    try {
      const colIdxToInsert = targetColIndex !== undefined ? targetColIndex : colCount;
      const newBase64 = await insertColWithExcelJS(project.fileBase64, activeSheet, colIdxToInsert);
      const { wb } = await updateWorkbookStateAndExcelJS(newBase64, edits);
      setSheetData(getSheetData(wb, activeSheet));

      await api.updateProjectFile(project.id, newBase64, wb.SheetNames);
      const posLabel = targetColIndex !== undefined ? XLSX.utils.encode_col(targetColIndex) : "cuối";
      toast.success(`Đã thêm cột ở vị trí ${posLabel} thành công (Giữ nguyên định dạng!)`);
      setColInsertIndex("");
      setProject((prev: any) => (prev ? { ...prev, fileBase64: newBase64 } : null));
    } catch (error) {
      console.error(error);
      toast.error("Thêm cột thất bại (Vui lòng thử lại!)");
    }
  };

  // 10. Undo Operation
  const handleUndo = async () => {
    if (history.length === 0 || !project) return;
    const previousBase64 = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    try {
      const { wb } = await updateWorkbookStateAndExcelJS(previousBase64, edits);
      await api.updateProjectFile(project.id, previousBase64, wb.SheetNames);

      setHistory(newHistory);
      if (wb.SheetNames.includes(activeSheet)) {
        setSheetData(getSheetData(wb, activeSheet));
      } else if (wb.SheetNames.length > 0) {
        setActiveSheet(wb.SheetNames[0]);
        setSheetData(getSheetData(wb, wb.SheetNames[0]));
      }
      setProject((prev: any) => (prev ? { ...prev, fileBase64: previousBase64 } : null));
      toast.success("Đã hoàn tác thao tác vừa rồi!");
    } catch (error) {
      console.error(error);
      toast.error("Không thể hoàn tác!");
    }
  };

  // 11. Logical Disable / Enable (UC04 T10)
  const handleDisableRow = async () => {
    if (!projectId || !activeSheet) return;
    const inputVal = rowInsertIndex.trim();
    let rowNum: number | undefined = undefined;
    if (inputVal) {
      rowNum = parseInt(inputVal, 10);
    } else if (selectedCell?.coord) {
      const match = selectedCell.coord.match(/^([A-Z]+)(\d+)$/);
      if (match) rowNum = parseInt(match[2], 10);
    }

    if (!rowNum || isNaN(rowNum) || rowNum <= 0) {
      toast.warning("Vui lòng click vào một ô hoặc nhập số dòng cần vô hiệu hóa!");
      return;
    }

    try {
      const res = await api.disableRange(projectId, {
        sheetName: activeSheet,
        type: "ROW",
        target: rowNum,
      });
      setDisabledRanges(res.disabledRanges);
      setProject((prev: any) => (prev ? { ...prev, disabledRanges: res.disabledRanges } : null));
      toast.success(`Đã vô hiệu hóa dòng ${rowNum} thành công (giữ nguyên tọa độ bảng tính)`);
      setRowInsertIndex("");
    } catch (e: any) {
      toast.error(e?.message || "Vô hiệu hóa dòng thất bại!");
    }
  };

  const handleEnableRow = async () => {
    if (!projectId || !activeSheet) return;
    const inputVal = rowInsertIndex.trim();
    let rowNum: number | undefined = undefined;
    if (inputVal) {
      rowNum = parseInt(inputVal, 10);
    } else if (selectedCell?.coord) {
      const match = selectedCell.coord.match(/^([A-Z]+)(\d+)$/);
      if (match) rowNum = parseInt(match[2], 10);
    }

    if (!rowNum || isNaN(rowNum) || rowNum <= 0) {
      toast.warning("Vui lòng click vào một ô hoặc nhập số dòng cần khôi phục!");
      return;
    }

    try {
      const res = await api.enableRange(projectId, {
        sheetName: activeSheet,
        type: "ROW",
        target: rowNum,
      });
      setDisabledRanges(res.disabledRanges);
      setProject((prev: any) => (prev ? { ...prev, disabledRanges: res.disabledRanges } : null));
      toast.success(`Đã khôi phục dòng ${rowNum} thành công!`);
      setRowInsertIndex("");
    } catch (e: any) {
      toast.error(e?.message || "Khôi phục dòng thất bại!");
    }
  };

  const handleDisableCol = async () => {
    if (!projectId || !activeSheet) return;
    const inputVal = colInsertIndex.trim().toUpperCase();
    let colLetter: string | undefined = undefined;
    if (inputVal) {
      if (/^\d+$/.test(inputVal)) {
        const colIdx = parseInt(inputVal, 10) - 1;
        if (colIdx >= 0) colLetter = XLSX.utils.encode_col(colIdx);
      } else {
        colLetter = inputVal;
      }
    } else if (selectedCell?.coord) {
      const match = selectedCell.coord.match(/^([A-Z]+)(\d+)$/);
      if (match) colLetter = match[1];
    }

    if (!colLetter) {
      toast.warning("Vui lòng click vào một ô hoặc nhập tên cột cần vô hiệu hóa!");
      return;
    }

    try {
      const res = await api.disableRange(projectId, {
        sheetName: activeSheet,
        type: "COLUMN",
        target: colLetter,
      });
      setDisabledRanges(res.disabledRanges);
      setProject((prev: any) => (prev ? { ...prev, disabledRanges: res.disabledRanges } : null));
      toast.success(`Đã vô hiệu hóa cột ${colLetter} thành công (giữ nguyên tọa độ bảng tính)`);
      setColInsertIndex("");
    } catch (e: any) {
      toast.error(e?.message || "Vô hiệu hóa cột thất bại!");
    }
  };

  const handleEnableCol = async () => {
    if (!projectId || !activeSheet) return;
    const inputVal = colInsertIndex.trim().toUpperCase();
    let colLetter: string | undefined = undefined;
    if (inputVal) {
      if (/^\d+$/.test(inputVal)) {
        const colIdx = parseInt(inputVal, 10) - 1;
        if (colIdx >= 0) colLetter = XLSX.utils.encode_col(colIdx);
      } else {
        colLetter = inputVal;
      }
    } else if (selectedCell?.coord) {
      const match = selectedCell.coord.match(/^([A-Z]+)(\d+)$/);
      if (match) colLetter = match[1];
    }

    if (!colLetter) {
      toast.warning("Vui lòng click vào một ô hoặc nhập tên cột cần khôi phục!");
      return;
    }

    try {
      const res = await api.enableRange(projectId, {
        sheetName: activeSheet,
        type: "COLUMN",
        target: colLetter,
      });
      setDisabledRanges(res.disabledRanges);
      setProject((prev: any) => (prev ? { ...prev, disabledRanges: res.disabledRanges } : null));
      toast.success(`Đã khôi phục cột ${colLetter} thành công!`);
      setColInsertIndex("");
    } catch (e: any) {
      toast.error(e?.message || "Khôi phục cột thất bại!");
    }
  };

  const handleDisableCell = async () => {
    if (!projectId || !activeSheet) return;
    const rangeToDisable = (() => {
      if (dragStart && dragEnd) {
        const r1 = Math.min(dragStart.r, dragEnd.r);
        const r2 = Math.max(dragStart.r, dragEnd.r);
        const c1 = Math.min(dragStart.c, dragEnd.c);
        const c2 = Math.max(dragStart.c, dragEnd.c);
        if (r1 === r2 && c1 === c2) return XLSX.utils.encode_cell({ r: r1, c: c1 });
        return `${XLSX.utils.encode_cell({ r: r1, c: c1 })}:${XLSX.utils.encode_cell({ r: r2, c: c2 })}`;
      }
      return selectedCell?.coord || "";
    })();

    if (!rangeToDisable) {
      toast.warning("Vui lòng click chọn ô hoặc kéo chọn vùng cần khóa!");
      return;
    }

    try {
      let lastConfig = disabledRanges;
      if (rangeToDisable.includes(":")) {
        const [start, end] = rangeToDisable.split(":");
        const s = XLSX.utils.decode_cell(start);
        const e = XLSX.utils.decode_cell(end);
        for (let r = s.r; r <= e.r; r++) {
          for (let c = s.c; c <= e.c; c++) {
            const cell = XLSX.utils.encode_cell({ r, c });
            const res = await api.disableRange(projectId, {
              sheetName: activeSheet,
              type: "CELL",
              target: cell,
            });
            lastConfig = res.disabledRanges;
          }
        }
      } else {
        const res = await api.disableRange(projectId, {
          sheetName: activeSheet,
          type: "CELL",
          target: rangeToDisable,
        });
        lastConfig = res.disabledRanges;
      }
      setDisabledRanges(lastConfig);
      setProject((prev: any) => (prev ? { ...prev, disabledRanges: lastConfig } : null));
      toast.success(`Đã khóa ô/vùng ${rangeToDisable}`);
    } catch (e: any) {
      toast.error(e?.message || "Khóa ô thất bại");
    }
  };

  const handleEnableCell = async () => {
    if (!projectId || !activeSheet) return;
    const rangeToEnable = (() => {
      if (dragStart && dragEnd) {
        const r1 = Math.min(dragStart.r, dragEnd.r);
        const r2 = Math.max(dragStart.r, dragEnd.r);
        const c1 = Math.min(dragStart.c, dragEnd.c);
        const c2 = Math.max(dragStart.c, dragEnd.c);
        if (r1 === r2 && c1 === c2) return XLSX.utils.encode_cell({ r: r1, c: c1 });
        return `${XLSX.utils.encode_cell({ r: r1, c: c1 })}:${XLSX.utils.encode_cell({ r: r2, c: c2 })}`;
      }
      return selectedCell?.coord || "";
    })();

    if (!rangeToEnable) {
      toast.warning("Vui lòng click chọn ô hoặc kéo chọn vùng cần mở khóa!");
      return;
    }

    try {
      let lastConfig = disabledRanges;
      if (rangeToEnable.includes(":")) {
        const [start, end] = rangeToEnable.split(":");
        const s = XLSX.utils.decode_cell(start);
        const e = XLSX.utils.decode_cell(end);
        for (let r = s.r; r <= e.r; r++) {
          for (let c = s.c; c <= e.c; c++) {
            const cell = XLSX.utils.encode_cell({ r, c });
            const res = await api.enableRange(projectId, {
              sheetName: activeSheet,
              type: "CELL",
              target: cell,
            });
            lastConfig = res.disabledRanges;
          }
        }
      } else {
        const res = await api.enableRange(projectId, {
          sheetName: activeSheet,
          type: "CELL",
          target: rangeToEnable,
        });
        lastConfig = res.disabledRanges;
      }
      setDisabledRanges(lastConfig);
      setProject((prev: any) => (prev ? { ...prev, disabledRanges: lastConfig } : null));
      toast.success(`Đã mở khóa ô/vùng ${rangeToEnable}`);
    } catch (e: any) {
      toast.error(e?.message || "Mở khóa ô thất bại");
    }
  };

  // 12. Dropzone upload Excel
  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      const wb = await parseExcel(base64);
      const created = await api.createProject(file.name, base64, wb.SheetNames);
      toast.success(`Đã tải lên & tạo dự án "${file.name}"`);
      await loadProjectsList();
      if (created?.id) {
        setIsProjectDialogOpen(false);
        navigate(`/quotes/${created.id}/editor`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Không thể tải file Excel lên");
    }
  };

  const handleCreateBlankProject = async () => {
    const name = window.prompt("Nhập tên báo giá trắng mới (UC01):", "BaoGia_Moi.xlsx");
    if (!name || !name.trim()) return;
    try {
      const created = await api.createBlankProject(name.trim());
      toast.success(`Đã tạo báo giá trắng "${created.name}"`);
      await loadProjectsList();
      if (created?.id) {
        setIsProjectDialogOpen(false);
        navigate(`/quotes/${created.id}/editor`);
      }
    } catch (err: any) {
      toast.error(err.message || "Không thể tạo báo giá trắng");
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa file báo giá này?")) return;
    try {
      await api.deleteProject(id);
      toast.success("Đã xóa file báo giá thành công");
      await loadProjectsList();
      if (id === projectId) {
        navigate(isAdmin ? ROUTES.management : ROUTES.quotes);
      }
    } catch (err: any) {
      toast.error(err.message || "Không thể xóa file");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
  } as any);

  // 13. Export Excel with Disabled Styles (Gray fill)
  const handleExportExcel = async () => {
    if (!project || !workbook) return;
    try {
      if (exceljsWorkbook) {
        if (disabledRanges && typeof disabledRanges === "object") {
          for (const [sName, cfg] of Object.entries(disabledRanges as any)) {
            const ws = exceljsWorkbook.getWorksheet(sName);
            if (!ws) continue;
            const config = cfg as any;
            const disabledFill: any = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF64748B" }, // Slate 500
            };
            if (Array.isArray(config.rows)) {
              for (const r of config.rows) {
                try {
                  const row = ws.getRow(Number(r));
                  if (row) row.eachCell({ includeEmpty: true }, (c) => (c.fill = disabledFill));
                } catch { }
              }
            }
            if (Array.isArray(config.columns)) {
              for (const col of config.columns) {
                try {
                  const column = ws.getColumn(String(col));
                  if (column) column.eachCell({ includeEmpty: true }, (c) => (c.fill = disabledFill));
                } catch { }
              }
            }
            if (Array.isArray(config.cells)) {
              for (const cRef of config.cells) {
                try {
                  const cell = ws.getCell(String(cRef));
                  if (cell) cell.fill = disabledFill;
                } catch { }
              }
            }
          }
        }
        const base64 = await workbookToBase64(exceljsWorkbook);
        downloadBase64File(base64, project.name?.replace(/\.xlsx$/i, "") || "baogia");
        toast.success("Đã xuất tệp Excel thành công (đã áp dụng các ô điền và vô hiệu hóa)!");
        return;
      }

      // Fallback SheetJS export
      const out = generateExcelBase64(workbook);
      downloadBase64File(out, project.name?.replace(/\.xlsx$/i, "") || "baogia");
      toast.success("Đã tải xuống file Excel");
    } catch (e: any) {
      toast.error("Lỗi xuất file: " + e?.message);
    }
  };

  // 14. Print PDF
  const handlePrint = () => {
    if (!project) return;
    printProjectAsPdf(project, sheetData, activeSheet);
  };

  const handleSaveRanges = async () => {
    if (!project) return;
    try {
      await api.updateRanges(project.id, ranges);
      toast.success("Đã cập nhật phạm vi chỉnh sửa thành công!");
    } catch (error) {
      toast.error("Không thể cập nhật phạm vi chỉnh sửa!");
    }
  };

  const loadDeletedProjects = async () => {
    try {
      const data = await api.getDeletedProjects();
      setDeletedProjects(data || []);
    } catch (e: any) {
      toast.error("Không thể tải danh sách file đã xóa");
    }
  };

  const handleRestoreProject = async (id: string) => {
    try {
      await api.restoreProject(id);
      toast.success("Đã khôi phục file báo giá thành công");
      loadDeletedProjects();
    } catch (e: any) {
      toast.error(e.message || "Khôi phục thất bại");
    }
  };

  const renderSaveBadge = () => {
    switch (saveStatus) {
      case "saving":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#105CB3]">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Đang lưu...</span>
          </span>
        );
      case "unsaved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
            <AlertCircle className="h-3 w-3" />
            <span>Chưa lưu</span>
          </span>
        );
      case "conflict":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
            <AlertTriangle className="h-3 w-3" />
            <span>Xung đột dữ liệu</span>
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-600">
            <AlertCircle className="h-3 w-3" />
            <span>Lỗi lưu</span>
          </span>
        );
      case "saved":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle className="h-3 w-3" />
            <span>Đã lưu tự động</span>
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F0F7FF]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#105CB3] border-t-transparent" />
          <p className="text-sm font-semibold text-[#105CB3]">Đang khởi tạo Trình Soạn Thảo Excel...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#F0F7FF] p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Truy Cập Bị Từ Chối (HTTP 403)</h2>
        <p className="mt-2 max-w-md text-xs text-slate-500 leading-relaxed">
          Bạn không được phân công tham gia dự án báo giá này hoặc không có quyền mở hồ sơ.
          Theo nguyên tắc bảo mật của hệ thống, chỉ nhân viên thuộc tổ đội phụ trách mới được xem và soạn thảo.
        </p>
        <Button
          type="button"
          onClick={() => navigate(ROUTES.quotes)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#105CB3] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#268DF0]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại danh sách báo giá của tôi</span>
        </Button>
      </div>
    );
  }

  const assignedMembers = allUsers.filter(
    (u) => Array.isArray(project?.memberIds) && project.memberIds.includes(u.id)
  );
  const nguoiPhuTrach = allUsers.find(
    (u) => u.id === (project?.nguoi_phu_trach_id || project?.nguoiPhuTrachId)
  );

  return (
    <div className="h-screen min-w-0 flex flex-col overflow-x-hidden bg-[#f4f8ff] text-slate-900 font-sans">
      {/* Top Excel Ribbon Matching AdminDashboard */}
      <div className="bg-white flex flex-col shrink-0 border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <Tabs value={activeRibbonTab} onValueChange={setActiveRibbonTab} className="w-full">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-3 py-1 border-b border-slate-200 bg-[#F0F7FF]/50">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(isAdmin ? ROUTES.management : ROUTES.quotes)}
                className="h-8 px-2 text-slate-600 hover:bg-slate-200/60"
                title="Quay lại danh sách báo giá"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1.5 truncate">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-xs text-slate-800 truncate max-w-xs sm:max-w-md">
                  {project?.name || "Báo Giá"}
                </span>
                {project?.trangThai && <StatusBadge status={project.trangThai as TrangThai} />}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {renderSaveBadge()}

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsInspectorOpen((prev) => !prev)}
                className={`h-7 text-xs font-semibold px-2 gap-1.5 ${isInspectorOpen
                    ? "border-blue-300 bg-blue-50 text-[#105CB3]"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                title="Bật/Tắt Contextual Inspector bên phải"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Inspector</span>
              </Button>
            </div>
          </div>

          {/* Ribbon Tab Triggers */}
          <TabsList className="h-10 bg-slate-100/90 border-b border-slate-200/90 rounded-none w-full justify-start px-2 sm:px-4 gap-1 mb-0 overflow-x-auto custom-scrollbar">
            <TabsTrigger
              value="file"
              className={`h-9 px-4 py-1.5 rounded-t-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer select-none border-b-2 shrink-0 ${activeRibbonTab === "file"
                  ? "bg-white text-[#0b4f9c] border-b-[#0b4f9c] shadow-xs font-bold -mb-[1px] z-10"
                  : "text-slate-600 border-b-transparent hover:text-slate-900 hover:bg-slate-200/60"
                }`}
            >
              <FolderOpen className={`w-3.5 h-3.5 ${activeRibbonTab === "file" ? "text-[#0b4f9c]" : "text-slate-500"}`} />
              <span>Tệp</span>
            </TabsTrigger>

            <TabsTrigger
              value="home"
              className={`h-9 px-4 py-1.5 rounded-t-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer select-none border-b-2 shrink-0 ${activeRibbonTab === "home"
                  ? "bg-white text-[#0b4f9c] border-b-[#0b4f9c] shadow-xs font-bold -mb-[1px] z-10"
                  : "text-slate-600 border-b-transparent hover:text-slate-900 hover:bg-slate-200/60"
                }`}
            >
              <Home className={`w-3.5 h-3.5 ${activeRibbonTab === "home" ? "text-[#0b4f9c]" : "text-slate-500"}`} />
              <span>Trang chủ</span>
            </TabsTrigger>

            <TabsTrigger
              value="formulas"
              className={`h-9 px-4 py-1.5 rounded-t-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer select-none border-b-2 shrink-0 ${activeRibbonTab === "formulas"
                  ? "bg-white text-[#0b4f9c] border-b-[#0b4f9c] shadow-xs font-bold -mb-[1px] z-10"
                  : "text-slate-600 border-b-transparent hover:text-slate-900 hover:bg-slate-200/60"
                }`}
            >
              <Sigma className={`w-3.5 h-3.5 ${activeRibbonTab === "formulas" ? "text-indigo-600" : "text-slate-500"}`} />
              <span>Công thức</span>
            </TabsTrigger>

            {isAdmin && (
              <TabsTrigger
                value="admin"
                className={`h-9 px-4 py-1.5 rounded-t-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer select-none border-b-2 shrink-0 ${activeRibbonTab === "admin"
                    ? "bg-white text-[#0b4f9c] border-b-[#0b4f9c] shadow-xs font-bold -mb-[1px] z-10"
                    : "text-slate-600 border-b-transparent hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
              >
                <Shield className={`w-3.5 h-3.5 ${activeRibbonTab === "admin" ? "text-amber-600" : "text-slate-500"}`} />
                <span>Hệ thống</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Ribbon Content Toolbar */}
          <div className="min-h-[92px] min-w-0 bg-gradient-to-b from-white via-slate-50/50 to-slate-100/60 px-3 py-1.5 flex items-center gap-3 overflow-x-auto custom-scrollbar border-b border-slate-200 shadow-inner">
            {/* Tab 1: Tệp */}
            <TabsContent value="file" className="m-0 h-full flex items-center gap-2 data-[state=inactive]:hidden w-full">
              {/* Nhóm Dự án & Tệp tin */}
              <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl p-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="h-11 w-18 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-indigo-50/80 text-slate-700 hover:text-indigo-700">
                      <FolderOpen className="w-5 h-5 text-indigo-600" strokeWidth={1.75} />
                      <span className="text-[10px] font-semibold leading-none">Mở dự án</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Quản lý Báo Giá & Tệp Excel</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-2">
                      <div className="lg:col-span-4 space-y-4">
                        <Card className="shadow-xs border-slate-200 bg-white">
                          <CardHeader className="pb-3 border-b bg-slate-50/50">
                            <CardTitle className="text-xs font-bold text-slate-800">Tải Lên File Excel (.xlsx)</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-3 px-3 pb-3">
                            <div
                              {...getRootProps()}
                              className={`border-2 border-dashed p-4 text-center cursor-pointer rounded-xl transition-all duration-200 ${isDragActive ? "border-blue-500 bg-blue-50/70" : "border-slate-200"
                                }`}
                            >
                              <input {...getInputProps()} />
                              <div className="mx-auto w-8 h-8 rounded-full bg-white flex items-center justify-center border shadow-2xs mb-2">
                                <Plus className="h-4.5 w-4.5 text-indigo-600" />
                              </div>
                              <span className="text-xs font-bold text-slate-700 block mb-0.5">
                                {isDragActive ? "Thả file..." : "Kéo thả file Excel vào đây"}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCreateBlankProject}
                              className="w-full mt-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-dashed border-slate-300 text-slate-700 hover:bg-slate-50"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                              Tạo Báo Giá Trắng Mới (UC01)
                            </Button>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="lg:col-span-8">
                        <Card className="shadow-xs border-slate-200 bg-white h-full flex flex-col">
                          <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <CardTitle className="text-xs font-bold text-slate-800 shrink-0">
                              Danh sách dự án ({projectsList.length})
                            </CardTitle>
                            <div className="flex gap-2">
                              <select
                                value={filterProjectStatus}
                                onChange={(e) => setFilterProjectStatus(e.target.value)}
                                className="border border-slate-200 rounded-md h-7 px-2 text-xs"
                              >
                                <option value="">Tất cả TT</option>
                                {Object.entries(TRANG_THAI_LABELS).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                              <Input
                                placeholder="Tìm tên..."
                                value={searchProjectQ}
                                onChange={(e) => setSearchProjectQ(e.target.value)}
                                className="h-7 w-32 text-xs bg-white"
                              />
                            </div>
                          </CardHeader>
                          <CardContent className="p-0 flex-1 overflow-auto max-h-[400px]">
                            <ul className="divide-y divide-slate-100">
                              {projectsList.map((p) => (
                                <li
                                  key={p.id}
                                  className={`p-3 hover:bg-slate-50 flex justify-between items-center group ${projectId === p.id ? "bg-indigo-50/50" : ""
                                    }`}
                                >
                                  <DialogClose asChild>
                                    <button
                                      type="button"
                                      className="flex-1 cursor-pointer text-left"
                                      onClick={() => {
                                        setIsProjectDialogOpen(false);
                                        navigate(`/quotes/${p.id}/editor`);
                                      }}
                                    >
                                      <p className="font-bold text-slate-800 text-xs mb-0.5 text-left group-hover:text-indigo-600">
                                        {p.name}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <StatusBadge status={p.trangThai as TrangThai} />
                                        <span className="text-[10px] text-slate-400 font-medium">
                                          BG: {p.soBaoGia || "—"}
                                        </span>
                                      </div>
                                    </button>
                                  </DialogClose>
                                  {isAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteProject(p.id)}
                                      className="h-7 px-2 text-red-500 hover:bg-red-50 ml-2 shrink-0"
                                    >
                                      Xóa
                                    </Button>
                                  )}
                                </li>
                              ))}
                              {projectsList.length === 0 && (
                                <li className="p-4 text-center text-xs text-slate-400">Chưa có dự án nào.</li>
                              )}
                            </ul>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Dự án</div>
              </div>

              {/* Nhóm Xuất file & In */}
              <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl p-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    onClick={handleExportExcel}
                    className="h-11 w-18 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-emerald-50/80 text-slate-700 hover:text-emerald-700"
                  >
                    <Download className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                    <span className="text-[10px] font-semibold leading-none">Xuất Excel</span>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handlePrint}
                    className="h-11 w-18 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-blue-50/80 text-slate-700 hover:text-blue-700"
                  >
                    <Printer className="w-5 h-5 text-blue-600" strokeWidth={1.75} />
                    <span className="text-[10px] font-semibold leading-none">In PDF</span>
                  </Button>
                </div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Xuất & In</div>
              </div>

              {/* Nhóm Mẫu Báo Giá (Templates) */}
              {isAdmin && (
                <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl p-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                  <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="h-11 w-18 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-violet-50/80 text-slate-700 hover:text-violet-700">
                        <FileText className="w-5 h-5 text-violet-600" strokeWidth={1.75} />
                        <span className="text-[10px] font-semibold leading-none">Templates</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Thư viện Templates</DialogTitle>
                      </DialogHeader>
                      <TemplateLibrary onCloned={() => loadProjectData()} />
                    </DialogContent>
                  </Dialog>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Mẫu biểu</div>
                </div>
              )}
            </TabsContent>

            {/* Tab 2: Trang Chủ */}
            <TabsContent value="home" className="m-0 h-full flex items-center gap-2 data-[state=inactive]:hidden w-full">
              {/* Nhóm Cấu hình & Trạng thái */}
              <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl p-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="h-11 w-18 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-amber-50/80 text-slate-700 hover:text-amber-700">
                      <Settings className="w-5 h-5 text-amber-600" strokeWidth={1.75} />
                      <span className="text-[10px] font-semibold leading-none">Cấu hình</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-slate-50">
                    <DialogHeader>
                      <DialogTitle>Cấu hình & Nhật ký Báo Giá</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="space-y-4">
                        <ProjectMetaForm
                          project={project}
                          onUpdated={(p) => {
                            setProject(p);
                            loadProjectData();
                            toast.success("Đã cập nhật thông tin báo giá");
                          }}
                          onDeleted={() => {
                            navigate(isAdmin ? ROUTES.management : ROUTES.quotes);
                          }}
                        />

                        <Card className="shadow-xs border-slate-200 bg-white">
                          <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50">
                            <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                              Trạng thái xử lý
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-3">
                            <StatusWorkflow
                              project={project}
                              role={user?.role}
                              onUpdated={(p) => {
                                setProject(p);
                                loadProjectData();
                              }}
                            />
                          </CardContent>
                        </Card>

                        {isAdmin && (
                          <Card className="shadow-xs border-slate-200 bg-white">
                            <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                Vùng ô mở quyền sửa
                              </CardTitle>
                              <Button
                                onClick={handleSaveRanges}
                                size="sm"
                                className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700 px-2 font-bold"
                              >
                                Lưu
                              </Button>
                            </CardHeader>
                            <CardContent className="p-3 space-y-2.5">
                              {project?.sheets?.map((sheet: string) => (
                                <div key={sheet} className="space-y-1">
                                  <span className="text-[11px] font-bold text-slate-700 block truncate">
                                    {sheet}
                                  </span>
                                  <Input
                                    placeholder="Ví dụ: A1:D10, A:A"
                                    value={ranges[sheet] || ""}
                                    onChange={(e) => setRanges({ ...ranges, [sheet]: e.target.value })}
                                    className="h-7 text-xs"
                                  />
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                      <div>
                        <Card className="shadow-xs border-slate-200 bg-white h-full">
                          <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50">
                            <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                              Nhật ký nhân viên ({edits.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-3">
                            {edits.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic text-center py-2">
                                Chưa có chỉnh sửa nào.
                              </p>
                            ) : (
                              <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar pr-0.5">
                                {edits.map((ed: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="text-[11px] p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-indigo-600">{ed.username || "User"}</span>
                                      <span className="text-[9px] text-slate-400">
                                        {new Date(ed.timestamp).toLocaleTimeString("vi-VN", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                    <div className="text-slate-700">
                                      Ô <span className="font-mono font-bold">{ed.cell}</span> ({ed.sheetName}):
                                    </div>
                                    <div className="truncate text-slate-600">
                                      <span className="line-through text-rose-500 mr-1">
                                        {ed.oldValue || "(trống)"}
                                      </span>{" "}
                                      → <span className="font-bold text-emerald-600">{ed.newValue || "(trống)"}</span>
                                    </div>
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
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Cài đặt & Logs</div>
              </div>

              {/* Nhóm Thao tác Dòng & Cột */}
              {isAdmin && (
                <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl px-2.5 py-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                  <div className="flex items-center gap-2">
                    {/* Dòng controls */}
                    <div className="flex items-center gap-1 bg-slate-50/80 border border-slate-200/80 rounded-lg p-1">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Dòng..."
                        value={rowInsertIndex}
                        onChange={(e) => setRowInsertIndex(e.target.value)}
                        className="w-14 h-6 text-[10px] py-0 bg-white border-slate-200"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleAddRow}
                        title="Thêm dòng mới"
                        className="h-6 w-6 text-indigo-600 hover:bg-indigo-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleDisableRow}
                        title="Vô hiệu hóa dòng (giữ nguyên tọa độ)"
                        className="h-6 w-6 text-slate-600 hover:text-red-600 hover:bg-red-50"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleEnableRow}
                        title="Khôi phục dòng đã vô hiệu hóa"
                        className="h-6 w-6 text-emerald-600 hover:bg-emerald-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Cột controls */}
                    <div className="flex items-center gap-1 bg-slate-50/80 border border-slate-200/80 rounded-lg p-1">
                      <Input
                        type="text"
                        placeholder="Cột..."
                        value={colInsertIndex}
                        onChange={(e) => setColInsertIndex(e.target.value)}
                        className="w-14 h-6 text-[10px] py-0 bg-white border-slate-200"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleAddColumn}
                        title="Thêm cột mới"
                        className="h-6 w-6 text-indigo-600 hover:bg-indigo-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleDisableCol}
                        title="Vô hiệu hóa cột (giữ nguyên tọa độ)"
                        className="h-6 w-6 text-slate-600 hover:text-red-600 hover:bg-red-50"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleEnableCol}
                        title="Khôi phục cột đã vô hiệu hóa"
                        className="h-6 w-6 text-emerald-600 hover:bg-emerald-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Thao tác Dòng & Cột</div>
                </div>
              )}

              {/* Nhóm Khóa / Mở Ô */}
              {isAdmin && (
                <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl p-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDisableCell}
                      title="Vô hiệu hóa ô đang chọn"
                      className="h-11 px-2.5 flex flex-col items-center justify-center gap-1 rounded-lg text-slate-700 hover:text-red-600 hover:bg-red-50"
                    >
                      <Lock className="w-4 h-4 text-red-500" />
                      <span className="text-[10px] font-semibold leading-none">Khóa ô</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleEnableCell}
                      title="Khôi phục ô đang chọn"
                      className="h-11 px-2.5 flex flex-col items-center justify-center gap-1 rounded-lg text-slate-700 hover:text-emerald-600 hover:bg-emerald-50"
                    >
                      <Unlock className="w-4 h-4 text-emerald-600" />
                      <span className="text-[10px] font-semibold leading-none">Mở ô</span>
                    </Button>
                  </div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Bảo vệ ô</div>
                </div>
              )}

              {/* Nhóm Hoàn tác */}
              <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl p-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                <Button
                  variant="ghost"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="h-11 w-16 flex flex-col items-center justify-center gap-1 rounded-lg text-slate-700 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-30"
                >
                  <Undo className="w-4 h-4 text-purple-600" />
                  <span className="text-[10px] font-semibold leading-none">Hoàn tác</span>
                </Button>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Lịch sử</div>
              </div>

              {/* Nhóm Chế độ xem */}
              <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl px-2.5 py-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                <div className="flex items-center gap-1.5 h-11">
                  <Filter className="w-4 h-4 text-slate-500 shrink-0" />
                  <select
                    value={previewLimit === -1 ? "all" : previewLimit}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPreviewLimit(val === "all" ? -1 : Number(val));
                    }}
                    className="border border-slate-200 rounded-lg h-7 px-2 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value={10}>10 dòng</option>
                    <option value={20}>20 dòng</option>
                    <option value={55}>55 dòng</option>
                    <option value={100}>100 dòng</option>
                    <option value="all">Tất cả</option>
                  </select>
                </div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Chế độ xem</div>
              </div>
            </TabsContent>

            {/* Tab 3: Công thức (Formulas) */}
            <TabsContent value="formulas" className="m-0 h-full flex items-center gap-2 data-[state=inactive]:hidden w-full">
              {/* Nhóm Hàm tự động */}
              <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl px-2 py-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertFunction("SUM")}
                    className="h-11 px-2.5 flex flex-col items-center justify-center gap-0.5 border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 rounded-lg transition-all"
                    title="Tính tổng các ô"
                  >
                    <Sigma className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-[9px] font-bold">AutoSum</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertFunction("AVERAGE")}
                    className="h-11 px-2 flex flex-col items-center justify-center gap-0.5 border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 rounded-lg transition-all"
                    title="Tính giá trị trung bình"
                  >
                    <span className="text-[10px] font-black text-blue-600 font-mono">AVG</span>
                    <span className="text-[9px] font-medium">Trung bình</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertFunction("COUNT")}
                    className="h-11 px-2 flex flex-col items-center justify-center gap-0.5 border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300 rounded-lg transition-all"
                    title="Đếm số lượng ô có dữ liệu"
                  >
                    <span className="text-[10px] font-black text-emerald-600 font-mono">123</span>
                    <span className="text-[9px] font-medium">Đếm số</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertFunction("MAX")}
                    className="h-11 px-2 flex flex-col items-center justify-center gap-0.5 border-slate-200 bg-white hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 rounded-lg transition-all"
                    title="Tìm giá trị lớn nhất"
                  >
                    <span className="text-[10px] font-black text-amber-600 font-mono">MAX</span>
                    <span className="text-[9px] font-medium">Lớn nhất</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertFunction("MIN")}
                    className="h-11 px-2 flex flex-col items-center justify-center gap-0.5 border-slate-200 bg-white hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 rounded-lg transition-all"
                    title="Tìm giá trị nhỏ nhất"
                  >
                    <span className="text-[10px] font-black text-purple-600 font-mono">MIN</span>
                    <span className="text-[9px] font-medium">Nhỏ nhất</span>
                  </Button>
                </div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Hàm Tự Động</div>
              </div>

              {/* Nhóm Xử lý & Chuỗi */}
              <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl px-2 py-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertFunction("IF")}
                    className="h-11 px-2.5 flex flex-col items-center justify-center gap-0.5 border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 rounded-lg transition-all"
                    title="Hàm điều kiện IF(condition, true_val, false_val)"
                  >
                    <span className="text-[10px] font-black text-rose-600 font-mono">IF</span>
                    <span className="text-[9px] font-medium">Điều kiện</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertFunction("ROUND")}
                    className="h-11 px-2.5 flex flex-col items-center justify-center gap-0.5 border-slate-200 bg-white hover:bg-teal-50 hover:text-teal-600 hover:border-teal-300 rounded-lg transition-all"
                    title="Làm tròn số thập phân"
                  >
                    <span className="text-[10px] font-black text-teal-600 font-mono">~.00</span>
                    <span className="text-[9px] font-medium">Làm tròn</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertFunction("CONCAT")}
                    className="h-11 px-2.5 flex flex-col items-center justify-center gap-0.5 border-slate-200 bg-white hover:bg-cyan-50 hover:text-cyan-600 hover:border-cyan-300 rounded-lg transition-all"
                    title="Ghép chuỗi văn bản"
                  >
                    <span className="text-[10px] font-black text-cyan-600 font-mono">&</span>
                    <span className="text-[9px] font-medium">Nối chuỗi</span>
                  </Button>
                </div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Logic & Chuỗi</div>
              </div>

              {/* Thông tin hỗ trợ cú pháp */}
              <div className="flex flex-col items-start justify-center h-[80px] bg-white/70 border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-2xs text-[11px] text-slate-600 max-w-sm shrink-0">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                  <FunctionSquare className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Biểu thức tính toán động Excel:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-medium border border-indigo-200/60">=SUM(A1:A10)</span>
                  <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-medium border border-blue-200/60">=B2*1.1</span>
                  <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-medium border border-emerald-200/60">=IF(C3&gt;100,"OK","NO")</span>
                </div>
              </div>
            </TabsContent>

            {/* Tab 4: Hệ Thống (Admin Only) */}
            {isAdmin && (
              <TabsContent value="admin" className="m-0 h-full flex items-center gap-2 data-[state=inactive]:hidden w-full">
                {/* Quản lý tài khoản */}
                <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl p-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                  <Button variant="ghost" onClick={() => navigate(ROUTES.accountManagement)} className="h-11 w-18 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-blue-50/80 text-slate-700 hover:text-blue-700">
                    <Users className="w-5 h-5 text-blue-600" strokeWidth={1.75} />
                    <span className="text-[10px] font-semibold leading-none">Tài khoản</span>
                  </Button>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Người dùng</div>
                </div>

                {/* Nhật ký hệ thống */}
                <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl p-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                  <AuditLogsModal
                    trigger={
                      <Button
                        variant="ghost"
                        className="h-11 w-18 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-indigo-50/80 text-slate-700 hover:text-indigo-700"
                      >
                        <Shield className="w-5 h-5 text-indigo-600" strokeWidth={1.75} />
                        <span className="text-[10px] font-semibold leading-none">Nhật ký</span>
                      </Button>
                    }
                  />
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Nhật ký</div>
                </div>

                {/* Khôi phục file */}
                <div className="flex flex-col items-center justify-between h-[80px] bg-white border border-slate-200/80 rounded-xl p-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0">
                  <Dialog open={isDeletedProjectsDialogOpen} onOpenChange={(open) => { setIsDeletedProjectsDialogOpen(open); if (open) loadDeletedProjects(); }}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="h-11 w-20 flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-amber-50/80 text-slate-700 hover:text-amber-700">
                        <RotateCcw className="w-5 h-5 text-amber-600" strokeWidth={1.75} />
                        <span className="text-[10px] font-semibold leading-none">Khôi phục file</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Khôi phục file đã xóa</DialogTitle>
                      </DialogHeader>
                      <div className="mt-2 space-y-2">
                        {deletedProjects.length === 0 ? (
                          <p className="py-8 text-center text-sm text-slate-500">
                            Không có file nào trong danh sách đã xóa.
                          </p>
                        ) : (
                          deletedProjects.map((proj) => (
                            <div key={proj.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                <RotateCcw className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-slate-800">{proj.name}</p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  Đã xóa: {proj.deletedAt ? new Date(proj.deletedAt).toLocaleString("vi-VN") : "Không rõ thời điểm"}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleRestoreProject(proj.id)}
                                className="shrink-0 bg-[#0b4f9c] text-xs hover:bg-[#083f7d]"
                              >
                                Khôi phục
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Thùng rác</div>
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>

        {/* Excel Formula Bar (Thanh fx) */}
        <div className="bg-slate-50/90 backdrop-blur-xs border-t border-slate-200 px-3 py-1.5 flex items-center gap-2 text-xs shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          {/* Name Box: Coordinates (e.g. A1) */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs min-w-[70px] max-w-[90px] justify-center">
            <span className="font-mono font-bold text-[#0b4f9c] text-xs">
              {selectedCell ? selectedCell.coord : "—"}
            </span>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-0.5 hidden sm:block" />

          {/* Action buttons (Check / Cancel) */}
          <div className="flex items-center gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleFormulaBarCancel}
              title="Hủy nhập (Escape)"
              className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleFormulaBarSubmit}
              title="Lưu công thức / giá trị (Enter)"
              className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md"
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* fx symbol */}
          <div className="flex items-center justify-center w-6 h-6 rounded bg-emerald-50 border border-emerald-200/80 text-emerald-700 font-serif italic font-black text-xs select-none shadow-2xs">
            fx
          </div>

          {/* Formula input field */}
          <div className="flex-1 relative flex items-center">
            <input
              ref={formulaInputRef}
              type="text"
              value={formulaBarInput}
              placeholder={selectedCell ? "Nhập giá trị hoặc công thức (ví dụ: =SUM(A1:A10), =B2*1.5)..." : "Nhấp vào ô trên bảng tính để xem hoặc chỉnh sửa..."}
              onChange={(e) => setFormulaBarInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleFormulaBarSubmit();
                } else if (e.key === "Escape") {
                  handleFormulaBarCancel();
                }
              }}
              className="w-full h-7 px-3 py-1 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b4f9c]/20 focus:border-[#0b4f9c] shadow-2xs placeholder:text-slate-400 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Full-screen Spreadsheet Area Matching AdminDashboard */}
      <div className="flex-1 bg-slate-200 p-2 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 bg-white shadow-xl rounded-xl border border-slate-300 flex flex-col overflow-hidden">
          {/* Sheet tabs bar matching AdminDashboard */}
          <div className="min-w-0 bg-slate-100 border-b flex px-2 pt-1.5 gap-1 overflow-x-auto shrink-0 custom-scrollbar justify-between items-center">
            <div className="min-w-0 flex gap-1 overflow-x-auto items-center">
              {project?.sheets?.map((sheet: string) => (
                <button
                  key={sheet}
                  type="button"
                  onClick={() => handleSheetChange(sheet)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors border border-b-0 ${activeSheet === sheet
                      ? "bg-white text-indigo-700 border-slate-300 relative translate-y-[1px]"
                      : "bg-slate-200 text-slate-600 hover:bg-slate-300 border-transparent"
                    }`}
                >
                  {sheet}
                </button>
              ))}
            </div>

            {/* Toolbar phân quyền nhanh cho nhân viên */}
            {isAdmin && (
              <div className="min-w-max flex items-center gap-2 pb-1 pr-2 text-xs">
                <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-600 inline-block" />
                  Vùng cấp quyền ({activeSheet}):
                </span>
                <span
                  className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded max-w-xs truncate"
                  title={ranges[activeSheet] || "Chưa có vùng nào"}
                >
                  {ranges[activeSheet] || "Chưa có (kéo rê chuột để tô)"}
                </span>
                {ranges[activeSheet] && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const updated = { ...ranges, [activeSheet]: "" };
                      setRanges(updated);
                      if (projectId) {
                        api
                          .updateRanges(projectId, updated)
                          .then(() => toast.info(`Đã xóa toàn bộ vùng chọn sheet ${activeSheet}`));
                      }
                    }}
                    className="h-6 text-[10px] text-red-600 hover:bg-red-50 px-1.5 font-medium"
                  >
                    Xóa vùng sheet này
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Interactive Spreadsheet Canvas */}
          <div
            className="flex-1 overflow-hidden flex flex-col relative"
            onMouseUp={handleCellMouseUp}
            onMouseLeave={() => {
              if (dragStart) handleCellMouseUp();
            }}
          >
            {workbook && activeSheet && sheetData.length > 0 ? (
              <SpreadsheetViewer
                workbook={workbook}
                exceljsWorkbook={exceljsWorkbook}
                sheetData={sheetData}
                activeSheet={activeSheet}
                mode={isAdmin ? "admin" : "user"}
                editableRange={ranges[activeSheet] || ""}
                disabledRanges={disabledRanges}
                previewLimit={previewLimit}
                activeEditors={activeEditors}
                selectedRange={
                  dragStart && dragEnd
                    ? `${XLSX.utils.encode_cell({ r: Math.min(dragStart.r, dragEnd.r), c: Math.min(dragStart.c, dragEnd.c) })}:${XLSX.utils.encode_cell({ r: Math.max(dragStart.r, dragEnd.r), c: Math.max(dragStart.c, dragEnd.c) })}`
                    : ""
                }
                onColumnClick={handleColumnClick}
                onRowClick={handleRowClick}
                onCellMouseDown={handleCellMouseDown}
                onCellMouseEnter={handleCellMouseEnter}
                onCellClick={handleCellClick}
                onCellEdit={handleCellEdit}
                onCellFocus={handleCellFocus}
                onCellBlur={handleCellBlur}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Chưa có dữ liệu bảng tính
              </div>
            )}
          </div>

          {/* Bottom Bar matching AdminDashboard */}
          <div className="bg-slate-50 border-t px-4 py-1.5 shrink-0 flex justify-between items-center text-[11px] text-slate-500 font-medium">
            <span>
              Đang hiển thị{" "}
              {previewLimit === -1 ? sheetData.length : Math.min(previewLimit, sheetData.length)} /{" "}
              {sheetData.length} dòng.
              {selectedCell && (
                <span className="ml-3 font-semibold text-slate-700">
                  Ô đang chọn: <span className="font-mono text-indigo-700 font-bold">{selectedCell.coord}</span>
                </span>
              )}
            </span>
            <span className="flex items-center gap-3">
              <span className="text-indigo-700 font-semibold">
                💡 Nhấp đúp (Double-click) vào ô hoặc dùng thanh fx để nhập công thức
              </span>
              {isAdmin && (
                <span>• Click chữ cái cột hoặc kéo rê chuột để phân quyền cho nhân viên</span>
              )}
            </span>
          </div>
        </div>

        {/* Floating Contextual Inspector side panel (if open) */}
        {isInspectorOpen && (
          <div className="fixed right-2 top-40 bottom-2 z-40 shadow-2xl rounded-xl overflow-hidden">
            <EditorInspector
              projectId={projectId!}
              userRole={user?.role}
              currentSheet={activeSheet}
              cellDetails={selectedCellInfo}
              editableRanges={ranges}
              disabledRanges={disabledRanges}
              members={assignedMembers}
              nguoiPhuTrachName={nguoiPhuTrach?.fullName || nguoiPhuTrach?.username}
              editsHistory={edits}
              onUpdateRanges={(updated) => setRanges(updated)}
              onRefreshData={loadProjectData}
              onClose={() => setIsInspectorOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Visual Conflict Resolver Modal (Chương 13 & 14) */}
      <VisualConflictResolverModal
        isOpen={!!conflictInfo}
        onClose={() => setConflictInfo(null)}
        conflict={conflictInfo}
        onResolve={handleResolveConflict}
      />
    </div>
  );
};

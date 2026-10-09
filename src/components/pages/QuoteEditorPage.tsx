import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { getSocket, joinProjectRoom } from "../../lib/socket";
import {
  loadExcelJSWorkbook,
  workbookToBase64,
  updateMergedCellInExcelJS,
  cloneExcelJSWorkbook,
  applyDraftWatermarkToWorkbook,
} from "../../lib/exceljs-helper";
import { getSheetData, applyEditsToWorkbook, downloadBase64File } from "../../lib/excel";
import { isCellDisabled } from "../../lib/utils-excel";
import { SpreadsheetViewer } from "../SpreadsheetViewer";
import { EditorToolbar, type SaveStatus } from "../editor/EditorToolbar";
import { EditorInspector } from "../editor/EditorInspector";
import { ProjectMetaForm } from "../ProjectMetaForm";
import { FiAlertTriangle, FiArrowLeft, FiLock } from "react-icons/fi";

export const QuoteEditorPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  // Excel State
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [exceljsWorkbook, setExceljsWorkbook] = useState<ExcelJS.Workbook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [ranges, setRanges] = useState<Record<string, string>>({});
  const [disabledRanges, setDisabledRanges] = useState<Record<string, any>>({});
  const [edits, setEdits] = useState<any[]>([]);
  const [cellRevisions, setCellRevisions] = useState<Record<string, number>>({});

  // Inspector & Context State
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [selectedCellInfo, setSelectedCellInfo] = useState<any>(null);
  const [selectedRangeCoord, setSelectedRangeCoord] = useState<string>("");
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

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

      // Load edits & cell revisions
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
        let base64 = proj.fileBase64;
        if (base64.includes(",")) base64 = base64.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const wb = XLSX.read(bytes, { type: "array" });
        const updatedWb = applyEditsToWorkbook(wb, editsList || []);
        setWorkbook(updatedWb);

        const ejWb = await loadExcelJSWorkbook(proj.fileBase64);
        (editsList || []).forEach((edit: any) => {
          const ws = ejWb.getWorksheet(edit.sheetName);
          if (ws) {
            updateMergedCellInExcelJS(ws, edit.cell, edit.newValue);
          }
        });
        setExceljsWorkbook(ejWb);

        if (updatedWb.SheetNames.length > 0) {
          const initialSheet = updatedWb.SheetNames[0];
          setActiveSheet(initialSheet);
          setSheetData(getSheetData(updatedWb, initialSheet));
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

  // 2. Realtime Socket.IO Sync
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
        if (payload.sheetName === activeSheet) {
          setSheetData(getSheetData(workbook, activeSheet));
        }
      }
      if (exceljsWorkbook) {
        try {
          const ws = exceljsWorkbook.getWorksheet(payload.sheetName);
          if (ws) updateMergedCellInExcelJS(ws, payload.cell, payload.newValue);
        } catch {}
      }
    };

    const handleRangeDisabled = (payload: any) => {
      if (payload.projectId !== projectId) return;
      setDisabledRanges(payload.disabledRanges);
      toast.info(`Quản trị viên đã vô hiệu hóa vùng tại sheet ${payload.sheetName}`);
    };

    const handleRangeEnabled = (payload: any) => {
      if (payload.projectId !== projectId) return;
      setDisabledRanges(payload.disabledRanges);
      toast.success(`Quản trị viên đã khôi phục vùng tại sheet ${payload.sheetName}`);
    };

    const handleProjectUpdated = (payload: any) => {
      if (payload.projectId !== projectId) return;
      setProject((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...(payload.otHours !== undefined ? { otHours: payload.otHours } : {}),
          ...(payload.otRate !== undefined ? { otRate: payload.otRate } : {}),
          ...(payload.vatRate !== undefined ? { vatRate: payload.vatRate } : {}),
          ...(payload.discountAmount !== undefined ? { discountAmount: payload.discountAmount } : {}),
          ...(payload.financialConfig !== undefined ? { financialConfig: payload.financialConfig } : {}),
          ...(payload.financeRevision !== undefined ? { financeRevision: payload.financeRevision } : {}),
        };
      });
    };

    socket.on("cell.updated", handleCellUpdated);
    socket.on("range.disabled", handleRangeDisabled);
    socket.on("range.enabled", handleRangeEnabled);
    socket.on("project.updated", handleProjectUpdated);

    return () => {
      socket.off("cell.updated", handleCellUpdated);
      socket.off("range.disabled", handleRangeDisabled);
      socket.off("range.enabled", handleRangeEnabled);
      socket.off("project.updated", handleProjectUpdated);
    };
  }, [projectId, activeSheet, workbook, exceljsWorkbook]);

  // 3. Switch sheet
  const handleSheetChange = (sheetName: string) => {
    if (!workbook) return;
    setActiveSheet(sheetName);
    setSheetData(getSheetData(workbook, sheetName));
    setSelectedCellInfo(null);
  };

  // 4. Handle Cell Edit
  const handleCellEdit = async (
    sheetName: string,
    cell: string,
    newValue: any,
    options?: { expectedRevision?: number; batch?: boolean }
  ) => {
    if (!projectId) return;
    // Check if cell is disabled
    if (isCellDisabled(sheetName, cell, disabledRanges)) {
      toast.error(`Ô ${cell} đã bị vô hiệu hóa logic bởi Quản trị viên (UC04 T10)!`);
      return;
    }

    setSaveStatus("saving");
    try {
      const expRev = options?.expectedRevision ?? cellRevisions[`${sheetName}!${cell}`] ?? 0;
      const res = await api.saveEdit(
        projectId,
        {
          sheetName,
          cell,
          newValue: String(newValue ?? ""),
        },
        expRev
      );

      setSaveStatus("saved");
      setCellRevisions((prev) => ({
        ...prev,
        [`${sheetName}!${cell}`]: res.revision,
      }));

      // Update in-memory models
      if (workbook) {
        applyEditsToWorkbook(workbook, [res]);
        if (sheetName === activeSheet) {
          setSheetData(getSheetData(workbook, activeSheet));
        }
      }
      if (exceljsWorkbook) {
        const ws = exceljsWorkbook.getWorksheet(sheetName);
        if (ws) updateMergedCellInExcelJS(ws, cell, newValue);
      }

      // Tự động đồng bộ số giờ OT nếu ô vừa sửa là ô được ánh xạ cho OT (UC06)
      const mapping = project?.financialConfig?.cellMapping;
      if (mapping?.otHoursCell && mapping.otHoursCell.toUpperCase() === cell.toUpperCase()) {
        const parsedHours = parseFloat(String(newValue));
        if (!isNaN(parsedHours) && parsedHours >= 0) {
          setProject((prev: any) => (prev ? { ...prev, otHours: parsedHours } : prev));
          api.updateProject(projectId, { otHours: parsedHours }).catch(() => {});
        }
      }
    } catch (e: any) {
      console.error("Save edit error:", e);
      if (e?.status === 409) {
        setSaveStatus("conflict");
        toast.error("Xung đột phiên bản dữ liệu (HTTP 409). Vui lòng kiểm tra lại!");
      } else if (e?.status === 403) {
        setSaveStatus("error");
        toast.error(e?.data?.error || "Bạn không có quyền chỉnh sửa ô này!");
      } else {
        setSaveStatus("error");
        toast.error("Không thể lưu giá trị ô.");
      }
    }
  };

  // 5. Export Excel with Policy Enforcement [P0-04] and Non-destructive Cloned Workbook [P1-16]
  const handleExportExcel = async () => {
    if (!project || !workbook) return;

    // [P0-04] Kiểm tra thẩm quyền xuất bản chính thức:
    // Chỉ Admin / Manager khi dự án đã phát hành 'da_gui' mới được xuất file trần không Watermark.
    // Nếu chưa đủ điều kiện, tự động chuyển sang luồng xuất bản nháp (Draft Export) có watermark UC17.
    const isOfficialAllowed =
      (user?.role === "admin" || user?.role === "manager") && project.trangThai === "da_gui";

    if (!isOfficialAllowed) {
      toast.info("Báo giá chưa phát hành chính thức, tệp xuất tự động mang nhãn Bản Dự Thảo (UC17)!");
      return handleExportDraftExcel();
    }

    try {
      if (exceljsWorkbook) {
        // [P1-16] Clone một đối tượng workbook độc lập, KHÔNG MUTATE workbook state trên React!
        const exportWb = await cloneExcelJSWorkbook(exceljsWorkbook);

        // Apply gray style to disabled ranges in export clone
        if (disabledRanges && typeof disabledRanges === "object") {
          for (const [sName, cfg] of Object.entries(disabledRanges as any)) {
            const ws = exportWb.getWorksheet(sName);
            if (!ws) continue;
            const config = cfg as any;
            const disabledFill: any = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF64748B" },
            };
            if (Array.isArray(config.rows)) {
              for (const r of config.rows) {
                try {
                  const row = ws.getRow(Number(r));
                  if (row) row.eachCell({ includeEmpty: true }, (c) => (c.fill = disabledFill));
                } catch {}
              }
            }
            if (Array.isArray(config.columns)) {
              for (const col of config.columns) {
                try {
                  const column = ws.getColumn(String(col));
                  if (column) column.eachCell({ includeEmpty: true }, (c) => (c.fill = disabledFill));
                } catch {}
              }
            }
            if (Array.isArray(config.cells)) {
              for (const cRef of config.cells) {
                try {
                  const cell = ws.getCell(String(cRef));
                  if (cell) cell.fill = disabledFill;
                } catch {}
              }
            }
          }
        }
        const base64 = await workbookToBase64(exportWb);
        downloadBase64File(base64, project.name?.replace(/\.xlsx$/i, "") || "baogia");
        toast.success("Đã xuất tệp Excel chính thức thành công!");
        return;
      }

      // Fallback SheetJS export
      const out = XLSX.write(workbook, { bookType: "xlsx", type: "base64" });
      downloadBase64File(out, project.name?.replace(/\.xlsx$/i, "") || "baogia");
      toast.success("Đã tải xuống file Excel");
    } catch (e: any) {
      toast.error("Lỗi xuất file: " + e?.message);
    }
  };

  // UC17: Export Excel nháp có Watermark chìm và Header in ấn A4
  const handleExportDraftExcel = async () => {
    if (!project) return;
    try {
      // 1. Thử tải trực tiếp từ backend pipeline (replays all committed edits từ SQLite + watermark)
      try {
        const blob = await api.downloadDraftExcel(projectId!);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const safeName = (project.name || "baogia").replace(/\.xlsx$/i, "");
        a.download = `${safeName}_BAN_DU_THAO.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Đã xuất tệp Excel Nháp có Watermark 'BẢN DỰ THẢO - CHƯA DUYỆT' (UC17)!");
        return;
      } catch (backendErr) {
        console.warn("Backend draft export failed, falling back to client-side ExcelJS:", backendErr);
      }

      // 2. Fallback sang client-side ExcelJS nếu backend không khả dụng
      if (exceljsWorkbook) {
        // Clone workbook độc lập để bảo toàn trạng thái nguyên bản
        const clonedWb = await cloneExcelJSWorkbook(exceljsWorkbook);

        // Áp dụng định dạng vùng vô hiệu hóa logic (UC04 T10)
        if (disabledRanges && typeof disabledRanges === "object") {
          for (const [sName, cfg] of Object.entries(disabledRanges as any)) {
            const ws = clonedWb.getWorksheet(sName);
            if (!ws) continue;
            const config = cfg as any;
            const disabledFill: any = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF64748B" },
            };
            if (Array.isArray(config.rows)) {
              for (const r of config.rows) {
                try {
                  const row = ws.getRow(Number(r));
                  if (row) row.eachCell({ includeEmpty: true }, (c) => (c.fill = disabledFill));
                } catch {}
              }
            }
            if (Array.isArray(config.columns)) {
              for (const col of config.columns) {
                try {
                  const column = ws.getColumn(String(col));
                  if (column) column.eachCell({ includeEmpty: true }, (c) => (c.fill = disabledFill));
                } catch {}
              }
            }
            if (Array.isArray(config.cells)) {
              for (const cRef of config.cells) {
                try {
                  const cell = ws.getCell(String(cRef));
                  if (cell) cell.fill = disabledFill;
                } catch {}
              }
            }
          }
        }

        // UC17: Áp Watermark "BẢN DỰ THẢO - CHƯA DUYỆT"
        applyDraftWatermarkToWorkbook(clonedWb, "BẢN DỰ THẢO - CHƯA DUYỆT");

        const base64 = await workbookToBase64(clonedWb);
        const baseName = project.name?.replace(/\.xlsx$/i, "") || "baogia";
        downloadBase64File(base64, `${baseName}_BAN_DU_THAO`);
        toast.success("Đã xuất tệp Excel Nháp có Watermark 'BẢN DỰ THẢO - CHƯA DUYỆT' (UC17)!");
        return;
      }

      toast.error("Không tìm thấy dữ liệu bảng tính để tạo bản dự thảo");
    } catch (e: any) {
      toast.error("Lỗi xuất bản dự thảo: " + e?.message);
    }
  };

  // UC06 & UC05: Handler cập nhật OT & Tài chính
  const handleUpdateFinancial = async (payload: any) => {
    if (!projectId) return;
    const updated = await api.updateProject(projectId, payload);
    setProject(updated);
  };

  // 6. Admin Actions: Disable / Enable row, col, cell
  const handleDisableRow = async () => {
    if (!selectedCellInfo?.coord) {
      toast.warning("Vui lòng click vào một ô trên dòng muốn vô hiệu hóa!");
      return;
    }
    const match = selectedCellInfo.coord.match(/^([A-Z]+)(\d+)$/);
    if (!match) return;
    const rowNum = parseInt(match[2], 10);
    try {
      await api.disableRange(projectId!, {
        sheetName: activeSheet,
        type: "ROW",
        target: rowNum,
      });
      toast.success(`Đã vô hiệu hóa dòng ${rowNum}`);
      loadProjectData();
    } catch (e: any) {
      toast.error(e?.message || "Thao tác thất bại");
    }
  };

  const handleEnableRow = async () => {
    if (!selectedCellInfo?.coord) {
      toast.warning("Vui lòng click vào một ô trên dòng muốn khôi phục!");
      return;
    }
    const match = selectedCellInfo.coord.match(/^([A-Z]+)(\d+)$/);
    if (!match) return;
    const rowNum = parseInt(match[2], 10);
    try {
      await api.enableRange(projectId!, {
        sheetName: activeSheet,
        type: "ROW",
        target: rowNum,
      });
      toast.success(`Đã khôi phục dòng ${rowNum}`);
      loadProjectData();
    } catch (e: any) {
      toast.error(e?.message || "Thao tác thất bại");
    }
  };

  const handleDisableCol = async () => {
    if (!selectedCellInfo?.coord) {
      toast.warning("Vui lòng click vào một ô trên cột muốn vô hiệu hóa!");
      return;
    }
    const match = selectedCellInfo.coord.match(/^([A-Z]+)(\d+)$/);
    if (!match) return;
    const colLetter = match[1];
    try {
      await api.disableRange(projectId!, {
        sheetName: activeSheet,
        type: "COLUMN",
        target: colLetter,
      });
      toast.success(`Đã vô hiệu hóa cột ${colLetter}`);
      loadProjectData();
    } catch (e: any) {
      toast.error(e?.message || "Thao tác thất bại");
    }
  };

  const handleEnableCol = async () => {
    if (!selectedCellInfo?.coord) {
      toast.warning("Vui lòng click vào một ô trên cột muốn khôi phục!");
      return;
    }
    const match = selectedCellInfo.coord.match(/^([A-Z]+)(\d+)$/);
    if (!match) return;
    const colLetter = match[1];
    try {
      await api.enableRange(projectId!, {
        sheetName: activeSheet,
        type: "COLUMN",
        target: colLetter,
      });
      toast.success(`Đã khôi phục cột ${colLetter}`);
      loadProjectData();
    } catch (e: any) {
      toast.error(e?.message || "Thao tác thất bại");
    }
  };

  const handleDisableCell = async () => {
    if (!selectedCellInfo?.coord) {
      toast.warning("Vui lòng click vào ô muốn khóa!");
      return;
    }
    try {
      await api.disableRange(projectId!, {
        sheetName: activeSheet,
        type: "CELL",
        target: selectedCellInfo.coord,
      });
      toast.success(`Đã khóa vô hiệu hóa ô ${selectedCellInfo.coord}`);
      loadProjectData();
    } catch (e: any) {
      toast.error(e?.message || "Thao tác thất bại");
    }
  };

  const handleEnableCell = async () => {
    if (!selectedCellInfo?.coord) {
      toast.warning("Vui lòng click vào ô muốn mở khóa!");
      return;
    }
    try {
      await api.enableRange(projectId!, {
        sheetName: activeSheet,
        type: "CELL",
        target: selectedCellInfo.coord,
      });
      toast.success(`Đã mở khóa ô ${selectedCellInfo.coord}`);
      loadProjectData();
    } catch (e: any) {
      toast.error(e?.message || "Thao tác thất bại");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F0F7FF]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#105CB3] border-t-transparent" />
          <p className="text-sm font-semibold text-[#105CB3]">
            Đang khởi tạo Trình Soạn Thảo Excel UC05...
          </p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#F0F7FF] p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
          <FiAlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Truy Cập Bị Từ Chối (HTTP 403)</h2>
        <p className="mt-2 max-w-md text-xs text-slate-500 leading-relaxed">
          Bạn không được phân công tham gia dự án báo giá này hoặc không có quyền mở hồ sơ.
          Theo nguyên tắc bảo mật của hệ thống, chỉ nhân viên thuộc tổ đội phụ trách mới được xem và soạn thảo.
        </p>
        <button
          type="button"
          onClick={() => navigate("/quotes")}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#105CB3] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#268DF0]"
        >
          <FiArrowLeft className="h-4 w-4" />
          <span>Quay lại danh sách báo giá của tôi</span>
        </button>
      </div>
    );
  }

  const assignedMembers = allUsers.filter((u) =>
    Array.isArray(project?.memberIds) && project.memberIds.includes(u.id)
  );
  const nguoiPhuTrach = allUsers.find(
    (u) => u.id === (project?.nguoi_phu_trach_id || project?.nguoiPhuTrachId)
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 font-sans">
      {/* 1. Header Toolbar */}
      <EditorToolbar
        projectName={project?.name || "Báo Giá"}
        soBaoGia={project?.soBaoGia}
        trangThai={project?.trangThai}
        saveStatus={saveStatus}
        userRole={user?.role}
        onBack={() => navigate("/quotes")}
        onExportExcel={handleExportExcel}
        onExportDraftExcel={handleExportDraftExcel}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        isInspectorOpen={isInspectorOpen}
        onDisableSelectedRow={handleDisableRow}
        onEnableSelectedRow={handleEnableRow}
        onDisableSelectedCol={handleDisableCol}
        onEnableSelectedCol={handleEnableCol}
        onDisableSelectedCell={handleDisableCell}
        onEnableSelectedCell={handleEnableCell}
        selectedRangeText={selectedCellInfo?.coord || selectedRangeCoord}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Central Spreadsheet Canvas */}
        <div className="flex flex-1 flex-col min-w-0 bg-white overflow-hidden">
          {/* Sheet Selector Tabs */}
          {workbook && workbook.SheetNames.length > 0 && (
            <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/80 px-3 py-1 text-xs overflow-x-auto custom-scrollbar shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-2 shrink-0">
                Worksheets:
              </span>
              {workbook.SheetNames.map((sName) => (
                <button
                  key={sName}
                  type="button"
                  onClick={() => handleSheetChange(sName)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition-all shrink-0 ${
                    activeSheet === sName
                      ? "bg-white text-[#105CB3] shadow-xs border border-blue-200"
                      : "text-slate-600 hover:bg-slate-200/50"
                  }`}
                >
                  <span>{sName}</span>
                </button>
              ))}
            </div>
          )}

          {/* Spreadsheet Table Canvas */}
          <div className="flex-1 overflow-auto custom-scrollbar p-2 bg-slate-100/50">
            {workbook && activeSheet && sheetData.length > 0 ? (
              <SpreadsheetViewer
                activeSheet={activeSheet}
                sheetData={sheetData}
                workbook={workbook}
                exceljsWorkbook={exceljsWorkbook}
                mode={user?.role === "admin" ? "admin" : "user"}
                editableRange={ranges[activeSheet] || ""}
                disabledRanges={disabledRanges}
                onCellEdit={(r, c, val) => {
                  const cell = XLSX.utils.encode_cell({ r, c });
                  handleCellEdit(activeSheet, cell, val);
                }}
                onCellFocus={(r, c, cell) => {
                  setSelectedRangeCoord(cell);
                  const isDis = isCellDisabled(activeSheet, cell, disabledRanges);
                  const cellVal = sheetData[r]?.[c] ?? "";
                  setSelectedCellInfo({
                    sheetName: activeSheet,
                    coord: cell,
                    value: cellVal,
                    isEditable: !isDis,
                    isDisabled: isDis,
                  });
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Chưa có dữ liệu bảng tính
              </div>
            )}
          </div>
        </div>

        {/* Right Contextual Floating Inspector */}
        {isInspectorOpen && (
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
            project={project}
            onUpdateRanges={(updated) => setRanges(updated)}
            onRefreshData={loadProjectData}
            onOpenAssignModal={() => setIsAssignModalOpen(true)}
            onUpdateFinancial={handleUpdateFinancial}
            onCellEdit={handleCellEdit}
            onClose={() => setIsInspectorOpen(false)}
          />
        )}
      </div>

      {/* Admin Assign Member Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 mb-4">
              Phân Công Nhân Sự Dự Án (UC07)
            </h3>
            <ProjectMetaForm
              project={project}
              onUpdated={(updatedProj) => {
                setProject(updatedProj);
                setIsAssignModalOpen(false);
                loadProjectData();
                toast.success("Đã cập nhật thành viên dự án");
              }}
            />
            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

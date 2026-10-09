import React from "react";
import {
  FiArrowLeft,
  FiDownload,
  FiPrinter,
  FiPlus,
  FiMinusCircle,
  FiRotateCcw,
  FiLock,
  FiUnlock,
  FiSliders,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
  FiAlertTriangle,
} from "react-icons/fi";
import { RiFileExcel2Line } from "react-icons/ri";

export type SaveStatus = "saved" | "saving" | "unsaved" | "error" | "conflict";

interface EditorToolbarProps {
  projectName: string;
  soBaoGia?: string;
  trangThai?: string;
  saveStatus: SaveStatus;
  userRole?: string;
  onBack: () => void;
  onExportExcel: () => void;
  onExportDraftExcel?: () => void;
  onPrint?: () => void;
  onToggleInspector: () => void;
  isInspectorOpen: boolean;

  // Admin Structural controls
  onAddRow?: () => void;
  onAddCol?: () => void;
  onDisableSelectedRow?: () => void;
  onEnableSelectedRow?: () => void;
  onDisableSelectedCol?: () => void;
  onEnableSelectedCol?: () => void;
  onDisableSelectedCell?: () => void;
  onEnableSelectedCell?: () => void;
  selectedRangeText?: string;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  projectName,
  soBaoGia,
  trangThai,
  saveStatus,
  userRole,
  onBack,
  onExportExcel,
  onExportDraftExcel,
  onPrint,
  onToggleInspector,
  isInspectorOpen,
  onAddRow,
  onAddCol,
  onDisableSelectedRow,
  onEnableSelectedRow,
  onDisableSelectedCol,
  onEnableSelectedCol,
  onDisableSelectedCell,
  onEnableSelectedCell,
  selectedRangeText,
}) => {
  const isAdmin = userRole === "admin";

  const renderSaveBadge = () => {
    switch (saveStatus) {
      case "saving":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#105CB3]">
            <FiLoader className="h-3 w-3 animate-spin" />
            <span>Đang lưu...</span>
          </span>
        );
      case "unsaved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
            <FiAlertCircle className="h-3 w-3" />
            <span>Chưa lưu</span>
          </span>
        );
      case "conflict":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
            <FiAlertTriangle className="h-3 w-3" />
            <span>Xung đột dữ liệu</span>
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-600">
            <FiAlertCircle className="h-3 w-3" />
            <span>Lỗi lưu</span>
          </span>
        );
      case "saved":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            <FiCheckCircle className="h-3 w-3" />
            <span>Đã lưu tự động</span>
          </span>
        );
    }
  };

  const getTrangThaiBadge = () => {
    if (trangThai === "da_gui")
      return <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">ĐÃ GỬI KHÁCH</span>;
    if (trangThai === "dang_lam")
      return <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#105CB3]">ĐANG SOẠN THẢO</span>;
    return <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">MỚI GIAO (NHÁP)</span>;
  };

  return (
    <div className="flex flex-col border-b border-slate-200 bg-white shadow-xs">
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 bg-[#F0F7FF]/50">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Quay lại danh sách"
          >
            <FiArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 truncate">
            <RiFileExcel2Line className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-bold text-xs sm:text-sm text-slate-800 truncate">
              {projectName}
            </span>
            {soBaoGia && (
              <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 font-semibold">
                {soBaoGia}
              </span>
            )}
            {getTrangThaiBadge()}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {renderSaveBadge()}

          {onExportDraftExcel && (
            <button
              type="button"
              onClick={onExportDraftExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50/80 px-2.5 py-1.5 text-xs font-bold text-amber-900 shadow-2xs hover:bg-amber-100 transition-colors"
              title="Xuất tệp Excel dự thảo có Watermark 'BẢN DỰ THẢO - CHƯA DUYỆT' (UC17)"
            >
              <RiFileExcel2Line className="h-3.5 w-3.5 text-amber-600" />
              <span className="hidden sm:inline">Xuất Nháp (Watermark)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#105CB3] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#268DF0] transition-colors"
            title="Tải tệp Excel bảng tính"
          >
            <FiDownload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tải Excel</span>
          </button>

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              title="In bảng tính"
            >
              <FiPrinter className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleInspector}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              isInspectorOpen
                ? "border-blue-300 bg-blue-50 text-[#105CB3]"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title="Bật/Tắt Contextual Inspector bên phải"
          >
            <FiSliders className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Inspector</span>
          </button>
        </div>
      </div>

      {/* Structural & Formatting Action Strip */}
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs bg-slate-50 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
              Cấu trúc bảng:
            </span>

            {/* Row Controls */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={onAddRow}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#105CB3]"
              >
                <FiPlus className="h-3 w-3" />
                <span>Thêm dòng</span>
              </button>
              <button
                type="button"
                onClick={onDisableSelectedRow}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                title="Vô hiệu hóa dòng đang chọn (khóa xám đen, giữ nguyên tọa độ)"
              >
                <FiMinusCircle className="h-3 w-3" />
                <span>Vô hiệu hóa dòng</span>
              </button>
              <button
                type="button"
                onClick={onEnableSelectedRow}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50"
                title="Khôi phục dòng đang chọn"
              >
                <FiRotateCcw className="h-3 w-3" />
                <span>Khôi phục dòng</span>
              </button>
            </div>

            {/* Col Controls */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={onAddCol}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#105CB3]"
              >
                <FiPlus className="h-3 w-3" />
                <span>Thêm cột</span>
              </button>
              <button
                type="button"
                onClick={onDisableSelectedCol}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                title="Vô hiệu hóa cột đang chọn"
              >
                <FiMinusCircle className="h-3 w-3" />
                <span>Vô hiệu cột</span>
              </button>
              <button
                type="button"
                onClick={onEnableSelectedCol}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50"
                title="Khôi phục cột đang chọn"
              >
                <FiRotateCcw className="h-3 w-3" />
                <span>Khôi phục cột</span>
              </button>
            </div>

            {/* Cell Lock Controls */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={onDisableSelectedCell}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50"
                title="Khóa vô hiệu hóa ô đang chọn"
              >
                <FiLock className="h-3 w-3" />
                <span>Khóa ô</span>
              </button>
              <button
                type="button"
                onClick={onEnableSelectedCell}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50"
                title="Mở khóa ô đang chọn"
              >
                <FiUnlock className="h-3 w-3" />
                <span>Mở ô</span>
              </button>
            </div>
          </div>

          {selectedRangeText && (
            <div className="text-[11px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
              Vùng chọn: <strong className="text-[#105CB3]">{selectedRangeText}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

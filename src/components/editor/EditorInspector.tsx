import React, { useState } from "react";
import {
  FiInfo,
  FiLock,
  FiUsers,
  FiClock,
  FiSliders,
  FiCheck,
  FiRotateCcw,
  FiSave,
  FiAlertCircle,
  FiX,
  FiUserPlus,
  FiDollarSign,
  FiPercent,
  FiShield,
  FiAlertTriangle,
  FiLoader,
} from "react-icons/fi";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { formatVND, numberToVietnameseWords, DEFAULT_SURVEY_ITEMS } from "../../lib/quote-calculator";
import { isLockedStatus } from "../../lib/constants";
import { FinancialReviewPanel } from "../../features/reviews/FinancialReviewPanel";

interface CellDetails {
  sheetName: string;
  coord: string;
  value: any;
  type?: string;
  formula?: string;
  isEditable: boolean;
  isDisabled: boolean;
}

interface Member {
  id: string;
  username: string;
  fullName?: string;
  role?: string;
}

interface EditRecord {
  id: string;
  user_name?: string;
  username?: string;
  sheet_name?: string;
  sheetName?: string;
  cell: string;
  old_value?: string;
  oldValue?: string;
  new_value?: string;
  newValue?: string;
  created_at?: string;
  timestamp?: string;
}

interface EditorInspectorProps {
  projectId: string;
  userRole?: string;
  currentSheet: string;
  cellDetails?: CellDetails | null;
  editableRanges: Record<string, string>;
  disabledRanges: Record<string, { cells: string[]; rows: number[]; columns: string[] }>;
  members: Member[];
  nguoiPhuTrachName?: string;
  editsHistory: EditRecord[];
  project?: any;
  onUpdateRanges?: (ranges: Record<string, string>) => void;
  onRefreshData?: () => void;
  onOpenAssignModal?: () => void;
  onUpdateFinancial?: (payload: any) => Promise<void>;
  onCellEdit?: (
    sheetName: string,
    cell: string,
    newValue: any,
    options?: { expectedRevision?: number; batch?: boolean }
  ) => Promise<void>;
  onClose: () => void;
}

export const EditorInspector: React.FC<EditorInspectorProps> = ({
  projectId,
  userRole,
  currentSheet,
  cellDetails,
  editableRanges,
  disabledRanges,
  members,
  nguoiPhuTrachName,
  editsHistory,
  project,
  onUpdateRanges,
  onRefreshData,
  onOpenAssignModal,
  onUpdateFinancial,
  onCellEdit,
  onClose,
}) => {
  const isAdmin = userRole === "admin";
  const isManager = userRole === "manager";
  const canEditFinancial = isAdmin || isManager;

  const [activeTab, setActiveTab] = useState<"cell" | "permissions" | "members" | "history" | "structure" | "finance" | "review">("cell");
  const [editingRange, setEditingRange] = useState<string>(editableRanges[currentSheet] || "");
  const [isSavingRange, setIsSavingRange] = useState(false);

  // Financial & OT states (UC06, UC05)
  const [otHours, setOtHours] = useState<number>(Number(project?.otHours ?? 0));
  const [otRate, setOtRate] = useState<number>(Number(project?.otRate ?? 505000));
  const [vatRate, setVatRate] = useState<number>(Number(project?.vatRate !== undefined ? project.vatRate : 8));
  const [discountAmount, setDiscountAmount] = useState<number>(Number(project?.discountAmount ?? 0));
  const [equipmentAllowance, setEquipmentAllowance] = useState<number>(
    Number(project?.financialConfig?.equipmentAllowance ?? 0)
  );
  const [travelAllowance, setTravelAllowance] = useState<number>(
    Number(project?.financialConfig?.travelAllowance ?? 0)
  );
  const [cellMapping, setCellMapping] = useState<{
    sheetName?: string;
    otHoursCell?: string;
    otAmountCell?: string;
    vatRateCell?: string;
    discountCell?: string;
  }>({
    sheetName: project?.financialConfig?.cellMapping?.sheetName || currentSheet,
    otHoursCell: project?.financialConfig?.cellMapping?.otHoursCell || "",
    otAmountCell: project?.financialConfig?.cellMapping?.otAmountCell || "",
    vatRateCell: project?.financialConfig?.cellMapping?.vatRateCell || "",
    discountCell: project?.financialConfig?.cellMapping?.discountCell || "",
  });

  // [P0-02] Danh mục hạng mục công việc với đơn giá và số lượng
  const [lineItems, setLineItems] = useState<Array<{
    id: string;
    code?: string;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    priceCell?: string;
  }>>(() => {
    if (Array.isArray(project?.financialConfig?.items) && project.financialConfig.items.length > 0) {
      return project.financialConfig.items;
    }
    return DEFAULT_SURVEY_ITEMS.map((item, idx) => ({
      ...item,
      priceCell: `E${10 + idx}`,
    }));
  });

  const [isSavingFinance, setIsSavingFinance] = useState(false);

  // Sync state when project updates
  React.useEffect(() => {
    if (project) {
      setOtHours(Number(project.otHours ?? 0));
      setOtRate(Number(project.otRate ?? 505000));
      setVatRate(Number(project.vatRate !== undefined ? project.vatRate : 8));
      setDiscountAmount(Number(project.discountAmount ?? 0));
      setEquipmentAllowance(Number(project.financialConfig?.equipmentAllowance ?? 0));
      setTravelAllowance(Number(project.financialConfig?.travelAllowance ?? 0));
      if (project.financialConfig?.cellMapping) {
        setCellMapping(project.financialConfig.cellMapping);
      }
      if (Array.isArray(project.financialConfig?.items) && project.financialConfig.items.length > 0) {
        setLineItems(project.financialConfig.items);
      }
    }
  }, [project]);

  // Sync editing range when sheet changes
  React.useEffect(() => {
    setEditingRange(editableRanges[currentSheet] || "");
  }, [currentSheet, editableRanges]);

  const handleSaveRanges = async () => {
    if (!isAdmin) return;
    try {
      setIsSavingRange(true);
      const updated = {
        ...editableRanges,
        [currentSheet]: editingRange.trim(),
      };
      await api.updateRanges(projectId, updated);
      onUpdateRanges?.(updated);
      toast.success(`Đã cập nhật dải ô cho phép sửa sheet ${currentSheet}`);
    } catch (e: any) {
      toast.error(e?.message || "Không thể cập nhật dải ô");
    } finally {
      setIsSavingRange(false);
    }
  };

  const handleQuickEnable = async (type: "CELL" | "ROW" | "COLUMN", target: string | number) => {
    if (!isAdmin) return;
    try {
      await api.enableRange(projectId, {
        sheetName: currentSheet,
        type,
        target,
      });
      toast.success(`Đã khôi phục ${type.toLowerCase()} ${target}`);
      onRefreshData?.();
    } catch (e: any) {
      toast.error(e?.message || "Khôi phục thất bại");
    }
  };

  // UC06 & UC05: Save OT and Financial Data with cell synchronization
  const handleSaveFinancial = async () => {
    if (isLockedStatus(project?.trangThai)) {
      toast.error("Báo giá đã bị khóa/đã phát hành, không thể chỉnh sửa!");
      return;
    }
    if (isNaN(otHours) || otHours < 0) {
      toast.error("Số giờ làm thêm OT phải là số lớn hơn hoặc bằng 0");
      return;
    }

    try {
      setIsSavingFinance(true);

      const targetSheet = cellMapping.sheetName || currentSheet;

      // 1. Đồng bộ vào ô bảng tính thật (spreadsheet cells) qua onCellEdit:
      // Điều này ghi vết vào bảng `edits` (UC13), kiểm tra OCC (UC12), tăng revision ô
      // và phát sự kiện cell.updated realtime cho tất cả người dùng khác đang mở dự án.
      if (onCellEdit) {
        // UC06: Đồng bộ giờ OT vào ô bảng tính (Nhân viên & Kế toán)
        if (cellMapping.otHoursCell) {
          await onCellEdit(targetSheet, cellMapping.otHoursCell.trim().toUpperCase(), otHours);
        }
        if (cellMapping.otAmountCell) {
          await onCellEdit(targetSheet, cellMapping.otAmountCell.trim().toUpperCase(), totalOtCost);
        }

        // UC05: Đồng bộ các ô tài chính vào bảng tính (Kế toán & Admin)
        if (canEditFinancial) {
          if (cellMapping.vatRateCell) {
            await onCellEdit(targetSheet, cellMapping.vatRateCell.trim().toUpperCase(), vatRate);
          }
          if (cellMapping.discountCell) {
            await onCellEdit(targetSheet, cellMapping.discountCell.trim().toUpperCase(), discountAmount);
          }
        }
      }

      // 2. Cập nhật metadata dự án (projects table) kèm OCC revision
      const payload: any = {
        otHours: Number(otHours),
        expectedFinanceRevision: project?.financeRevision,
      };

      if (canEditFinancial) {
        payload.otRate = Number(otRate);
        payload.vatRate = Number(vatRate);
        payload.discountAmount = Number(discountAmount);
        payload.financialConfig = {
          ...(project?.financialConfig || {}),
          items: lineItems,
          itemsSubtotal: subTotalItems,
          equipmentAllowance: Number(equipmentAllowance),
          travelAllowance: Number(travelAllowance),
          cellMapping: {
            ...cellMapping,
            sheetName: targetSheet,
          },
        };
      }
      // [P0-10] Nhân viên kỹ thuật (user) chỉ gửi otHours, không gửi financialConfig để tránh lỗi 403 Forbidden

      if (onUpdateFinancial) {
        await onUpdateFinancial(payload);
      } else {
        await api.updateProject(projectId, payload);
        onRefreshData?.();
      }
      toast.success("Đã đồng bộ và lưu dữ liệu Tài chính & OT vào bảng tính thành công!");
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes("409")) {
        toast.error("Xung đột đồng thời (OCC): Dữ liệu vừa được cập nhật bởi người khác! Vui lòng làm mới dữ liệu.");
        onRefreshData?.();
        return;
      }
      if (err?.status === 403 || err?.message?.includes("403")) {
        toast.error(err?.data?.error || err?.message || "Bạn không có quyền chỉnh sửa ô tài chính này!");
        return;
      }
      toast.error(err?.data?.error || err?.message || "Lỗi lưu dữ liệu tài chính/OT");
    } finally {
      setIsSavingFinance(false);
    }
  };

  // [P1-10] Không bị fallback ngầm 505.000 khi otRate = 0
  const effectiveOtRate =
    otRate !== undefined && otRate !== null && !isNaN(Number(otRate)) ? Number(otRate) : 505000;
  const totalOtCost = (Number(otHours) || 0) * effectiveOtRate;
  const totalAllowances = (Number(equipmentAllowance) || 0) + (Number(travelAllowance) || 0);

  // [P0-02] & [P1-08]: QuoteFinancialSummary hợp nhất từ đơn giá hạng mục + OT + phụ cấp - chiết khấu
  const subTotalItems = lineItems.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0
  );
  const totalBase = subTotalItems + totalOtCost + totalAllowances;
  const totalBeforeVat = Math.max(0, totalBase - (Number(discountAmount) || 0));
  const vatAmount = Math.round(totalBeforeVat * ((Number(vatRate) || 0) / 100));
  const grandTotal = totalBeforeVat + vatAmount;

  const sheetDisabled = disabledRanges[currentSheet] || { cells: [], rows: [], columns: [] };

  return (
    <div className="flex h-full w-80 md:w-96 flex-col border-l border-slate-200 bg-white shadow-lg">
      {/* Inspector Top Header */}
      <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4 bg-[#F0F7FF]">
        <div className="flex items-center gap-2">
          <FiSliders className="h-4 w-4 text-[#105CB3]" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Contextual Inspector
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Đóng bảng tham số"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex flex-wrap border-b border-slate-200 bg-slate-50/70 p-1 text-xs gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("cell")}
          className={`flex-1 min-w-[50px] rounded-md py-1.5 px-1 font-semibold text-center transition-all ${
            activeTab === "cell"
              ? "bg-white text-[#105CB3] shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
          title="Chi tiết ô đang chọn"
        >
          Chi tiết
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("finance")}
          className={`flex-1 min-w-[75px] rounded-md py-1.5 px-1 font-semibold text-center transition-all ${
            activeTab === "finance"
              ? "bg-white text-emerald-600 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
          title="Quản lý Giờ làm thêm OT & Tài chính báo giá (UC06, UC05)"
        >
          Tài chính & OT
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={`flex-1 min-w-[70px] rounded-md py-1.5 px-1 font-semibold text-center transition-all ${
            activeTab === "review"
              ? "bg-white text-indigo-600 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
          title="Thẩm định Kế toán & Phê duyệt Admin (UC08, UC09, UC10)"
        >
          Xét duyệt
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("permissions")}
          className={`flex-1 min-w-[50px] rounded-md py-1.5 px-1 font-semibold text-center transition-all ${
            activeTab === "permissions"
              ? "bg-white text-[#105CB3] shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
          title="Quyền sửa ô & dải ô"
        >
          Quyền
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`flex-1 min-w-[50px] rounded-md py-1.5 px-1 font-semibold text-center transition-all ${
            activeTab === "members"
              ? "bg-white text-[#105CB3] shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
          title="Thành viên phụ trách"
        >
          Nhân sự
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 min-w-[50px] rounded-md py-1.5 px-1 font-semibold text-center transition-all ${
            activeTab === "history"
              ? "bg-white text-[#105CB3] shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
          title="Lịch sử chỉnh sửa"
        >
          Nhật ký
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab("structure")}
            className={`flex-1 min-w-[45px] rounded-md py-1.5 px-1 font-semibold text-center transition-all ${
              activeTab === "structure"
                ? "bg-white text-red-600 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
            title="Vùng vô hiệu hóa logic (UC04 T10)"
          >
            Khóa
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {/* Tab 1: Cell Details */}
        {activeTab === "cell" && (
          <div className="space-y-4">
            {cellDetails ? (
              <>
                <div className="rounded-xl border border-blue-100 bg-[#F0F7FF]/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Tọa độ ô:</span>
                    <span className="font-mono text-sm font-black text-[#105CB3] bg-white px-2 py-0.5 rounded border border-blue-200">
                      {cellDetails.sheetName}!{cellDetails.coord}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-blue-100 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Trạng thái:</span>
                      {cellDetails.isDisabled ? (
                        <span className="font-bold text-red-600 flex items-center gap-1">
                          <FiLock className="h-3 w-3" /> Đã vô hiệu hóa (Disabled)
                        </span>
                      ) : cellDetails.isEditable ? (
                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                          <FiCheck className="h-3 w-3" /> Được phép chỉnh sửa
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-500">Chỉ xem (Read-only)</span>
                      )}
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">Kiểu dữ liệu:</span>
                      <span className="font-mono text-slate-700">
                        {cellDetails.type || (typeof cellDetails.value)}
                      </span>
                    </div>

                    {cellDetails.formula && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Công thức:</span>
                        <span className="font-mono text-indigo-700 font-semibold truncate max-w-[150px]">
                          ={cellDetails.formula}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                    Giá trị hiện tại:
                  </span>
                  <div className="rounded-lg bg-slate-50 p-2 font-mono text-xs text-slate-800 break-words border border-slate-200">
                    {String(cellDetails.value ?? "") || <em className="text-slate-400">Trống</em>}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                <FiInfo className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p>Click vào một ô trên bảng tính để xem chi tiết tham số</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Permissions (editable_ranges) */}
        {activeTab === "permissions" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-100 bg-[#F0F7FF] p-3 text-slate-700 leading-relaxed text-[11px]">
              <p className="font-bold text-[#105CB3] mb-1">Quy định quyền chỉnh sửa ô (UC05)</p>
              <p>
                Chỉ các ô nằm trong phạm vi cấu hình dưới đây mới cho phép Kỹ sư nhập liệu.
                Mọi thao tác sửa ngoài dải ô sẽ bị Backend Express từ chối HTTP 403.
              </p>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-700 block">
                Dải ô cho phép sửa (Sheet: <span className="text-[#105CB3]">{currentSheet}</span>)
              </label>

              {isAdmin ? (
                <>
                  <input
                    type="text"
                    value={editingRange}
                    onChange={(e) => setEditingRange(e.target.value)}
                    placeholder="Ví dụ: C5:E30 hoặc C:C, D:E"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono focus:border-[#268DF0] focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400">
                    Phân tách nhiều dải ô bằng dấu phẩy. Để trống nghĩa là khóa toàn bộ sheet.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveRanges}
                    disabled={isSavingRange}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#105CB3] py-2 font-bold text-white shadow-xs hover:bg-[#268DF0] disabled:opacity-50"
                  >
                    <FiSave className="h-3.5 w-3.5" />
                    <span>{isSavingRange ? "Đang lưu..." : "Lưu Cấu Hình Dải Ô"}</span>
                  </button>
                </>
              ) : (
                <div className="rounded-lg bg-slate-50 p-2.5 font-mono text-xs text-slate-700 border border-slate-200">
                  {editableRanges[currentSheet] || <span className="text-slate-400 italic">Chưa cấu hình (Khóa sửa)</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Project Members */}
        {activeTab === "members" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 p-3 bg-white">
              <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Kỹ sư Phụ trách chính:
              </span>
              <p className="font-bold text-[#105CB3] text-sm">
                {nguoiPhuTrachName || "Chưa phân công"}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-700">
                  Thành viên tham gia ({members.length}):
                </span>
                {isAdmin && onOpenAssignModal && (
                  <button
                    type="button"
                    onClick={onOpenAssignModal}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#105CB3] hover:underline"
                  >
                    <FiUserPlus className="h-3 w-3" />
                    <span>Gán thành viên</span>
                  </button>
                )}
              </div>

              {members.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-slate-400">
                  Chưa gán thành viên phối hợp
                </div>
              ) : (
                <div className="space-y-1.5">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{m.fullName || m.username}</p>
                        <p className="text-[10px] text-slate-400">@{m.username}</p>
                      </div>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#105CB3]">
                        {m.role || "user"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Audit History */}
        {activeTab === "history" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Lịch sử sửa ô ({editsHistory.length})</span>
            </div>

            {editsHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
                Chưa có thao tác sửa ô nào được ghi nhận
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {editsHistory.map((item, idx) => {
                  const author = item.user_name || item.username || "Nhân viên";
                  const sheet = item.sheet_name || item.sheetName || "";
                  const oldV = item.old_value ?? item.oldValue ?? "—";
                  const newV = item.new_value ?? item.newValue ?? "";
                  return (
                    <div
                      key={item.id || idx}
                      className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-[11px]"
                    >
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="font-bold text-slate-700">{author}</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {item.timestamp || item.created_at
                            ? new Date(item.timestamp || item.created_at!).toLocaleString("vi-VN")
                            : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-[#105CB3] font-bold">
                          {sheet ? `${sheet}!` : ""}
                          {item.cell}:
                        </span>
                        <span className="text-slate-400 line-through truncate max-w-[80px]">
                          {oldV}
                        </span>
                        <span>→</span>
                        <span className="text-emerald-600 font-bold truncate max-w-[100px]">
                          {newV}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Structure Disabled Ranges (Admin-only) */}
        {activeTab === "structure" && isAdmin && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 text-[11px] text-red-900 leading-relaxed">
              <p className="font-bold text-red-700 mb-0.5">Vô hiệu hóa Logic (UC04 Tình huống 10)</p>
              <p>
                Dòng/cột/ô bị vô hiệu hóa sẽ tô nền xám đen (#334155), giữ nguyên số thứ tự và
                tọa độ các dòng khác. Bấm "Khôi phục" để mở lại.
              </p>
            </div>

            {/* Disabled Rows */}
            <div className="space-y-2">
              <span className="font-bold text-slate-700 block">
                Dòng đang bị vô hiệu hóa ({sheetDisabled.rows.length}):
              </span>
              {sheetDisabled.rows.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Không có dòng nào bị khóa</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sheetDisabled.rows.map((rowNum) => (
                    <div
                      key={rowNum}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-800 text-white px-2.5 py-1 text-xs font-mono"
                    >
                      <FiLock className="h-3 w-3 text-red-400" />
                      <span>Dòng {rowNum}</span>
                      <button
                        type="button"
                        onClick={() => handleQuickEnable("ROW", rowNum)}
                        className="ml-1 text-emerald-400 hover:text-emerald-300"
                        title="Khôi phục dòng này"
                      >
                        <FiRotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Disabled Columns */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-700 block">
                Cột đang bị vô hiệu hóa ({sheetDisabled.columns.length}):
              </span>
              {sheetDisabled.columns.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Không có cột nào bị khóa</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sheetDisabled.columns.map((colLetter) => (
                    <div
                      key={colLetter}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-800 text-white px-2.5 py-1 text-xs font-mono"
                    >
                      <FiLock className="h-3 w-3 text-red-400" />
                      <span>Cột {colLetter}</span>
                      <button
                        type="button"
                        onClick={() => handleQuickEnable("COLUMN", colLetter)}
                        className="ml-1 text-emerald-400 hover:text-emerald-300"
                        title="Khôi phục cột này"
                      >
                        <FiRotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Disabled Cells */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-700 block">
                Ô đơn lẻ đang bị vô hiệu hóa ({sheetDisabled.cells.length}):
              </span>
              {sheetDisabled.cells.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Không có ô đơn lẻ bị khóa</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sheetDisabled.cells.map((cellCoord) => (
                    <div
                      key={cellCoord}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-800 text-white px-2.5 py-1 text-xs font-mono"
                    >
                      <FiLock className="h-3 w-3 text-red-400" />
                      <span>{cellCoord}</span>
                      <button
                        type="button"
                        onClick={() => handleQuickEnable("CELL", cellCoord)}
                        className="ml-1 text-emerald-400 hover:text-emerald-300"
                        title="Khôi phục ô này"
                      >
                        <FiRotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 6: Finance & OT (UC06, UC05) */}
        {activeTab === "finance" && (
          <div className="space-y-4">
            {/* Header info card */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-2xs">
              <div className="flex items-center gap-2 text-emerald-900 font-bold mb-1">
                <FiDollarSign className="h-4 w-4 text-emerald-600" />
                <span>Quản Lý Tài Chính & Giờ Làm Thêm OT</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Đặc tả <strong>UC06</strong> (Giờ OT chuẩn 505.000đ/h) & <strong>UC05</strong> (Đơn giá, thuế VAT, chiết khấu).
                Dữ liệu được đồng bộ vào các ô bảng tính Excel, lưu bền vững và cập nhật realtime.
              </p>
            </div>

            {/* BLOCK 0: Ánh Xạ Ô Bảng Tính Excel (Cell Mapping - UC06 & UC05) */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <FiSliders className="h-3.5 w-3.5 text-[#105CB3]" />
                  <span>Ánh Xạ Ô Bảng Tính Excel</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Sheet: {cellMapping.sheetName || currentSheet}
                </span>
              </div>

              {/* Quick map from selected cell */}
              {cellDetails?.coord && (
                <div className="rounded-lg border border-blue-100 bg-white p-2 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">
                      Ô đang chọn: <strong className="font-mono text-[#105CB3] font-bold">{cellDetails.coord}</strong>
                    </span>
                    <span className="text-[10px] text-slate-400">Gán nhanh:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCellMapping((prev) => ({
                          ...prev,
                          otHoursCell: cellDetails.coord,
                          sheetName: currentSheet,
                        }))
                      }
                      className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-200 transition-colors"
                    >
                      + Ô Giờ OT
                    </button>
                    {canEditFinancial && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setCellMapping((prev) => ({
                              ...prev,
                              otAmountCell: cellDetails.coord,
                              sheetName: currentSheet,
                            }))
                          }
                          className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          + Ô Tiền OT
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCellMapping((prev) => ({
                              ...prev,
                              vatRateCell: cellDetails.coord,
                              sheetName: currentSheet,
                            }))
                          }
                          className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200 transition-colors"
                        >
                          + Ô Thuế VAT
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCellMapping((prev) => ({
                              ...prev,
                              discountCell: cellDetails.coord,
                              sheetName: currentSheet,
                            }))
                          }
                          className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-200 transition-colors"
                        >
                          + Ô Chiết khấu
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Direct Coordinate Inputs */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">Ô Giờ OT:</label>
                  <input
                    type="text"
                    value={cellMapping.otHoursCell || ""}
                    onChange={(e) =>
                      setCellMapping((prev) => ({ ...prev, otHoursCell: e.target.value.toUpperCase() }))
                    }
                    placeholder="VD: C25"
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-800 focus:border-[#105CB3] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">Ô Tiền OT:</label>
                  <input
                    type="text"
                    disabled={!canEditFinancial}
                    value={cellMapping.otAmountCell || ""}
                    onChange={(e) =>
                      setCellMapping((prev) => ({ ...prev, otAmountCell: e.target.value.toUpperCase() }))
                    }
                    placeholder="VD: E25"
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-800 disabled:bg-slate-100 focus:border-[#105CB3] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">Ô Thuế VAT:</label>
                  <input
                    type="text"
                    disabled={!canEditFinancial}
                    value={cellMapping.vatRateCell || ""}
                    onChange={(e) =>
                      setCellMapping((prev) => ({ ...prev, vatRateCell: e.target.value.toUpperCase() }))
                    }
                    placeholder="VD: E28"
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-800 disabled:bg-slate-100 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">Ô Chiết khấu:</label>
                  <input
                    type="text"
                    disabled={!canEditFinancial}
                    value={cellMapping.discountCell || ""}
                    onChange={(e) =>
                      setCellMapping((prev) => ({ ...prev, discountCell: e.target.value.toUpperCase() }))
                    }
                    placeholder="VD: E29"
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-800 disabled:bg-slate-100 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* BLOCK 1: UC06 - Nhập giờ làm thêm OT */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FiClock className="h-3.5 w-3.5 text-[#105CB3]" />
                  <span>Giờ Làm Thêm OT (UC06)</span>
                </span>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#105CB3]">
                  Nhân viên & Kế toán
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Số giờ làm thêm thực tế (giờ):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={otHours}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setOtHours(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-[#105CB3] focus:bg-white focus:outline-hidden"
                    placeholder="0.0"
                  />
                  <span className="text-xs font-semibold text-slate-500 shrink-0">giờ</span>
                </div>
              </div>

              {/* Quick hour buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400">Chọn nhanh:</span>
                {[0, 1, 1.5, 2, 4, 8].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setOtHours(h)}
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      otHours === h
                        ? "bg-[#105CB3] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>

              {/* OT Rate config */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Đơn giá định mức chuẩn:</span>
                  {canEditFinancial ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={otRate}
                        onChange={(e) => setOtRate(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-24 rounded border border-slate-200 px-1.5 py-0.5 text-right font-mono text-[11px] font-bold text-slate-800"
                      />
                      <span className="text-[10px] text-slate-400">đ/h</span>
                    </div>
                  ) : (
                    <span className="font-mono font-bold text-slate-700">
                      {formatVND(otRate)}/giờ
                    </span>
                  )}
                </div>
              </div>

              {/* OT Warning if > 40h */}
              {otHours > 40 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 flex items-start gap-1.5">
                  <FiAlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Cảnh báo chính sách:</strong> Số giờ OT ({otHours}h) vượt ngưỡng tiêu chuẩn 40h/tháng theo quy định nội bộ Phúc Gia.
                  </span>
                </div>
              )}

              {/* Calculated OT Amount */}
              <div className="rounded-lg bg-blue-50/80 p-2.5 border border-blue-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#105CB3]">Thành tiền OT:</span>
                <span className="font-mono text-xs font-bold text-[#105CB3]">
                  {formatVND(totalOtCost)}
                </span>
              </div>
            </div>

            {/* BLOCK 1.5: UC05 - Quản lý đơn giá từng hạng mục */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FiDollarSign className="h-3.5 w-3.5 text-blue-600" />
                  <span>Đơn Giá Từng Hạng Mục (UC05)</span>
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    canEditFinancial
                      ? "bg-blue-50 text-[#105CB3]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {canEditFinancial ? "Kế toán chỉnh sửa" : "Chỉ xem"}
                </span>
              </div>

              <p className="text-[10.5px] text-slate-500">
                Kế toán được phép điều chỉnh đơn giá từng dòng. Khối lượng kỹ thuật chỉ đọc (UC04 bảo vệ).
              </p>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {lineItems.map((item, idx) => {
                  const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                  return (
                    <div
                      key={item.id || idx}
                      className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-[11px] space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-semibold text-slate-800 line-clamp-1">
                          {item.code ? `[${item.code}] ` : ""}{item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {item.priceCell || ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <div>
                          <span className="text-[9.5px] text-slate-400 block">Khối lượng:</span>
                          <span className="font-mono font-bold text-slate-700">
                            {item.quantity} {item.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9.5px] text-slate-400 block">Đơn giá (VNĐ):</span>
                          {canEditFinancial ? (
                            <input
                              type="number"
                              min="0"
                              step="50000"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const newPrice = Math.max(0, parseInt(e.target.value, 10) || 0);
                                setLineItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, unitPrice: newPrice } : it))
                                );
                                if (onCellEdit && item.priceCell) {
                                  onCellEdit(
                                    cellMapping.sheetName || currentSheet,
                                    item.priceCell.trim().toUpperCase(),
                                    newPrice
                                  ).catch(() => {});
                                }
                              }}
                              className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right font-mono text-[11px] font-bold text-blue-700 focus:border-[#105CB3]"
                            />
                          ) : (
                            <span className="font-mono font-semibold text-slate-700">
                              {formatVND(item.unitPrice)}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[9.5px] text-slate-400 block">Thành tiền:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatVND(lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <span className="text-slate-600 font-medium">Tổng tiền các hạng mục:</span>
                <span className="font-mono font-bold text-slate-900">{formatVND(subTotalItems)}</span>
              </div>
            </div>

            {/* BLOCK 2: UC05 - Sửa VAT, Chiết Khấu, Phụ Cấp */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FiPercent className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Thuế VAT & Chiết Khấu (UC05)</span>
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    canEditFinancial
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {canEditFinancial ? "Kế toán / Admin" : "Chỉ xem"}
                </span>
              </div>

              {/* Non-accountant lock banner */}
              {!canEditFinancial && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10.5px] text-slate-500 flex items-start gap-1.5">
                  <FiLock className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    Nhân viên kỹ thuật chỉ có quyền xem. Chỉ <strong>Kế toán (Manager)</strong> và <strong>Quản trị viên</strong> mới có quyền điều chỉnh thuế VAT, chiết khấu và phụ cấp.
                  </span>
                </div>
              )}

              {/* VAT Rate Selection */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Thuế suất Giá trị gia tăng (VAT):
                </label>
                <div className="flex items-center gap-1.5 mb-2">
                  {[0, 8, 10].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      disabled={!canEditFinancial}
                      onClick={() => setVatRate(rate)}
                      className={`flex-1 rounded-md py-1 text-xs font-bold transition-all ${
                        vatRate === rate
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60 disabled:hover:bg-slate-100"
                      }`}
                    >
                      {rate === 0 ? "0% (Miễn thuế)" : `${rate}%`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    disabled={!canEditFinancial}
                    value={vatRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVatRate(isNaN(val) ? 0 : Math.min(100, Math.max(0, val)));
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 disabled:opacity-60 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
                  />
                  <span className="text-xs font-semibold text-slate-500">%</span>
                </div>
              </div>

              {/* Discount Amount */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Chiết khấu thương mại (VNĐ):
                </label>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  disabled={!canEditFinancial}
                  value={discountAmount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setDiscountAmount(isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 disabled:opacity-60 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
                  placeholder="0"
                />
                {discountAmount > 0 && (
                  <p className="mt-1 text-[10px] text-slate-500 text-right">
                    Giảm trừ: {formatVND(discountAmount)}
                  </p>
                )}
              </div>

              {/* Allowances */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Phụ cấp khảo sát (Tùy chọn):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block">Máy móc (RTK/UAV):</label>
                    <input
                      type="number"
                      min="0"
                      step="500000"
                      disabled={!canEditFinancial}
                      value={equipmentAllowance}
                      onChange={(e) => setEquipmentAllowance(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-800 disabled:opacity-60"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Công tác xa:</label>
                    <input
                      type="number"
                      min="0"
                      step="500000"
                      disabled={!canEditFinancial}
                      value={travelAllowance}
                      onChange={(e) => setTravelAllowance(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-800 disabled:opacity-60"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* BLOCK 3: [P1-08] Tổng hợp tài chính toàn diện & Đọc tiền bằng chữ */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
              <span className="font-bold text-slate-800 block text-xs">
                Tổng Hợp Toàn Bộ Báo Giá (UC05 + UC06)
              </span>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Tiền các hạng mục:</span>
                  <span className="font-mono font-semibold">{formatVND(subTotalItems)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Chi phí làm thêm OT:</span>
                  <span className="font-mono font-semibold">+ {formatVND(totalOtCost)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tổng phụ cấp thiết bị/đi lại:</span>
                  <span className="font-mono font-semibold">+ {formatVND(totalAllowances)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Chiết khấu thương mại:</span>
                    <span className="font-mono font-semibold">- {formatVND(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700 font-semibold pt-1 border-t border-slate-200/80">
                  <span>Tổng cộng trước thuế:</span>
                  <span className="font-mono">{formatVND(totalBeforeVat)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tiền thuế VAT ({vatRate}%):</span>
                  <span className="font-mono font-semibold">+ {formatVND(vatAmount)}</span>
                </div>
                <div className="pt-2 border-t border-slate-300 flex justify-between font-bold text-xs text-slate-900">
                  <span>TỔNG CỘNG THANH TOÁN:</span>
                  <span className="font-mono text-emerald-700 text-sm">{formatVND(grandTotal)}</span>
                </div>
              </div>

              {grandTotal > 0 && (
                <div className="pt-1.5 text-[10.5px] italic text-slate-600 leading-tight border-t border-slate-200">
                  Bằng chữ: <strong>{numberToVietnameseWords(grandTotal)}</strong>
                </div>
              )}
            </div>

            {/* Action Save Button */}
            <button
              type="button"
              disabled={isSavingFinance}
              onClick={handleSaveFinancial}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isSavingFinance ? (
                <>
                  <FiLoader className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang lưu dữ liệu...</span>
                </>
              ) : (
                <>
                  <FiSave className="h-3.5 w-3.5" />
                  <span>
                    {canEditFinancial ? "Lưu Tài Chính & OT" : "Lưu Số Giờ OT (UC06)"}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 7: Review & Approval (UC08, UC09, UC10) */}
        {activeTab === "review" && (
          <FinancialReviewPanel
            projectId={projectId}
            userRole={userRole}
            project={project}
            onRefreshData={onRefreshData}
          />
        )}
      </div>
    </div>
  );
};

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
} from "react-icons/fi";
import { toast } from "sonner";
import { api } from "../../lib/api";

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
  onUpdateRanges?: (ranges: Record<string, string>) => void;
  onRefreshData?: () => void;
  onOpenAssignModal?: () => void;
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
  onUpdateRanges,
  onRefreshData,
  onOpenAssignModal,
  onClose,
}) => {
  const isAdmin = userRole === "admin";
  const [activeTab, setActiveTab] = useState<"cell" | "permissions" | "members" | "history" | "structure">("cell");
  const [editingRange, setEditingRange] = useState<string>(editableRanges[currentSheet] || "");
  const [isSavingRange, setIsSavingRange] = useState(false);

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
      <div className="flex border-b border-slate-200 bg-slate-50/70 p-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("cell")}
          className={`flex-1 rounded-md py-1.5 font-semibold transition-all ${
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
          onClick={() => setActiveTab("permissions")}
          className={`flex-1 rounded-md py-1.5 font-semibold transition-all ${
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
          className={`flex-1 rounded-md py-1.5 font-semibold transition-all ${
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
          className={`flex-1 rounded-md py-1.5 font-semibold transition-all ${
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
            className={`flex-1 rounded-md py-1.5 font-semibold transition-all ${
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
                          {item.created_at ? new Date(item.created_at).toLocaleTimeString("vi-VN") : ""}
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
      </div>
    </div>
  );
};

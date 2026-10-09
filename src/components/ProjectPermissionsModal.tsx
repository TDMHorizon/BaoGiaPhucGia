import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";

function Badge({ children, className = "", variant = "default" }: { children: React.ReactNode; className?: string; variant?: "default" | "outline" }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}
import { 
  ShieldCheck, 
  ShieldAlert, 
  Target, 
  Eye, 
  Trash2, 
  Save, 
  User, 
  FileSpreadsheet, 
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers
} from "lucide-react";
import type { useUserPermissions } from "../hooks/useUserPermissions";

interface ProjectPermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  sheets: string[];
  activeSheet: string;
  currentSelectionStr: string;
  permissionsHook: ReturnType<typeof useUserPermissions>;
  onSwitchSheet: (sheetName: string) => void;
  onFocusRange: (rangeStr: string) => void;
}

export function ProjectPermissionsModal({
  open,
  onOpenChange,
  projectName,
  sheets,
  activeSheet,
  currentSelectionStr,
  permissionsHook,
  onSwitchSheet,
  onFocusRange,
}: ProjectPermissionsModalProps) {
  const {
    permissionUsers,
    permissionUserId,
    setPermissionUserId,
    permissionRanges,
    activePermissionField,
    setActivePermissionField,
    isLoading,
    isSaving,
    isDirty,
    updateRange,
    captureSelection,
    clearRange,
    viewRange,
    savePermissions,
  } = permissionsHook;

  const [activeTabSheet, setActiveTabSheet] = useState<string>(activeSheet || sheets[0] || "");

  const currentEmployee = permissionUsers.find((u) => u.id === permissionUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50">
        {/* Header */}
        <DialogHeader className="p-4 bg-white border-b border-slate-200 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  Phân Quyền Vùng Bảng Tính
                  {isDirty && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] animate-pulse">
                      Chưa lưu thay đổi
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Dự án: <span className="font-semibold text-slate-700">{projectName}</span>
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs h-8"
              >
                Đóng
              </Button>
              <Button
                onClick={savePermissions}
                disabled={isSaving || !permissionUserId || isLoading}
                size="sm"
                className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? "Đang lưu..." : "Lưu phân quyền"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Top Control Bar: Employee Selector & Active Canvas Range Helper */}
        <div className="bg-indigo-50/70 border-b border-indigo-100 p-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <User className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700 shrink-0">Nhân viên:</span>
            <select
              value={permissionUserId}
              onChange={(e) => setPermissionUserId(e.target.value)}
              className="h-8 flex-1 rounded-md border border-indigo-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-indigo-500"
            >
              {permissionUsers.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.username} (Nhân viên)
                </option>
              ))}
              {permissionUsers.length === 0 && (
                <option value="">Chưa có tài khoản nhân viên nào</option>
              )}
            </select>
          </div>

          {/* Quick Capture Status from Canvas */}
          <div className="flex items-center gap-2 bg-white/90 border border-indigo-200/80 rounded-lg px-3 py-1.5 text-xs shadow-2xs">
            <Target className="w-4 h-4 text-indigo-600 animate-pulse" />
            <span className="text-slate-600">Vùng chọn hiện tại:</span>
            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
              {activeSheet}!{currentSelectionStr || "A1"}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const sheet = activeTabSheet || activeSheet;
                captureSelection(sheet, "edit", currentSelectionStr);
              }}
              className="h-6 text-[11px] px-2 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 font-medium"
            >
              Nạp vào Vùng sửa
            </Button>
          </div>
        </div>

        {/* Body: Sheet Tabs & Range Pickers */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Sheet Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Sheet:
            </span>
            {sheets.map((sheet) => {
              const isSelected = activeTabSheet === sheet;
              const hasRanges = Boolean(
                permissionRanges[sheet]?.read || permissionRanges[sheet]?.edit
              );
              return (
                <button
                  key={sheet}
                  onClick={() => {
                    setActiveTabSheet(sheet);
                    if (sheet !== activeSheet) {
                      onSwitchSheet(sheet);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {sheet}
                  {hasRanges && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? "bg-emerald-300" : "bg-emerald-500"
                      }`}
                      title="Đã có cấu hình quyền"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Sheet Permission Card */}
          {activeTabSheet && (
            <div className="space-y-4">
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="py-3 px-4 bg-slate-50/70 border-b border-slate-200 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                    <CardTitle className="text-sm font-bold text-slate-800">
                      Cấu hình quyền cho Sheet: <span className="text-indigo-600">[{activeTabSheet}]</span>
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => clearRange(activeTabSheet)}
                      className="h-7 text-xs text-rose-600 hover:bg-rose-50 border-slate-200 gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa tất cả quyền sheet này
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Field 1: Vùng đọc (Read Ranges) */}
                  <div className="space-y-2 p-3.5 rounded-xl border border-blue-100 bg-blue-50/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 font-bold text-xs">
                          👁️ Vùng đọc (Read)
                        </Badge>
                        <span className="text-xs text-slate-500">
                          Nhân viên chỉ nhìn thấy dữ liệu trong các ô này. Dữ liệu ngoài vùng này sẽ bị ẩn.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Ví dụ: A1:H50, A:D, 1:10 (phân cách bằng dấu phẩy)"
                        value={permissionRanges[activeTabSheet]?.read || ""}
                        onChange={(e) => updateRange(activeTabSheet, "read", e.target.value)}
                        className="h-9 text-xs font-mono bg-white border-blue-200 focus:border-blue-500 flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => captureSelection(activeTabSheet, "read", currentSelectionStr)}
                        title="Lấy vùng đang bôi đen trên bảng tính nạp vào đây"
                        className="h-9 text-xs bg-white text-indigo-700 hover:bg-indigo-50 border-indigo-200 font-semibold gap-1 shrink-0"
                      >
                        <Target className="w-3.5 h-3.5 text-indigo-600" />
                        🎯 Lấy vùng chọn ({currentSelectionStr || "A1"})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewRange(activeTabSheet, permissionRanges[activeTabSheet]?.read || "")}
                        disabled={!permissionRanges[activeTabSheet]?.read}
                        className="h-9 text-xs bg-white text-slate-700 hover:bg-slate-100 border-slate-200 gap-1 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" /> Xem
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => clearRange(activeTabSheet, "read")}
                        className="h-9 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Field 2: Vùng sửa (Editable Ranges) */}
                  <div className="space-y-2 p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-xs">
                          ✏️ Vùng sửa (Edit)
                        </Badge>
                        <span className="text-xs text-slate-500">
                          Nhân viên được phép sửa giá trị trong các ô này (Sửa tự động bao gồm quyền Đọc).
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Ví dụ: A8:H20, D5:E10 (phân cách bằng dấu phẩy)"
                        value={permissionRanges[activeTabSheet]?.edit || ""}
                        onChange={(e) => updateRange(activeTabSheet, "edit", e.target.value)}
                        className="h-9 text-xs font-mono bg-white border-emerald-200 focus:border-emerald-500 flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => captureSelection(activeTabSheet, "edit", currentSelectionStr)}
                        title="Lấy vùng đang bôi đen trên bảng tính nạp vào đây"
                        className="h-9 text-xs bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200 font-semibold gap-1 shrink-0"
                      >
                        <Target className="w-3.5 h-3.5 text-emerald-600" />
                        🎯 Lấy vùng chọn ({currentSelectionStr || "A1"})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewRange(activeTabSheet, permissionRanges[activeTabSheet]?.edit || "")}
                        disabled={!permissionRanges[activeTabSheet]?.edit}
                        className="h-9 text-xs bg-white text-slate-700 hover:bg-slate-100 border-slate-200 gap-1 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" /> Xem
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => clearRange(activeTabSheet, "edit")}
                        className="h-9 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Summary & Guidance Note */}
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                    <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-800">Mẹo thao tác nhanh từ bảng tính:</p>
                      <p>
                        1. Đóng modal này hoặc kéo sang một bên $\rightarrow$ 2. Nhấp chuột kéo chọn vùng ô trên bảng tính (ví dụ <code className="bg-slate-200 px-1 rounded font-mono">A8:H15</code>) $\rightarrow$ 3. Mở lại modal và bấm nút <strong className="text-indigo-700">"🎯 Lấy vùng chọn"</strong> để tự động điền chính xác.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Multi-sheet Overview Matrix */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  Tổng quan phân quyền tất cả sheet của {currentEmployee?.username || "nhân viên"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {sheets.map((sheet) => {
                    const r = permissionRanges[sheet]?.read;
                    const e = permissionRanges[sheet]?.edit;
                    const isConfigured = Boolean(r || e);

                    return (
                      <div
                        key={sheet}
                        onClick={() => setActiveTabSheet(sheet)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          activeTabSheet === sheet
                            ? "border-indigo-400 bg-indigo-50/50 shadow-2xs ring-1 ring-indigo-300"
                            : isConfigured
                            ? "border-emerald-200 bg-emerald-50/20 hover:border-emerald-300"
                            : "border-slate-200 bg-slate-50/50 opacity-75 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800 truncate">{sheet}</span>
                          {isConfigured ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[9px] h-4">Đã phân</Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-slate-200 text-[9px] h-4">Mặc định đóng</Badge>
                          )}
                        </div>
                        <div className="space-y-0.5 font-mono text-[10px] text-slate-600">
                          <div className="truncate">👁️ Đọc: {r || "—"}</div>
                          <div className="truncate">✏️ Sửa: {e || "—"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

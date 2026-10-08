import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { AlertTriangle, Check, RefreshCw, Save } from "lucide-react";

export interface ConflictInfo {
  cell: string;
  sheetName: string;
  serverValue: string;
  serverRevision: number;
  serverUpdatedBy: string;
  clientValue: string;
  oldValue?: string;
}

interface VisualConflictResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ConflictInfo | null;
  onResolve: (chosenValue: string, expectedRevision: number) => void;
}

export const VisualConflictResolverModal: React.FC<VisualConflictResolverModalProps> = ({
  isOpen,
  onClose,
  conflict,
  onResolve,
}) => {
  if (!conflict) return null;

  const [selectedChoice, setSelectedChoice] = useState<"server" | "client">("client");
  const [customValue, setCustomValue] = useState<string>(conflict.clientValue);

  const handleConfirm = () => {
    const finalVal = selectedChoice === "server" ? conflict.serverValue : customValue;
    onResolve(finalVal, conflict.serverRevision);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white border border-slate-200 shadow-xl rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="p-1 rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </span>
            Phát Hiện Xung Đột Dữ Liệu Đồng Thời (409 Conflict)
          </DialogTitle>
        </DialogHeader>

        <div className="py-3 space-y-4 text-xs">
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-800 leading-relaxed">
            Ô <strong>{conflict.cell}</strong> (trên sheet <em>"{conflict.sheetName}"</em>) vừa được{" "}
            <strong>{conflict.serverUpdatedBy || "đồng nghiệp khác"}</strong> lưu một giá trị mới trong khi bạn đang thao tác.
            Vui lòng chọn giá trị muốn giữ để tránh ghi đè làm mất số liệu của đồng nghiệp:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cột 1: Dữ liệu mới nhất trên Server */}
            <div
              className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                selectedChoice === "server"
                  ? "border-sky-500 bg-sky-50/50 shadow-sm"
                  : "border-slate-200 bg-slate-50/60 hover:border-slate-300"
              }`}
              onClick={() => setSelectedChoice("server")}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-sky-800">
                  🔹 Giá trị mới nhất trên Server
                </span>
                {selectedChoice === "server" && (
                  <span className="p-0.5 rounded-full bg-sky-600 text-white">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="text-lg font-bold text-slate-900 p-2 bg-white rounded border border-slate-200 mb-2">
                {conflict.serverValue || <span className="text-slate-400 italic">Ô rỗng</span>}
              </div>
              <div className="text-[11px] text-slate-500">
                Cập nhật bởi: <strong>{conflict.serverUpdatedBy || "Người khác"}</strong> (Phiên bản rev #{conflict.serverRevision})
              </div>
            </div>

            {/* Cột 2: Dữ liệu bạn vừa nhập */}
            <div
              className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                selectedChoice === "client"
                  ? "border-emerald-500 bg-emerald-50/50 shadow-sm"
                  : "border-slate-200 bg-slate-50/60 hover:border-slate-300"
              }`}
              onClick={() => setSelectedChoice("client")}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-emerald-800">
                  🔸 Giá trị bạn vừa nhập
                </span>
                {selectedChoice === "client" && (
                  <span className="p-0.5 rounded-full bg-emerald-600 text-white">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <input
                className="w-full text-lg font-bold text-slate-900 p-2 bg-white rounded border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
                value={customValue}
                onChange={(e) => {
                  setCustomValue(e.target.value);
                  setSelectedChoice("client");
                }}
              />
              <div className="text-[11px] text-slate-500">
                Số liệu bạn đã chỉnh sửa cục bộ tại phiên này
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 text-slate-600"
            onClick={onClose}
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Hủy sửa & Tải lại từ Server
          </Button>

          <Button
            size="sm"
            className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            onClick={handleConfirm}
          >
            <Save className="w-3 h-3 mr-1" />
            {selectedChoice === "server" ? "Giữ giá trị của Server" : "Xác nhận Lưu giá trị của bạn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

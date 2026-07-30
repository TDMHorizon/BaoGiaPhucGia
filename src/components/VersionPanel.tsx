import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { downloadBase64File } from "../lib/excel";
import { toast } from "sonner";

export function VersionPanel({ projectId }: { projectId: string }) {
  const [versions, setVersions] = useState<any[]>([]);

  const load = async () => {
    try {
      setVersions(await api.getVersions(projectId));
    } catch {
      setVersions([]);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const handleDownload = async (version: number) => {
    try {
      const data = await api.getVersionFile(projectId, version);
      downloadBase64File(data.fileBase64, `baogia_v${version}.xlsx`);
      toast.success(`Đã tải phiên bản v${version}`);
    } catch (e: any) {
      toast.error(e.message || "Không tải được phiên bản");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">Phiên bản đã duyệt</h4>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={load}>Làm mới</Button>
      </div>
      {versions.length === 0 ? (
        <p className="text-xs text-slate-400">Chưa có snapshot. Snapshot được tạo khi admin duyệt báo giá.</p>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <div>
                <p className="text-xs font-bold text-slate-800">Phiên bản v{v.version}</p>
                <p className="text-[10px] text-slate-500">
                  {v.createdBy} · {new Date(v.createdAt).toLocaleString("vi-VN")}
                  {v.note ? ` · ${v.note}` : ""}
                </p>
              </div>
              <Button size="sm" className="h-7 text-xs" onClick={() => handleDownload(v.version)}>
                Tải Excel
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

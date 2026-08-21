import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { downloadBase64File } from "../lib/excel";
import { toast } from "sonner";

interface Version {
  id: string;
  version: number;
  createdBy: string;
  createdAt: string;
  note?: string;
}

export function VersionPanel({ projectId }: { projectId: string }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.getVersions(projectId);
      setVersions(data);
    } catch {
      toast.error("Không tải được lịch sử phiên bản");
      setVersions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const handleDownload = async (version: number) => {
    try {
      setLoading(true);
      const data = await api.getVersionFile(projectId, version);
      downloadBase64File(data.fileBase64, `baogia_v${version}.xlsx`);
      toast.success(`Đã tải phiên bản v${version}`);
    } catch (e: any) {
      toast.error(e.message || "Không tải được phiên bản");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-headline-md text-on-surface font-semibold">Phiên bản đã duyệt</h4>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-label-sm"
          onClick={load}
          disabled={loading}
        >
          <svg className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Làm mới
        </Button>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-8 px-4 bg-surface-container-lowest rounded-xl border border-outline">
          <svg className="w-12 h-12 mx-auto text-outline mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-body-md text-secondary">Chưa có snapshot</p>
          <p className="text-label-sm text-secondary/70 mt-1">Snapshot được tạo khi admin duyệt báo giá</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between p-4 rounded-xl bg-surface-container-lowest border border-outline hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-label-sm font-semibold bg-primary-fixed text-primary">
                    v{v.version}
                  </span>
                  {v.note && (
                    <span className="text-label-sm text-secondary truncate">{v.note}</span>
                  )}
                </div>
                <p className="text-label-md font-medium text-on-surface">{v.createdBy}</p>
                <p className="text-label-sm text-secondary">
                  {new Date(v.createdAt).toLocaleString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="ml-4 h-9 text-label-sm shrink-0"
                onClick={() => handleDownload(v.version)}
                disabled={loading}
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Tải Excel
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

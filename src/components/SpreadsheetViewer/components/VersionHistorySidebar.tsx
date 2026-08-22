import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Button } from '../../ui/button';
import { downloadBase64File } from '../../../lib/excel';
import { toast } from 'sonner';

interface Version {
  id: string;
  version: number;
  createdBy: string;
  createdAt: string;
  note?: string;
}

interface VersionHistorySidebarProps {
  projectId: string;
  currentVersion?: number;
  onRestore?: (version: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const VersionHistorySidebar = React.memo(({
  projectId,
  currentVersion,
  onRestore,
  isOpen,
  onToggle
}: VersionHistorySidebarProps) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredVersion, setHoveredVersion] = useState<number | null>(null);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const data = await api.getVersions(projectId);
      setVersions(data);
    } catch (e) {
      toast.error("Không tải được lịch sử phiên bản");
      setVersions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, projectId]);

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

  const handleRestore = (version: number) => {
    onRestore?.(version);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={`
          absolute right-0 top-1/2 -translate-y-1/2 z-30
          flex items-center gap-2
          px-3 py-4
          bg-surface-container-lowest border border-l-0 border-outline
          rounded-l-lg shadow-lg
          hover:bg-surface-container-high transition-all
          ${isOpen ? 'translate-x-full' : 'translate-x-0'}
        `}
      >
        <svg
          className={`w-5 h-5 text-on-surface-variant transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-label-lg font-medium text-on-surface-variant writing-mode-vertical">
          Lịch sử
        </span>
      </button>

      {/* Sidebar Panel */}
      <div
        className={`
          absolute right-0 top-0 bottom-0 z-40
          w-[280px] h-full
          bg-surface-container-lowest border-l border-outline
          shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-outline">
          <h3 className="text-headline-md text-on-surface font-semibold">Lịch sử phiên bản</h3>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-hover-state transition-colors"
          >
            <svg className="w-5 h-5 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && versions.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-outline mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-body-md text-secondary">Chưa có phiên bản nào</p>
              <p className="text-label-sm text-secondary/70 mt-1">Phiên bản được tạo khi báo giá được duyệt</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {versions.map((v) => (
                <li
                  key={v.id}
                  onMouseEnter={() => setHoveredVersion(v.version)}
                  onMouseLeave={() => setHoveredVersion(null)}
                  className={`
                    relative
                    p-4 rounded-xl
                    border transition-all duration-200
                    ${currentVersion === v.version
                      ? 'bg-primary-fixed border-primary shadow-sm'
                      : 'bg-surface-container-lowest border-outline hover:border-primary/50 hover:shadow-sm'
                    }
                  `}
                >
                  {/* Version Badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`
                        inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-semibold
                        ${currentVersion === v.version
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface-container-high text-on-surface-variant'
                        }
                      `}>
                        v{v.version}
                      </span>
                      {currentVersion === v.version && (
                        <span className="text-label-sm text-primary font-medium">Hiện tại</span>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1 mb-3">
                    <p className="text-label-md font-medium text-on-surface">
                      {v.createdBy}
                    </p>
                    <p className="text-label-sm text-secondary">
                      {new Date(v.createdAt).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                    {v.note && (
                      <p className="text-label-sm text-secondary/80 italic mt-1">{v.note}</p>
                    )}
                  </div>

                  {/* Action Buttons - Reveal on hover */}
                  <div className={`
                    flex gap-2 transition-opacity duration-200
                    ${hoveredVersion === v.version ? 'opacity-100' : 'opacity-0'}
                  `}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-label-sm"
                      onClick={() => handleDownload(v.version)}
                      disabled={loading}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Tải
                    </Button>
                    {onRestore && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-label-sm text-primary border-primary/50 hover:bg-primary/10"
                        onClick={() => handleRestore(v.version)}
                        disabled={loading}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Khôi phục
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-outline">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-9"
            onClick={loadVersions}
            disabled={loading}
          >
            <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Làm mới
          </Button>
        </div>
      </div>
    </>
  );
});

VersionHistorySidebar.displayName = 'VersionHistorySidebar';

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { fileToBase64, parseExcel } from "../../lib/excel";
import { AppShell } from "../../layout/AppShell";
import { AdminHome } from "./AdminHome";
import { UserHome } from "./UserHome";
import { toast } from "sonner";
import { FiExternalLink, FiFileText } from "react-icons/fi";

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [edits, setEdits] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [projList, pendingRes] = await Promise.all([
        api.getProjects().catch(() => []),
        api.getPendingCount().catch(() => ({ count: 0 })),
      ]);

      const validProjects = Array.isArray(projList) ? projList : [];
      setProjects(validProjects);
      setPendingCount(pendingRes?.count || 0);

      if (validProjects.length > 0) {
        const firstProj = validProjects[0];
        setSelectedProject(firstProj);
        try {
          const firstEdits = await api.getEdits(firstProj.id);
          setEdits(Array.isArray(firstEdits) ? firstEdits : []);
        } catch {
          setEdits([]);
        }
      }
    } catch (e) {
      console.error("Lỗi tải dữ liệu Dashboard Trang chủ:", e);
      toast.error("Không thể tải thông tin Dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user?.id]);

  const handleSelectProject = async (id: string) => {
    const found = projects.find((p) => p.id === id);
    if (found) {
      setSelectedProject(found);
      try {
        const pEdits = await api.getEdits(id);
        setEdits(Array.isArray(pEdits) ? pEdits : []);
      } catch {
        setEdits([]);
      }
    }
  };

  const handleUploadFile = async (file: File) => {
    try {
      toast.info("Đang xử lý tải file Excel lên hệ thống...");
      const base64 = await fileToBase64(file);
      const workbook = await parseExcel(base64);
      const sheets = workbook.SheetNames;
      const created = await api.createProject(file.name, base64, sheets);
      toast.success(`Đã tạo dự án mới từ file "${file.name}"`);
      await loadDashboardData();
      if (created?.id) {
        navigate(`/quotes/${created.id}/editor`);
      }
    } catch (err: any) {
      console.error("Lỗi upload file:", err);
      toast.error(err.message || "Không thể tải file Excel lên");
    }
  };

  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  return (
    <AppShell
      title={isAdminOrManager ? "Trang Chủ • Tổng Quan Báo Giá" : "Trang Chủ • Không Gian Làm Việc"}
      subtitle={
        isAdminOrManager
          ? "Mục 7.1.2: Theo dõi dự án, số lượng báo giá, hoạt động gần đây và cập nhật file Excel"
          : "Theo dõi các báo giá được giao và nhật ký cập nhật biểu mẫu"
      }
      headerAction={
        selectedProject ? (
          <button
            type="button"
            onClick={() => navigate(`/quotes/${selectedProject.id}/editor`)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#105CB3] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#268DF0] transition-colors"
          >
            <FiExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mở Trình Soạn Thảo:</span>
            <span className="max-w-[150px] truncate">{selectedProject.name}</span>
          </button>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[#105CB3]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#105CB3] border-t-transparent" />
            <span>Đang tải số liệu tổng quan hệ thống...</span>
          </div>
        </div>
      ) : isAdminOrManager ? (
        <AdminHome
          projects={projects}
          edits={edits}
          pendingCount={pendingCount}
          selectedProject={selectedProject}
          onUploadFile={handleUploadFile}
          onSelectProject={handleSelectProject}
        />
      ) : (
        <UserHome
          projects={projects}
          edits={edits}
          selectedProject={selectedProject}
          onSelectProject={handleSelectProject}
          onOpenProjects={() => navigate("/quotes")}
        />
      )}
    </AppShell>
  );
};

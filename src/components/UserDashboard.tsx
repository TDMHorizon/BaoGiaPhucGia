import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { parseExcel, getSheetData, applyEditsToWorkbook, downloadBase64File } from "../lib/excel";
import { isCellInRange } from "../lib/utils-excel";
import { loadExcelJSWorkbook, updateMergedCellInExcelJS, workbookToBase64 } from "../lib/exceljs-helper";
import { SpreadsheetViewer } from "./SpreadsheetViewer";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "./ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { FolderOpen, Download, Printer, Search } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { StatusWorkflow } from "./StatusWorkflow";
import { isLockedStatus, TRANG_THAI_LABELS, type TrangThai } from "../lib/constants";
import { printProjectAsPdf } from "../lib/printPdf";
import { UserLayout } from "../layout/UserLayout";
import { UserHome } from "./pages/UserHome";
import { ROUTES } from "../router";

function getEditableRange(project: any, sheetName: string): string {
  if (!project?.editableRanges) return "";

  try {
    const ranges = typeof project.editableRanges === "string"
      ? JSON.parse(project.editableRanges)
      : project.editableRanges;
    return typeof ranges?.[sheetName] === "string" ? ranges[sheetName] : "";
  } catch {
    return "";
  }
}

export function UserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [exceljsWorkbook, setExceljsWorkbook] = useState<any | null>(null);
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [edits, setEdits] = useState<any[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const locked = isLockedStatus(selectedProject?.trangThai);

  useEffect(() => {
    loadProjects();
  }, [searchQ, filterStatus]);


  const loadProjects = async () => {
    try {
      const data = await api.getProjectByUserId();

      const query = searchQ.trim().toLowerCase();
      const filteredData = data.filter((project: any) => {
        if (filterStatus && project.trangThai !== filterStatus) return false;
        if (!query) return true;
        return `${project.name} ${project.soBaoGia || ""} ${project.tenKhachHang || ""} ${project.ghiChu || ""}`.toLowerCase().includes(query);
      });

      setProjects(filteredData);
    } catch (e: any) {
      toast.error(e.message || "Không tải được danh sách");
    }
  };

  const handleSelectProject = async (id: string) => {
    try {
      const project = await api.getProject(id);
      if (!project.fileBase64) throw new Error("Báo giá chưa có tệp Excel.");

      const wb = await parseExcel(project.fileBase64);
      const projectEdits = await api.getEdits(id);
      const updatedWb = applyEditsToWorkbook(wb, projectEdits);

      setSelectedProject(project);
      setEdits(projectEdits);
      setWorkbook(updatedWb);

      const ejWb = await loadExcelJSWorkbook(project.fileBase64);
      projectEdits.forEach((edit: any) => {
        const ws = ejWb.getWorksheet(edit.sheetName);
        if (ws) {
          updateMergedCellInExcelJS(ws, edit.cell, edit.newValue);
        }
      });
      setExceljsWorkbook(ejWb);

      if (updatedWb.SheetNames.length > 0) {
        handleTabChange(updatedWb.SheetNames[0], updatedWb);
      }
    } catch (e: any) {
      console.error("Lỗi khi tải file Excel:", e);
      setSelectedProject(null);
      setWorkbook(null);
      setExceljsWorkbook(null);
      setSheetData([]);
      setActiveSheet("");
      toast.error(e.message || "Không thể hiển thị file Excel.");
    }
  };

  const handleTabChange = (sheetName: string, wb = workbook) => {
    if (!wb) return;
    setActiveSheet(sheetName);
    const data = getSheetData(wb, sheetName);
    setSheetData(data);
    setSelectedColumn(null);
  };



  const handleCellChange = async (r: number, c: number, newValue: string) => {
    if (!selectedProject || !workbook || !exceljsWorkbook) return;
    if (locked) {
      toast.error("Báo giá đã khóa, không thể chỉnh sửa.");
      return;
    }
    const cellRef = XLSX.utils.encode_cell({ r, c });
    const rangeStr = getEditableRange(selectedProject, activeSheet);

    if (!isCellInRange(cellRef, rangeStr)) {
      toast.error("Bạn không có quyền sửa ô này.");
      return;
    }

    const ws = workbook.Sheets[activeSheet];
    const cellObj = ws ? ws[cellRef] : null;
    const oldValue = cellObj && cellObj.v !== undefined && cellObj.v !== null ? String(cellObj.v) : "";
    if (oldValue === newValue) return;

    const newData = [...sheetData];
    if (!newData[r]) newData[r] = [];
    else newData[r] = [...newData[r]];
    newData[r][c] = newValue;
    setSheetData(newData);

    try {
      const editData = {
        userId: user?.id,
        username: user?.username,
        sheetName: activeSheet,
        cell: cellRef,
        oldValue,
        newValue,
      };
      const savedEdit = await api.saveEdit(selectedProject.id, editData);
      setEdits(prev => [...prev, savedEdit]);

      applyEditsToWorkbook(workbook, [savedEdit]);

      const ejWs = exceljsWorkbook.getWorksheet(activeSheet);
      if (ejWs) {
        updateMergedCellInExcelJS(ejWs, cellRef, newValue);
      }

      toast.success("Đã lưu");
    } catch (error: any) {
      toast.error(error.message || "Lưu thất bại");
    }
  };

  const handleSearchReplace = async () => {
    if (!searchQuery || !selectedProject || !workbook || !exceljsWorkbook) return;
    if (locked) {
      toast.error("Báo giá đã khóa, không thể chỉnh sửa.");
      return;
    }
    const rangeStr = getEditableRange(selectedProject, activeSheet);

    let replacedCount = 0;
    const newEdits: any[] = [];
    const newData = [...sheetData];

    const escapedSearchQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearchQuery, matchCase ? 'g' : 'gi');

    for (let r = 0; r < newData.length; r++) {
      if (!newData[r]) continue;
      let rowCopied = false;
      for (let c = 0; c < newData[r].length; c++) {
        const cellValue = String(newData[r][c] || "");
        if (cellValue.match(searchRegex)) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (isCellInRange(cellRef, rangeStr)) {
            if (!rowCopied) {
              newData[r] = [...newData[r]];
              rowCopied = true;
            }
            const newValue = cellValue.replace(searchRegex, replaceQuery);
            newData[r][c] = newValue;

            newEdits.push({
              userId: user?.id,
              username: user?.username,
              sheetName: activeSheet,
              cell: cellRef,
              oldValue: cellValue,
              newValue,
            });
            replacedCount++;
          }
        }
      }
    }

    if (replacedCount > 0) {
      setSheetData(newData);
      for (const edit of newEdits) {
        const savedEdit = await api.saveEdit(selectedProject.id, edit);
        setEdits(prev => [...prev, savedEdit]);
        applyEditsToWorkbook(workbook, [savedEdit]);

        const ejWs = exceljsWorkbook.getWorksheet(edit.sheetName);
        if (ejWs) {
          updateMergedCellInExcelJS(ejWs, edit.cell, edit.newValue);
        }
      }

      toast.success(`Đã thay thế ${replacedCount} vị trí.`);
    } else {
      toast.info("Không tìm thấy trong vùng được phép sửa.");
    }
  };

  const handleExport = async () => {
    if (!selectedProject || !exceljsWorkbook) return;
    try {
      const base64 = await workbookToBase64(exceljsWorkbook);
      downloadBase64File(base64, selectedProject.name?.replace(/\.xlsx$/i, "") || "baogia");
      toast.success("Đã tải Excel (đã áp dụng các ô bạn điền). Bản gốc trên hệ thống không đổi.");
    } catch (e) {
      console.error(e);
      toast.error("Không thể xuất tệp Excel!");
    }
  };

  return (
    <UserLayout
      username={user?.username}
      activeTab={activeTab}
      isMobileOpen={showMobileNav}
      isCollapsed={isSidebarCollapsed}
      onTabChange={setActiveTab}
      onMobileOpenChange={setShowMobileNav}
      onToggleNavigation={() => { if (window.innerWidth >= 768) setIsSidebarCollapsed(prev => !prev); else setShowMobileNav(true); }}
      onProfile={() => navigate(ROUTES.profile)}
      onLogout={logout}
    >
    {activeTab === "dashboard" ? (
      <UserHome
        projects={projects}
        edits={edits}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onOpenProjects={() => setActiveTab("file")}
      />
    ) : <div className="flex h-full flex-col">
      {/* Top Ribbon */}
      <div className="bg-[#f3f2f1] flex flex-col shrink-0 border-b border-slate-300">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* <TabsList className="h-8 bg-white border-b border-slate-300 rounded-none w-full justify-start px-2 gap-1 mb-0">
            <TabsTrigger value="file" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none px-4 text-xs bg-transparent data-[state=active]:bg-white">Tệp</TabsTrigger>
            <TabsTrigger value="home" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none px-4 text-xs bg-transparent data-[state=active]:bg-white">Trang chủ</TabsTrigger>
          </TabsList> */}
          
          <div className="h-24 bg-white/50 px-2 py-1 flex items-start gap-4 overflow-x-auto custom-scrollbar">
            
            <TabsContent value="file" className="m-0 h-full flex items-start gap-2 pt-1 data-[state=inactive]:hidden">
              <div className="flex flex-col items-center">
                <Dialog>
                  <DialogTrigger render={<Button variant="ghost" className="h-14 min-w-[80px] px-2 flex flex-col gap-1 rounded-sm hover:bg-indigo-50" />}>
                      <FolderOpen className="w-6 h-6 text-indigo-600" strokeWidth={1.5} />
                      <span className="text-[10px] font-medium leading-none text-center">
                        {selectedProject ? selectedProject.name.slice(0, 15) + (selectedProject.name.length > 15 ? "..." : "") : "Chọn Báo Giá"}
                      </span>
                    </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Báo giá được giao</DialogTitle></DialogHeader>
                    {/* Project list code from before... */}
                    <div className="space-y-3 mt-2">
                      <p className="text-xs text-slate-500 font-normal">Điền các ô được phép, rồi tải Excel để gửi khách. Bản gốc do admin cấu hình không bị thay đổi.</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input placeholder="Tìm tên / số BG / khách hàng..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="h-9 text-sm" />
                        <select className="h-9 text-sm border border-slate-200 rounded-md px-2 bg-white" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                          <option value="">Tất cả trạng thái</option>
                          {(Object.keys(TRANG_THAI_LABELS) as TrangThai[]).map((s) => (
                            <option key={s} value={s}>{TRANG_THAI_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                      <ul className="space-y-2">
                        {projects.map((p) => (
                          <li key={p.id}>
                            <DialogClose render={<Button variant="outline" className={`w-full justify-between font-medium text-slate-700 hover:text-indigo-700 hover:bg-indigo-50/50 h-auto py-3 ${selectedProject?.id === p.id ? "bg-indigo-50 border-indigo-300" : ""}`} onClick={() => handleSelectProject(p.id)} />}>
                                <span className="text-left">
                                  <span className="block font-bold">{p.name}</span>
                                  <span className="block text-[11px] text-slate-400 font-normal">{p.soBaoGia || "Chưa có số BG"} · {p.tenKhachHang || "Chưa có KH"}</span>
                                </span>
                                <StatusBadge status={p.trangThai as TrangThai} />
                            </DialogClose>
                          </li>
                        ))}
                        {projects.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">Chưa có báo giá nào được giao cho bạn hoặc phù hợp với tìm kiếm.</p>}
                      </ul>
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Tệp tin</div>
              </div>

              {selectedProject && (
                <>
                  <div className="w-px h-14 bg-slate-200 mx-2" />
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 h-14">
                      <Button variant="ghost" onClick={handleExport} className="h-14 w-16 flex flex-col gap-1 rounded-sm hover:bg-emerald-50">
                        <Download className="w-6 h-6 text-emerald-600" strokeWidth={1.5} />
                        <span className="text-[10px] font-medium leading-none">Tải Excel</span>
                      </Button>
                      <Button variant="ghost" onClick={() => { if (!printProjectAsPdf(selectedProject, sheetData, activeSheet)) toast.error("Trình duyệt chặn cửa sổ in PDF"); }} className="h-14 w-16 flex flex-col gap-1 rounded-sm hover:bg-rose-50">
                        <Printer className="w-6 h-6 text-rose-600" strokeWidth={1.5} />
                        <span className="text-[10px] font-medium leading-none">Xuất PDF</span>
                      </Button>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Xuất file</div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="home" className="m-0 h-full flex items-start gap-4 pt-1 data-[state=inactive]:hidden w-full">
              {!selectedProject ? (
                <div className="flex items-center justify-center w-full h-full">
                  <p className="text-xs text-slate-400 italic">Vui lòng chọn báo giá ở tab Tệp</p>
                </div>
              ) : (
                <>
                  {!locked && (
                    <div className="flex flex-col items-center">
                      <Dialog>
                        <DialogTrigger render={<Button variant="ghost" className="h-14 w-20 flex flex-col gap-1 rounded-sm hover:bg-blue-50" />}>
                            <Search className="w-6 h-6 text-blue-600" strokeWidth={1.5} />
                            <span className="text-[10px] font-medium leading-none">Tìm/Thay thế</span>
                          </DialogTrigger>
                        <DialogContent className="sm:max-w-md w-full">
                          <DialogHeader><DialogTitle>Tìm & thay thế (chỉ ô được phép)</DialogTitle></DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Tìm kiếm</label>
                              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Nội dung cần tìm..." />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Thay thế bằng</label>
                              <Input value={replaceQuery} onChange={e => setReplaceQuery(e.target.value)} placeholder="Nội dung thay thế..." />
                            </div>
                            <div className="flex items-center space-x-2">
                              <input type="checkbox" id="matchCase" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} className="rounded border-gray-300 w-4 h-4" />
                              <label htmlFor="matchCase" className="text-sm font-medium">Phân biệt hoa thường</label>
                            </div>
                            <DialogClose render={<Button onClick={handleSearchReplace} className="w-full bg-indigo-600 hover:bg-indigo-700" />}>Thay tất cả</DialogClose>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Công cụ</div>
                    </div>
                  )}
                  
                  <div className="w-px h-14 bg-slate-200 mx-2" />
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="h-14 flex items-center">
                      <StatusWorkflow project={selectedProject} role="user" onUpdated={(p) => { setSelectedProject(p); loadProjects(); }} />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Main Spreadsheet Area */}
      <div className="flex-1 bg-slate-200 p-2 overflow-hidden flex flex-col">
        {!selectedProject ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-slate-300 rounded-xl bg-white shadow-sm">
            <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-bold text-base text-slate-800 mb-1">Chưa chọn báo giá</h3>
            <p className="text-xs text-slate-500">Mở Danh sách Báo Giá ở thanh công cụ phía trên để bắt đầu.</p>
          </div>
        ) : (
          <div className="flex-1 bg-white shadow-xl rounded-xl border border-slate-300 flex flex-col overflow-hidden">
            <div className="bg-slate-100 border-b flex px-2 pt-2 gap-1 overflow-x-auto shrink-0 custom-scrollbar">
              {workbook?.SheetNames.map(name => (
                <button
                  key={name}
                  onClick={() => handleTabChange(name)}
                  className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border border-b-0 ${activeSheet === name ? "bg-white text-indigo-700 border-slate-300 relative translate-y-[1px]" : "bg-slate-200 text-slate-600 hover:bg-slate-300 border-transparent"}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <SpreadsheetViewer
              workbook={workbook}
              exceljsWorkbook={exceljsWorkbook}
              sheetData={sheetData}
              activeSheet={activeSheet}
              mode="user"
              locked={locked}
                editableRange={getEditableRange(selectedProject, activeSheet)}
              selectedColumn={selectedColumn}
              onColumnClick={(i) => setSelectedColumn(selectedColumn === i ? null : i)}
              onCellEdit={handleCellChange}
            />
            {locked && (
              <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 shrink-0 flex items-center justify-center text-amber-700 text-xs font-bold gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Báo giá này đã được duyệt/gửi khách hàng. Bạn chỉ có thể xem và tải về.
              </div>
            )}
          </div>
        )}
      </div>
    </div>}
    </UserLayout>
  );
};

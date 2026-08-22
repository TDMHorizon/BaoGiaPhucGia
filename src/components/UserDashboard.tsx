import { useState, useEffect } from "react";
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

export function UserDashboard() {
  const { user } = useAuth();
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

  const locked = isLockedStatus(selectedProject?.trangThai);

  useEffect(() => {
    loadProjects();
  }, [searchQ, filterStatus]);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects({ q: searchQ || undefined, status: filterStatus || undefined });
      setProjects(data);
    } catch (e: any) {
      toast.error(e.message || "Không tải được danh sách");
    }
  };

  const handleSelectProject = async (id: string) => {
    const project = await api.getProject(id);
    setSelectedProject(project);

    const wb = await parseExcel(project.fileBase64);
    const projectEdits = await api.getEdits(id);
    setEdits(projectEdits);

    const updatedWb = applyEditsToWorkbook(wb, projectEdits);
    setWorkbook(updatedWb);

    try {
      const ejWb = await loadExcelJSWorkbook(project.fileBase64);
      projectEdits.forEach((edit: any) => {
        const ws = ejWb.getWorksheet(edit.sheetName);
        if (ws) {
          updateMergedCellInExcelJS(ws, edit.cell, edit.newValue);
        }
      });
      setExceljsWorkbook(ejWb);
    } catch (e) {
      console.error("Lỗi khi tải ExcelJS trong select project:", e);
    }

    if (updatedWb.SheetNames.length > 0) {
      handleTabChange(updatedWb.SheetNames[0], updatedWb);
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
    const rangeStr = selectedProject.editableRanges?.[activeSheet];

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
    const rangeStr = selectedProject.editableRanges?.[activeSheet];

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
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Top Ribbon - Stitch Design */}
      <div className="bg-surface-dim flex flex-col shrink-0 border-b border-outline">
        <Tabs defaultValue="home" className="w-full">
          <TabsList className="h-10 bg-surface-container-lowest border-b border-outline rounded-none w-full justify-start px-3 gap-1 mb-0">
            <TabsTrigger value="file" className="h-full rounded-none border-b-2 border-transparent data-[active]:border-primary data-[active]:text-primary data-[active]:shadow-none px-4 text-label-lg bg-transparent data-[active]:bg-surface-container-lowest">Tệp</TabsTrigger>
            <TabsTrigger value="home" className="h-full rounded-none border-b-2 border-transparent data-[active]:border-primary data-[active]:text-primary data-[active]:shadow-none px-4 text-label-lg bg-transparent data-[active]:bg-surface-container-lowest">Trang chủ</TabsTrigger>
          </TabsList>

          <div className="h-24 bg-surface-container-lowest/50 px-3 py-2 flex items-start gap-4 overflow-x-auto custom-scrollbar">

            <TabsContent value="file" className="m-0 h-full flex items-start gap-2 pt-1 data-[hidden]:hidden">
              <div className="flex flex-col items-center">
                <Dialog>
                  <DialogTrigger>
                    <Button variant="ghost" className="h-14 min-w-[80px] px-2 flex flex-col gap-1 rounded-lg hover:bg-hover-state transition-colors">
                      <FolderOpen className="w-6 h-6 text-primary" strokeWidth={1.5} />
                      <span className="text-[10px] font-medium leading-none text-center text-on-surface-variant">
                        {selectedProject ? selectedProject.name.slice(0, 15) + (selectedProject.name.length > 15 ? "..." : "") : "Chọn Báo Giá"}
                      </span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="!max-w-[672px] w-full max-h-[90vh] overflow-y-auto bg-surface-container-lowest rounded-xl border border-outline">
                    <DialogHeader><DialogTitle className="text-headline-md text-on-surface">Báo giá được giao</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-4">
                      <p className="text-body-md text-secondary">Điền các ô được phép, rồi tải Excel để gửi khách. Bản gốc do admin cấu hình không bị thay đổi.</p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Input placeholder="Tìm tên / số BG / khách hàng..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="h-10 text-body-md" />
                        <select className="h-10 text-body-md border border-outline rounded-lg px-3 bg-surface-container-lowest focus:outline-none focus:border-primary hover:bg-hover-state" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                          <option value="">Tất cả trạng thái</option>
                          {(Object.keys(TRANG_THAI_LABELS) as TrangThai[]).map((s) => (
                            <option key={s} value={s}>{TRANG_THAI_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                      <ul className="space-y-2">
                        {projects.map((p) => (
                          <li key={p.id}>
                            <DialogClose asChild>
                              <button className={`w-full flex items-center justify-between text-left font-medium text-on-surface h-auto py-3 px-4 rounded-lg border transition-colors hover:bg-hover-state ${selectedProject?.id === p.id ? "bg-primary-fixed border-primary" : "bg-surface-container-lowest border-outline"}`} onClick={() => handleSelectProject(p.id)}>
                                <span className="text-left">
                                  <span className="block font-semibold text-on-surface">{p.name}</span>
                                  <span className="block text-label-sm text-secondary font-normal">{p.soBaoGia || "Chưa có số BG"} · {p.tenKhachHang || "Chưa có KH"}</span>
                                </span>
                                <StatusBadge status={p.trangThai as TrangThai} />
                              </button>
                            </DialogClose>
                          </li>
                        ))}
                        {projects.length === 0 && <p className="text-body-md text-secondary py-4 text-center">Chưa có báo giá nào được giao cho bạn hoặc phù hợp với tìm kiếm.</p>}
                      </ul>
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="text-[9px] text-secondary mt-1 uppercase tracking-wider font-semibold">Tệp tin</div>
              </div>

              {selectedProject && (
                <>
                  <div className="w-px h-14 bg-outline mx-2" />
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 h-14">
                      <Button variant="ghost" onClick={handleExport} className="h-14 w-16 flex flex-col gap-1 rounded-lg hover:bg-success/10 transition-colors">
                        <Download className="w-6 h-6 text-success" strokeWidth={1.5} />
                        <span className="text-[10px] font-medium leading-none text-on-surface-variant">Tải Excel</span>
                      </Button>
                      <Button variant="ghost" onClick={() => { if (!printProjectAsPdf(selectedProject, sheetData, activeSheet)) toast.error("Trình duyệt chặn cửa sổ in PDF"); }} className="h-14 w-16 flex flex-col gap-1 rounded-lg hover:bg-destructive/10 transition-colors">
                        <Printer className="w-6 h-6 text-destructive" strokeWidth={1.5} />
                        <span className="text-[10px] font-medium leading-none text-on-surface-variant">Xuất PDF</span>
                      </Button>
                    </div>
                    <div className="text-[9px] text-secondary mt-1 uppercase tracking-wider font-semibold">Xuất file</div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="home" className="m-0 h-full flex items-start gap-4 pt-1 data-[hidden]:hidden w-full">
              {!selectedProject ? (
                <div className="flex items-center justify-center w-full h-full">
                  <p className="text-body-md text-secondary italic">Vui lòng chọn báo giá ở tab Tệp</p>
                </div>
              ) : (
                <>
                  {!locked && (
                    <div className="flex flex-col items-center">
                      <Dialog>
                        <DialogTrigger>
                          <Button variant="ghost" className="h-14 w-20 flex flex-col gap-1 rounded-lg hover:bg-hover-state transition-colors">
                            <Search className="w-6 h-6 text-primary" strokeWidth={1.5} />
                            <span className="text-[10px] font-medium leading-none text-on-surface-variant">Tìm/Thay thế</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md w-full bg-surface-container-lowest rounded-xl border border-outline">
                          <DialogHeader><DialogTitle className="text-headline-md text-on-surface">Tìm & thay thế (chỉ ô được phép)</DialogTitle></DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label className="text-label-lg font-medium text-on-surface">Tìm kiếm</label>
                              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Nội dung cần tìm..." className="h-10" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-label-lg font-medium text-on-surface">Thay thế bằng</label>
                              <Input value={replaceQuery} onChange={e => setReplaceQuery(e.target.value)} placeholder="Nội dung thay thế..." className="h-10" />
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="checkbox" id="matchCase" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} className="rounded border-outline w-4 h-4" />
                              <label htmlFor="matchCase" className="text-label-lg font-medium text-on-surface">Phân biệt hoa thường</label>
                            </div>
                            <DialogClose asChild>
                              <Button onClick={handleSearchReplace} className="w-full bg-primary-container text-on-primary hover:bg-primary-container/90 h-10">Thay tất cả</Button>
                            </DialogClose>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <div className="text-[9px] text-secondary mt-1 uppercase tracking-wider font-semibold">Công cụ</div>
                    </div>
                  )}

                  <div className="w-px h-14 bg-outline mx-2" />
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

      {/* Main Spreadsheet Area - Stitch Design */}
      <div className="flex-1 bg-surface-dim p-3 overflow-hidden flex flex-col">
        {!selectedProject ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-outline rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="w-16 h-16 rounded-full bg-primary-fixed border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-title-lg text-on-surface mb-1">Chưa chọn báo giá</h3>
            <p className="text-body-md text-secondary">Mở Danh sách Báo Giá ở thanh công cụ phía trên để bắt đầu.</p>
          </div>
        ) : (
          <div className="flex-1 bg-surface-container-lowest shadow-lg rounded-xl border border-outline flex flex-col overflow-hidden">
            <SpreadsheetViewer
              workbook={workbook}
              exceljsWorkbook={exceljsWorkbook}
              sheetData={sheetData}
              activeSheet={activeSheet}
              sheetNames={workbook?.SheetNames || []}
              mode="user"
              locked={locked}
              editableRange={selectedProject.editableRanges?.[activeSheet] || ""}
              selectedColumn={selectedColumn}
              fileName={selectedProject.name}
              showToolbar={false}
              onSheetClick={handleTabChange}
              onColumnClick={(i) => setSelectedColumn(selectedColumn === i ? null : i)}
              onCellEdit={handleCellChange}
            />
            {locked && (
              <div className="bg-warning/10 border-t border-warning/30 px-4 py-3 shrink-0 flex items-center justify-center text-warning gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-label-lg font-medium">Báo giá này đã được duyệt/gửi khách hàng. Bạn chỉ có thể xem và tải về.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

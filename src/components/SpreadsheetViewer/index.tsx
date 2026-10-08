import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type ExcelJS from 'exceljs';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreViVN from '@univerjs/preset-sheets-core/locales/vi-VN';
import '@univerjs/preset-sheets-core/lib/index.css';
import { WrapStrategy } from '@univerjs/core';

import { convertExcelToUniverData } from './utils/univerAdapter';
import { isCellInRange } from '../../lib/utils-excel';
import { 
  FileSpreadsheet, 
  Maximize2, 
  Minimize2, 
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  WrapText,
  PaintBucket,
  Rows3,
  Columns3,
  Layout,
  Printer,
  Percent,
  Filter,
  Clipboard,
  Undo2,
  Redo2,
  Grid2X2,
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Sigma, 
  HelpCircle, 
  Search, 
  BarChart2, 
  Eye, 
  TableProperties, 
  Info,
  Sparkles,
  Layers,
  CheckCircle2,
  X,
  Save,
  DollarSign,
  Hash,
  RotateCcw,
  Eraser
} from 'lucide-react';
import { toast } from 'sonner';

type RibbonTab = 'home' | 'insert' | 'pageLayout' | 'formulas' | 'data' | 'review' | 'view' | 'help';

const ribbonTabs: { id: RibbonTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'pageLayout', label: 'Page Layout' },
  { id: 'formulas', label: 'Formulas' },
  { id: 'data', label: 'Data' },
  { id: 'review', label: 'Review' },
  { id: 'view', label: 'View' },
  { id: 'help', label: 'Help' },
];

const ribbonSearchItems: { label: string; tab: RibbonTab; fullscreen?: boolean }[] = [
  { label: 'Bold', tab: 'home' },
  { label: 'Italic', tab: 'home' },
  { label: 'Alignment', tab: 'home' },
  { label: 'Cell fill color', tab: 'home' },
  { label: 'Merge cells', tab: 'home' },
  { label: 'Number format', tab: 'home' },
  { label: 'Insert rows and columns', tab: 'insert' },
  { label: 'Page layout and print settings', tab: 'pageLayout' },
  { label: 'Insert formula', tab: 'formulas' },
  { label: 'Sort and filter', tab: 'data' },
  { label: 'Protect sheet', tab: 'review' },
  { label: 'Allow edit ranges', tab: 'review' },
  { label: 'Full screen', tab: 'view', fullscreen: true },
];

export interface SpreadsheetViewerProps {
  workbook: XLSX.WorkBook | null;
  exceljsWorkbook: ExcelJS.Workbook | null;
  sheetData: any[][];
  activeSheet: string;
  mode: 'user' | 'admin';
  locked?: boolean;
  editableRange?: string;
  selectedRange?: string;
  selectedColumn?: number | null;
  previewLimit?: number;
  onColumnClick?: (colIndex: number) => void;
  onRowClick?: (rowIndex: number) => void;
  onCellEdit?: (r: number, c: number, newValue: string) => void;
  onCellMouseDown?: (r: number, c: number) => void;
  onCellMouseEnter?: (r: number, c: number) => void;
  onToggleLock?: (locked: boolean) => void;
  onUpdateEditableRange?: (newRange: string) => void;
  onSave?: () => void | Promise<void>;
  hasUnsavedChanges?: boolean;
}

export function SpreadsheetViewer({
  workbook,
  exceljsWorkbook,
  activeSheet,
  mode,
  locked = false,
  editableRange = '',
  onCellEdit,
  onCellMouseDown,
  onToggleLock,
  onUpdateEditableRange,
  onSave,
  hasUnsavedChanges = false,
}: SpreadsheetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<any>(null);
  const univerAPIRef = useRef<any>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>('home');
  const [currentSelectionStr, setCurrentSelectionStr] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const [showAllowEditDialog, setShowAllowEditDialog] = useState(false);
  const [ribbonSearch, setRibbonSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [fillColor, setFillColor] = useState('#fff2cc');
  const [fontColor, setFontColor] = useState('#000000');
  const [stats, setStats] = useState<{ rows: number; cols: number; cells: number }>({ rows: 0, cols: 0, cells: 0 });

  const setFullscreen = useCallback((fullscreen: boolean) => {
    setIsFullscreen(fullscreen);
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setFullscreen(false);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (onSave) onSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, setFullscreen, onSave]);

  const matchingSearchItems = ribbonSearchItems.filter(item =>
    item.label.toLowerCase().includes(ribbonSearch.trim().toLowerCase())
  );

  const selectSearchItem = (item: typeof ribbonSearchItems[number]) => {
    setShowSearchResults(false);
    setRibbonSearch('');
    if (item.fullscreen) {
      toggleFullscreen();
      return;
    }
    setActiveRibbonTab(item.tab);
  };

  // Initialize Univer
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    while (host.firstChild) {
      host.removeChild(host.firstChild);
    }

    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    host.appendChild(container);

    let univerInstance: any = null;

    try {
      const { univer, univerAPI } = createUniver({
        locale: LocaleType.VI_VN,
        locales: {
          [LocaleType.VI_VN]: mergeLocales(UniverPresetSheetsCoreViVN),
        },
        presets: [
          UniverSheetsCorePreset({
            container,
            header: false,
            toolbar: true,
            formulaBar: true,
            contextMenu: true,
            footer: {
              sheetBar: true,
              statisticBar: true,
            },
          }),
        ],
      });

      univerInstance = univer;
      univerRef.current = univer;
      univerAPIRef.current = univerAPI;

      const snapshot = convertExcelToUniverData({
        workbook,
        exceljsWorkbook,
        activeSheet,
        mode,
        editableRange,
      });

      univerAPI.createWorkbook(snapshot);
      const fWorkbook = univerAPI.getActiveWorkbook();

      if (fWorkbook) {
        if (activeSheet) {
          const targetWs = fWorkbook.getSheetByName(activeSheet);
          if (targetWs) fWorkbook.setActiveSheet(targetWs);
        }

        fWorkbook.onSelectionChange((selections: any[]) => {
          if (!selections?.length) return;
          const sel = selections[0];
          const range = sel?.range ?? sel;
          const sr: number = range?.startRow ?? 0;
          const sc: number = range?.startColumn ?? 0;
          const er: number = range?.endRow ?? sr;
          const ec: number = range?.endColumn ?? sc;
          const a = XLSX.utils.encode_cell({ r: sr, c: sc });
          const b = XLSX.utils.encode_cell({ r: er, c: ec });
          setCurrentSelectionStr(a === b ? a : `${a}:${b}`);
          if (mode === 'admin') onCellMouseDown?.(sr, sc);
        });

        fWorkbook.onCommandExecuted((command: any) => {
          if (!command?.id) return;
          if (!command.id.includes('set-range-values')) return;

          const params = command.params;
          const rangeParam = params?.range;
          const valueParam = params?.cellValue ?? params?.value;
          if (!rangeParam || valueParam == null) return;

          const r: number = rangeParam.startRow ?? 0;
          const c: number = rangeParam.startColumn ?? 0;
          const cellRef = XLSX.utils.encode_cell({ r, c });

          let newVal = '';
          try {
            const rowMap = valueParam && typeof valueParam === 'object' && !Array.isArray(valueParam)
              ? Object.values(valueParam)[0]
              : valueParam;
            const cellData: any = rowMap && typeof rowMap === 'object' && !Array.isArray(rowMap)
              ? Object.values(rowMap)[0]
              : rowMap;

            if (cellData?.v !== undefined && cellData?.v !== null) {
              newVal = String(cellData.v);
            } else if (cellData?.f) {
              newVal = `=${cellData.f}`;
            } else if (typeof cellData === 'string' || typeof cellData === 'number') {
              newVal = String(cellData);
            }
          } catch { newVal = ''; }

          setTimeout(() => {
            try {
              const currentRange = univerAPIRef.current?.getActiveWorkbook()?.getActiveSheet()?.getRange(r, c, 1, 1);
              const evaluatedVal = currentRange?.getValue();
              if (evaluatedVal !== undefined && evaluatedVal !== null && evaluatedVal !== '') {
                newVal = String(evaluatedVal);
              }
            } catch { /* ignore */ }

            if (mode === 'user' && editableRange && !isCellInRange(cellRef, editableRange)) {
              toast.error(`Ô ${cellRef} không nằm trong vùng được phép sửa.`);
              return;
            }
            onCellEdit?.(r, c, newVal);
          }, 60);
        });
      }

      if (workbook?.Sheets?.[activeSheet]) {
        const ws = workbook.Sheets[activeSheet];
        if (ws['!ref']) {
          const range = XLSX.utils.decode_range(ws['!ref']);
          setStats({
            rows: range.e.r - range.s.r + 1,
            cols: range.e.c - range.s.c + 1,
            cells: Object.keys(ws).filter(k => !k.startsWith('!')).length,
          });
        }
      }

      setIsReady(true);
    } catch (err) {
      console.error('Failed to initialize Univer:', err);
    }

    return () => {
      setIsReady(false);
      queueMicrotask(() => {
        try { univerInstance?.dispose(); } catch { /* ignore */ }
        try { container?.parentNode?.removeChild(container); } catch { /* ignore */ }
      });
    };
  }, [workbook, exceljsWorkbook, mode, locked, editableRange]);

  // Sync activeSheet
  useEffect(() => {
    if (!isReady || !univerAPIRef.current || !activeSheet) return;
    try {
      const fWorkbook = univerAPIRef.current.getActiveWorkbook();
      if (fWorkbook) {
        const targetWs = fWorkbook.getSheetByName(activeSheet);
        if (targetWs) {
          fWorkbook.setActiveSheet(targetWs);
        }
      }
    } catch (e) {
      console.warn('Failed to switch sheet:', e);
    }
  }, [activeSheet, isReady]);

  // Handlers for Review tab actions
  const handleAddSelectionToEditableRange = () => {
    if (!currentSelectionStr) {
      toast.error('Vui lòng chọn một ô hoặc bôi đen một vùng trước.');
      return;
    }
    const currentParts = editableRange.split(',').map(s => s.trim()).filter(Boolean);
    if (currentParts.includes(currentSelectionStr)) {
      toast.info(`Vùng ${currentSelectionStr} đã có trong danh sách được phép sửa.`);
      return;
    }
    const newRange = [...currentParts, currentSelectionStr].join(', ');
    if (onUpdateEditableRange) {
      onUpdateEditableRange(newRange);
      toast.success(`Đã thêm vùng ${currentSelectionStr} vào vùng được phép sửa.`);
    } else {
      toast.info(`Đã chọn vùng: ${currentSelectionStr}`);
    }
  };

  const handleRemoveSelectionFromEditableRange = () => {
    if (!currentSelectionStr) {
      toast.error('Vui lòng chọn một vùng cần xóa quyền.');
      return;
    }
    const currentParts = editableRange.split(',').map(s => s.trim()).filter(Boolean);
    const updated = currentParts.filter(p => p !== currentSelectionStr).join(', ');
    if (onUpdateEditableRange) {
      onUpdateEditableRange(updated);
      toast.success(`Đã gỡ quyền vùng ${currentSelectionStr}.`);
    }
  };

  const handleInsertFormula = (formulaName: string) => {
    if (!univerAPIRef.current) return;
    try {
      const fWorkbook = univerAPIRef.current.getActiveWorkbook();
      const activeRange = fWorkbook?.getActiveSheet()?.getActiveRange();
      if (activeRange) {
        activeRange.setValue(`=${formulaName}()`);
        toast.success(`Đã chèn hàm =${formulaName}()`);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const applySelectionFormat = (
    format: 'bold' | 'italic' | 'left' | 'center' | 'right' | 'wrap' | 'merge' | 'unmerge' | 'fill' | 'fontColor' | 'number' | 'currency' | 'percent' | 'text' | 'clearFormat',
    color?: string
  ) => {
    if (locked && mode === 'user') {
      toast.info('Bảng tính đã khóa; bạn chỉ có thể xem dữ liệu.');
      return;
    }

    const activeRange = univerAPIRef.current?.getActiveWorkbook()?.getActiveSheet()?.getActiveRange();
    if (!activeRange) {
      toast.error('Vui lòng chọn một ô hoặc vùng trước.');
      return;
    }

    try {
      switch (format) {
        case 'bold':
          activeRange.setFontWeight('bold');
          break;
        case 'italic':
          activeRange.setFontStyle('italic');
          break;
        case 'left':
        case 'center':
        case 'right':
          activeRange.setHorizontalAlignment(format);
          break;
        case 'wrap':
          activeRange.setWrapStrategy(WrapStrategy.WRAP);
          break;
        case 'merge':
          activeRange.merge();
          toast.success('Đã gộp ô');
          break;
        case 'unmerge':
          activeRange.unmerge();
          toast.success('Đã hủy gộp ô');
          break;
        case 'fill':
          activeRange.setBackgroundColor(color || fillColor);
          break;
        case 'fontColor':
          activeRange.setFontColor(color || fontColor);
          break;
        case 'number':
          activeRange.setNumberFormat('#,##0');
          toast.success('Định dạng: Số nguyên (#,##0)');
          break;
        case 'currency':
          activeRange.setNumberFormat('#,##0 "₫"');
          toast.success('Định dạng: Tiền tệ (VNĐ)');
          break;
        case 'percent':
          activeRange.setNumberFormat('0.00%');
          toast.success('Định dạng: Phần trăm (%)');
          break;
        case 'text':
          activeRange.setNumberFormat('@');
          toast.success('Định dạng: Văn bản (Text)');
          break;
        case 'clearFormat':
          activeRange.clearFormat();
          toast.success('Đã xóa định dạng');
          break;
      }
    } catch (error) {
      console.error('Failed to format selected cells:', error);
      toast.error('Không thể áp dụng định dạng cho vùng đã chọn.');
    }
  };

  const ribbonButtonClass = 'inline-flex min-w-12 flex-col items-center justify-center gap-1 rounded px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400';
  const selectionButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-slate-700 hover:border-slate-300 hover:bg-slate-100';

  return (
    <div 
      className={`bg-white flex flex-col transition-all duration-200 select-none ${
        isFullscreen 
          ? 'fixed inset-0 z-[9999] w-screen h-screen shadow-2xl' 
          : 'flex-1 w-full h-full min-h-[550px] relative rounded-xl border border-slate-300 shadow-xl overflow-hidden'
      }`}
    >
      {/* 1. TOP EXCEL 365 TITLE BAR (Xanh lá đặc trưng của Microsoft Excel) */}
      <div className="bg-[#107c41] text-white px-3 py-1.5 flex items-center justify-between text-xs shrink-0 select-none shadow-sm">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="w-4 h-4 text-white" />
          <span className="font-semibold tracking-wide">
            Excel Báo Giá {activeSheet ? `- [${activeSheet}]` : ''}
          </span>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white/90 font-medium">
            {mode === 'admin' ? 'Quản Trị Viên' : 'Người Dùng'}
          </span>
          {locked ? (
            <span className="text-[10px] bg-amber-400 text-amber-950 font-bold px-2 py-0.5 rounded flex items-center gap-1">
              <Lock className="w-3 h-3" /> Đã Khóa
            </span>
          ) : (
            <span className="text-[10px] bg-emerald-300 text-emerald-950 font-medium px-2 py-0.5 rounded flex items-center gap-1">
              <Unlock className="w-3 h-3" /> Cho Phép Sửa
            </span>
          )}
        </div>

        <div className="relative hidden md:block">
          <div className="flex w-64 items-center gap-2 rounded-md border border-[#0d6b38] bg-[#0b5c30] px-2.5 text-white/80 focus-within:border-white/60">
            <Search className="h-3.5 w-3.5 shrink-0 text-white/60" />
            <input
              type="search"
              value={ribbonSearch}
              onChange={event => {
                setRibbonSearch(event.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              onKeyDown={event => {
                if (event.key === 'Enter' && matchingSearchItems[0]) {
                  selectSearchItem(matchingSearchItems[0]);
                } else if (event.key === 'Escape') {
                  setShowSearchResults(false);
                  setRibbonSearch('');
                }
              }}
              placeholder="Search"
              aria-label="Search ribbon commands"
              className="h-7 min-w-0 flex-1 bg-transparent text-[11px] text-white placeholder:text-white/70 outline-none"
            />
          </div>
          {showSearchResults && ribbonSearch.trim() && (
            <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-slate-800 shadow-lg">
              {matchingSearchItems.length ? matchingSearchItems.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => selectSearchItem(item)}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-100"
                >
                  {item.label}
                </button>
              )) : (
                <p className="px-3 py-2 text-xs text-slate-500">No matching commands</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions, Status and Fullscreen Toggle Button */}
        <div className="flex items-center gap-2">
          {onSave && (
            <button
              onClick={() => onSave()}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                hasUnsavedChanges
                  ? 'bg-amber-400 hover:bg-amber-300 text-amber-950 ring-2 ring-white/50 animate-pulse'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title="Lưu tất cả thay đổi (Ctrl + S)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{hasUnsavedChanges ? 'Lưu *' : 'Đã lưu'}</span>
            </button>
          )}

          {currentSelectionStr && (
            <span className="hidden sm:inline-flex text-[11px] bg-white/20 text-white px-2 py-0.5 rounded font-mono font-medium">
              Ô: {currentSelectionStr}
            </span>
          )}
          
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Return to normal size' : 'Expand spreadsheet to full screen'}
            aria-pressed={isFullscreen}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 active:bg-white/30 text-white font-medium text-xs transition-colors cursor-pointer"
            title={isFullscreen ? 'Thu nhỏ lại (ESC)' : 'Phóng to toàn màn hình'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thu nhỏ</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Toàn màn hình</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-300 bg-[#f3f2f1] px-2 pt-1 text-xs custom-scrollbar">
        {ribbonTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeRibbonTab === tab.id}
            onClick={() => setActiveRibbonTab(tab.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${
              activeRibbonTab === tab.id
                ? 'border-[#107c41] bg-white font-bold text-slate-900'
                : 'border-transparent text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. CONTEXTUAL RIBBON ACTIONS BAR (Thay đổi theo từng Tab bạn chọn) */}
      <div className="flex min-h-[84px] shrink-0 flex-wrap items-stretch gap-2 border-b border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">
        {/* TAB REVIEW: PHÂN QUYỀN & BẢO VỆ */}
        {activeRibbonTab === 'review' && (
          <div className="flex w-full items-stretch gap-2 overflow-x-auto">
            {onToggleLock && (
              <div className="flex min-w-36 flex-col items-center justify-center border-r border-slate-200 pr-3">
                <button
                  onClick={() => onToggleLock(!locked)}
                  className={`flex flex-col items-center gap-1 rounded px-3 py-1 font-medium transition-colors cursor-pointer ${
                  locked
                    ? 'text-amber-900 hover:bg-amber-50'
                    : 'text-slate-800 hover:bg-slate-100'
                }`}
                >
                  {locked ? <Unlock className="h-6 w-6 text-amber-700" /> : <Lock className="h-6 w-6 text-slate-700" />}
                  <span className="text-[10px]">{locked ? 'Unprotect Sheet' : 'Protect Sheet'}</span>
                </button>
                <span className="mt-auto text-[9px] text-slate-500">Protection</span>
              </div>
            )}

            {mode === 'admin' && (
              <>
                <button
                  onClick={handleAddSelectionToEditableRange}
                  className="flex flex-col items-center justify-center gap-1 rounded px-3 text-emerald-800 transition-colors hover:bg-emerald-50"
                  title="Cấp quyền sửa cho ô/vùng đang bôi đen"
                >
                  <Plus className="h-6 w-6 text-emerald-700" />
                  <span className="text-[10px]">Allow Edit Ranges</span>
                  <span className="font-mono text-[9px]">{currentSelectionStr || '(Select range)'}</span>
                </button>

                {currentSelectionStr && editableRange.includes(currentSelectionStr) && (
                  <button
                    onClick={handleRemoveSelectionFromEditableRange}
                    className="flex flex-col items-center justify-center gap-1 rounded px-3 text-rose-700 transition-colors hover:bg-rose-50"
                  >
                    <Trash2 className="h-6 w-6" />
                    <span className="text-[10px]">Remove Range</span>
                  </button>
                )}

                <button
                  onClick={() => setShowAllowEditDialog(true)}
                  className="flex flex-col items-center justify-center gap-1 rounded px-3 text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <TableProperties className="h-6 w-6" />
                  <span className="text-[10px]">Manage Ranges</span>
                  <span className="text-[9px]">{editableRange ? editableRange.split(',').length : 0} ranges</span>
                </button>
              </>
            )}

            <div className="ml-auto flex items-center gap-3 self-center border-l border-slate-200 pl-3 text-[10px] text-slate-500">
              <span>Rows: <strong>{stats.rows}</strong></span>
              <span>Columns: <strong>{stats.cols}</strong></span>
              <span>Cells: <strong>{stats.cells}</strong></span>
            </div>
          </div>
        )}

        {/* TAB FORMULAS: CÔNG THỨC */}
        {activeRibbonTab === 'formulas' && (
          <div className="flex items-stretch gap-2">
            <div className="flex flex-col items-center justify-center border-r border-slate-200 pr-3">
              <Sigma className="h-6 w-6 text-[#107c41]" />
              <span className="mt-1 text-[9px] text-slate-500">Function Library</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', 'IF', 'VLOOKUP'].map(fn => (
                <button
                  key={fn}
                  onClick={() => handleInsertFormula(fn)}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                >
                  ={fn}()
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB HOME: ĐẦY ĐỦ FORMAT, FONT, ALIGNMENT, MERGE, NUMBER */}
        {activeRibbonTab === 'home' && (
          <div className="flex w-full items-stretch gap-2 overflow-x-auto">
            <div className="relative flex items-center gap-1 border-r border-slate-200 pb-3 pr-2">
              <button type="button" className={ribbonButtonClass} disabled title="Sử dụng thanh công cụ bên dưới">
                <Clipboard className="h-5 w-5" /><span>Paste</span>
              </button>
              <button type="button" className={ribbonButtonClass} disabled title="Undo sẵn sàng trên thanh công cụ">
                <Undo2 className="h-4 w-4" /><span>Undo</span>
              </button>
              <button type="button" className={ribbonButtonClass} disabled title="Redo sẵn sàng trên thanh công cụ">
                <Redo2 className="h-4 w-4" /><span>Redo</span>
              </button>
              <span className="absolute bottom-0 left-0 right-2 text-center text-[9px] text-slate-500">Clipboard</span>
            </div>

            {/* Font formatting */}
            <div className="relative flex items-center gap-1 border-r border-slate-200 px-2 pb-3">
              <button type="button" onClick={() => applySelectionFormat('bold')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Đậm (Bold)"><Bold className="h-4 w-4" /></button>
              <button type="button" onClick={() => applySelectionFormat('italic')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Nghiêng (Italic)"><Italic className="h-4 w-4" /></button>
              <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-slate-700 hover:bg-slate-100" title="Màu chữ">
                <span className="flex flex-col items-center text-xs font-bold">A<span className="h-1 w-4" style={{ backgroundColor: fontColor }} /></span>
                <input aria-label="Font color" type="color" value={fontColor} disabled={locked && mode === 'user'} onChange={event => { setFontColor(event.target.value); applySelectionFormat('fontColor', event.target.value); }} className="sr-only" />
              </label>
              <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-slate-700 hover:bg-slate-100" title="Màu nền ô (Fill)">
                <PaintBucket className="h-4 w-4" />
                <input aria-label="Cell fill color" type="color" value={fillColor} disabled={locked && mode === 'user'} onChange={event => { setFillColor(event.target.value); applySelectionFormat('fill', event.target.value); }} className="sr-only" />
              </label>
              <span className="absolute bottom-0 left-2 right-2 text-center text-[9px] text-slate-500">Font</span>
            </div>

            {/* Alignment */}
            <div className="relative flex items-center gap-1 border-r border-slate-200 px-2 pb-3">
              <button type="button" onClick={() => applySelectionFormat('left')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Căn trái"><AlignLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => applySelectionFormat('center')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Căn giữa"><AlignCenter className="h-4 w-4" /></button>
              <button type="button" onClick={() => applySelectionFormat('right')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Căn phải"><AlignRight className="h-4 w-4" /></button>
              <button type="button" onClick={() => applySelectionFormat('wrap')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Ngắt dòng (Wrap text)"><WrapText className="h-4 w-4" /></button>
              <span className="absolute bottom-0 left-2 right-2 text-center text-[9px] text-slate-500">Alignment</span>
            </div>

            {/* Merge & Unmerge Group */}
            <div className="relative flex items-center gap-1 border-r border-slate-200 px-2 pb-3">
              <button 
                type="button" 
                onClick={() => applySelectionFormat('merge')} 
                disabled={locked && mode === 'user'} 
                className="flex items-center gap-1 h-8 px-2 rounded border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-800 hover:bg-slate-100" 
                title="Gộp các ô đang chọn"
              >
                <Grid2X2 className="h-3.5 w-3.5 text-emerald-700" />
                <span>Merge</span>
              </button>
              <button 
                type="button" 
                onClick={() => applySelectionFormat('unmerge')} 
                disabled={locked && mode === 'user'} 
                className="flex items-center gap-1 h-8 px-2 rounded border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-800 hover:bg-slate-100" 
                title="Hủy gộp ô"
              >
                <Layers className="h-3.5 w-3.5 text-amber-700" />
                <span>Unmerge</span>
              </button>
              <span className="absolute bottom-0 left-2 right-2 text-center text-[9px] text-slate-500">Merge Cells</span>
            </div>

            {/* Number Format */}
            <div className="relative flex items-center gap-1 border-r border-slate-200 px-2 pb-3">
              <button type="button" onClick={() => applySelectionFormat('number')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Định dạng số (#,##0)"><Hash className="h-4 w-4" /></button>
              <button type="button" onClick={() => applySelectionFormat('currency')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Tiền tệ (VNĐ)"><DollarSign className="h-4 w-4" /></button>
              <button type="button" onClick={() => applySelectionFormat('percent')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Phần trăm (%)"><Percent className="h-4 w-4" /></button>
              <span className="absolute bottom-0 left-2 right-2 text-center text-[9px] text-slate-500">Number Format</span>
            </div>

            {/* Clear Formats */}
            <div className="relative flex items-center gap-1 px-2 pb-3">
              <button type="button" onClick={() => applySelectionFormat('clearFormat')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Xóa định dạng (Clear Format)"><Eraser className="h-4 w-4 text-rose-600" /></button>
              <span className="absolute bottom-0 left-2 right-2 text-center text-[9px] text-slate-500">Clear</span>
            </div>

            {mode === 'user' && (
              <span className="ml-auto self-center rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                Ô xanh là vùng được phép sửa
              </span>
            )}
          </div>
        )}

        {activeRibbonTab === 'insert' && (
          <div className="flex items-stretch gap-2">
            <div className="flex flex-col items-center justify-center border-r border-slate-200 px-3">
              <Rows3 className="h-6 w-6 text-slate-500" />
              <span className="mt-1 text-[10px] text-slate-600">Rows</span>
            </div>
            <div className="flex flex-col items-center justify-center border-r border-slate-200 px-3">
              <Columns3 className="h-6 w-6 text-slate-500" />
              <span className="mt-1 text-[10px] text-slate-600">Columns</span>
            </div>
            <p className="self-center text-[11px] text-slate-500">Nhấp chuột phải vào bảng tính để Chèn hoặc Xóa dòng/cột.</p>
          </div>
        )}

        {activeRibbonTab === 'pageLayout' && (
          <div className="flex items-stretch gap-2">
            <div className="flex flex-col items-center justify-center border-r border-slate-200 px-3">
              <Layout className="h-6 w-6 text-slate-500" />
              <span className="mt-1 text-[10px] text-slate-600">Page Setup</span>
            </div>
            <button type="button" className={ribbonButtonClass} disabled><span>Margins</span></button>
            <button type="button" className={ribbonButtonClass} disabled><span>Orientation</span></button>
            <button type="button" className={ribbonButtonClass} disabled><span>Print Area</span></button>
            <div className="flex flex-col items-center justify-center border-l border-slate-200 px-3">
              <Printer className="h-6 w-6 text-slate-400" />
              <span className="mt-1 text-[10px] text-slate-400">Printing options</span>
            </div>
          </div>
        )}

        {activeRibbonTab === 'data' && (
          <div className="flex items-stretch gap-2">
            <div className="flex flex-col items-center justify-center border-r border-slate-200 px-3">
              <Filter className="h-6 w-6 text-slate-500" />
              <span className="mt-1 text-[10px] text-slate-600">Sort & Filter</span>
            </div>
            <p className="self-center text-[11px] text-slate-500">Sử dụng thanh công cụ hoặc menu chuột phải để Lọc & Sắp xếp dữ liệu.</p>
          </div>
        )}

        {activeRibbonTab === 'view' && (
          <div className="flex items-stretch gap-2">
            <button
              onClick={toggleFullscreen}
              className="flex min-w-28 flex-col items-center justify-center gap-1 rounded px-3 text-slate-800 transition-colors hover:bg-slate-100"
            >
              {isFullscreen ? <Minimize2 className="h-6 w-6" /> : <Maximize2 className="h-6 w-6" />}
              <span className="text-[10px]">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
            </button>
            <div className="flex flex-col items-center justify-center border-l border-slate-200 px-3">
              <Eye className="h-6 w-6 text-slate-400" />
              <span className="mt-1 text-[10px] text-slate-500">View options</span>
            </div>
            <span className="self-center text-[10px] text-slate-500">Nhấn phím ESC để trở về kích thước bình thường.</span>
          </div>
        )}

        {activeRibbonTab === 'help' && (
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <HelpCircle className="w-4 h-4 text-[#107c41]" />
            <span>Sử dụng thanh công cụ để chỉnh sửa, tính toán và xuất dữ liệu. Nhấn Ctrl+S hoặc nút "Lưu" để lưu báo giá.</span>
          </div>
        )}
      </div>

      {/* 4. MAIN UNIVER CANVAS HOST CONTAINER */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full h-full relative overflow-hidden bg-white" 
        style={{ minHeight: isFullscreen ? 0 : '520px' }}
      />

      {/* 5. DIALOG: QUẢN LÝ DANH SÁCH VÙNG ĐƯỢC PHÉP SỬA (ALLOW EDIT RANGES) */}
      {showAllowEditDialog && (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-300 overflow-hidden">
            <div className="bg-[#107c41] text-white px-4 py-2.5 flex items-center justify-between font-semibold text-sm">
              <span className="flex items-center gap-1.5">
                <TableProperties className="w-4 h-4" />
                Quản Lý Vùng Được Phép Sửa (Allow Edit Ranges)
              </span>
              <button 
                onClick={() => setShowAllowEditDialog(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Các vùng dưới đây cho phép nhân viên (User) nhập liệu trên sheet <strong>{activeSheet}</strong>:
              </p>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-mono font-semibold text-slate-800 break-words">
                {editableRange || '(Chưa có vùng nào được cấp quyền)'}
              </div>

              {currentSelectionStr && (
                <div className="pt-2 flex items-center justify-between bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 text-xs">
                  <span className="text-emerald-800 font-medium">Vùng đang chọn: <strong>{currentSelectionStr}</strong></span>
                  <button
                    onClick={handleAddSelectionToEditableRange}
                    className="px-2.5 py-1 bg-[#107c41] hover:bg-[#0b5c30] text-white rounded text-xs font-medium cursor-pointer"
                  >
                    Thêm vùng này
                  </button>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setShowAllowEditDialog(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-medium cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

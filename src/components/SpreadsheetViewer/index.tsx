import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type ExcelJS from 'exceljs';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreViVN from '@univerjs/preset-sheets-core/locales/vi-VN';
import '@univerjs/preset-sheets-core/lib/index.css';
import { convertExcelToUniverData } from './utils/univerAdapter';
import { isCellInRange } from '../../lib/utils-excel';
import { normalizeSelectionWithMerges, resolveMergeInfo, type IRange as MergeIRange } from '../../lib/mergeResolver';
import { 
  FormatPainterManager, 
  classifyUniverCommand, 
  toggleRangeBold, 
  toggleRangeItalic, 
  applyFormatCellsOptionsToRange,
  WRAP_STRATEGY_WRAP
} from './utils/univerCommandAdapter';
import { FormulaBar } from './components/FormulaBar';
import { FormatCellsModal, WINDOWS_FONTS, type CellFormatOptions } from './components/FormatCellsModal';
import { FindReplaceModal } from './components/FindReplaceModal';
import { ImageOverlay, type FloatingImage } from './components/ImageOverlay';
import { executeSortWorksheet } from './utils/sortEngine';
import { exportUniverToExcelFile } from '../../lib/exportExcel';
import { printSpreadsheetDirectly } from '../../lib/printEngine';
import { clientLogger } from '../../lib/logger';
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
  Paintbrush,
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
  Plus, 
  Trash2, 
  Sigma, 
  HelpCircle, 
  Search, 
  Eye, 
  TableProperties, 
  Save,
  DollarSign,
  Hash,
  Eraser,
  Download,
  ArrowUpAZ,
  ArrowDownAZ,
  Image as ImageIcon,
  Sliders,
  X
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
  { label: 'Format Cells (Định dạng ô)', tab: 'home' },
  { label: 'Number format', tab: 'home' },
  { label: 'Insert image / picture', tab: 'insert' },
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
  const formatPainterRef = useRef<FormatPainterManager>(new FormatPainterManager());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>('home');
  const [currentSelectionStr, setCurrentSelectionStr] = useState<string>('A1');
  const [activeCellValue, setActiveCellValue] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  
  // Modals
  const [showAllowEditDialog, setShowAllowEditDialog] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showFormatCellsModal, setShowFormatCellsModal] = useState(false);

  // Styling & Painter
  const [painterMode, setPainterMode] = useState<'inactive' | 'single' | 'persistent'>('inactive');
  const [currentFont, setCurrentFont] = useState('Calibri');
  const [currentFontSize, setCurrentFontSize] = useState(11);
  const [fillColor, setFillColor] = useState('#fff2cc');
  const [fontColor, setFontColor] = useState('#000000');
  
  // Floating Images
  const [images, setImages] = useState<FloatingImage[]>([]);

  // Search & Stats
  const [ribbonSearch, setRibbonSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [stats, setStats] = useState<{ rows: number; cols: number; cells: number }>({ rows: 0, cols: 0, cells: 0 });

  const setFullscreen = useCallback((fullscreen: boolean) => {
    setIsFullscreen(fullscreen);
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
  }, []);

  // Format painter subscription
  useEffect(() => {
    const unsub = formatPainterRef.current.subscribe(mode => {
      setPainterMode(mode);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (painterMode !== 'inactive') {
          formatPainterRef.current.reset();
          toast.info('Đã hủy chế độ sao chép định dạng.');
        } else if (isFullscreen) {
          setFullscreen(false);
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (onSave) onSave();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setShowFindReplace(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        setShowFormatCellsModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, setFullscreen, onSave, painterMode]);

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
            toolbar: false, // We use custom Rich Excel Ribbon
            formulaBar: false, // We use custom FormulaBar component
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

        // Selection change with Universal Merge Resolver
        fWorkbook.onSelectionChange((selections: any[]) => {
          if (!selections?.length) return;
          const sel = selections[0];
          const range = sel?.range ?? sel;
          const sr: number = range?.startRow ?? 0;
          const sc: number = range?.startColumn ?? 0;
          const er: number = range?.endRow ?? sr;
          const ec: number = range?.endColumn ?? sc;

          const currentWs = fWorkbook.getActiveSheet();
          const wsSnapshot = currentWs?.getSnapshot?.() || {};
          const merges: MergeIRange[] = wsSnapshot.mergeData || [];

          const normalized = normalizeSelectionWithMerges(
            { startRow: sr, startColumn: sc, endRow: er, endColumn: ec },
            merges
          );

          setCurrentSelectionStr(normalized.selectionStr);
          if (mode === 'admin') onCellMouseDown?.(normalized.masterCell.row, normalized.masterCell.column);

          // Read cell value or formula for Formula Bar
          try {
            const activeRange = currentWs?.getRange(normalized.masterCell.row, normalized.masterCell.column, 1, 1);
            if (activeRange) {
              const cellVal = activeRange.getValue();
              const cellData = wsSnapshot.cellData?.[normalized.masterCell.row]?.[normalized.masterCell.column];
              if (cellData?.f) {
                setActiveCellValue(`=${cellData.f}`);
              } else if (cellVal !== undefined && cellVal !== null) {
                setActiveCellValue(String(cellVal));
              } else if (cellData?.p?.body?.dataStream) {
                setActiveCellValue(cellData.p.body.dataStream.replace(/\r\n$/, '').replace(/\n$/, ''));
              } else {
                setActiveCellValue('');
              }
            }
          } catch {
            setActiveCellValue('');
          }

          // Apply Format Painter if active
          if (formatPainterRef.current.getMode() !== 'inactive') {
            const activeRange = currentWs?.getActiveRange();
            if (activeRange) {
              const ok = formatPainterRef.current.applyFormat(activeRange);
              if (ok) {
                toast.success(`Đã dán định dạng vào ${normalized.selectionStr}`);
              }
            }
          }
        });

        // Whitelisted Command Execution Listener
        fWorkbook.onCommandExecuted((command: any) => {
          if (!command?.id) return;
          const cmdType = classifyUniverCommand(command.id);
          if (!cmdType) return;

          clientLogger.action("UNIVER_COMMAND", command.id, { type: cmdType, params: command.params });

          // Handle value edits
          if (cmdType === 'value') {
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
              setActiveCellValue(newVal);
            }, 60);
          }
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

  // Formula Bar Value Commit
  const handleFormulaBarCommit = (val: string) => {
    if (locked && mode === 'user') {
      toast.info('Bảng tính đã khóa; bạn không thể sửa ô này.');
      return;
    }
    const activeRange = univerAPIRef.current?.getActiveWorkbook()?.getActiveSheet()?.getActiveRange();
    if (!activeRange) return;

    try {
      if (val.startsWith('=')) {
        activeRange.setValue(val);
      } else {
        const num = Number(val);
        if (!isNaN(num) && val.trim() !== '') {
          activeRange.setValue(num);
        } else {
          activeRange.setValue(val);
        }
      }
      setActiveCellValue(val);
      const r = activeRange.getRow();
      const c = activeRange.getColumn();
      onCellEdit?.(r, c, val);
      toast.success(`Đã cập nhật ${currentSelectionStr}`);
    } catch (err) {
      console.error('Failed to commit formula bar value:', err);
    }
  };

  // Formula Bar Cell Navigation
  const handleNavigateToCell = (address: string) => {
    try {
      const decoded = XLSX.utils.decode_cell(address);
      const ws = univerAPIRef.current?.getActiveWorkbook()?.getActiveSheet();
      if (ws) {
        const targetRange = ws.getRange(decoded.r, decoded.c, 1, 1);
        targetRange?.activate();
      }
    } catch (err) {
      toast.error(`Địa chỉ ô không hợp lệ: ${address}`);
    }
  };

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
        const form = `=${formulaName}()`;
        activeRange.setValue(form);
        setActiveCellValue(form);
        toast.success(`Đã chèn hàm =${formulaName}()`);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        const newImg: FloatingImage = {
          id: `img-${Date.now()}`,
          sheetName: activeSheet || 'Sheet1',
          src: base64,
          x: 120,
          y: 80,
          width: 180,
          height: 120,
        };
        setImages((prev) => [...prev, newImg]);
        toast.success('Đã chèn hình ảnh vào bảng tính.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const applySelectionFormat = (
    format: 'bold' | 'italic' | 'left' | 'center' | 'right' | 'wrap' | 'merge' | 'unmerge' | 'fill' | 'fontColor' | 'fontFamily' | 'fontSize' | 'number' | 'currency' | 'percent' | 'text' | 'clearFormat',
    paramValue?: any
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
        case 'bold': {
          const isNowBold = toggleRangeBold(activeRange);
          toast.success(isNowBold ? 'Đã bật in đậm' : 'Đã tắt in đậm');
          break;
        }
        case 'italic': {
          const isNowItalic = toggleRangeItalic(activeRange);
          toast.success(isNowItalic ? 'Đã bật in nghiêng' : 'Đã tắt in nghiêng');
          break;
        }
        case 'left':
          activeRange.setHorizontalAlignment(1);
          toast.success('Đã căn lề trái');
          break;
        case 'center':
          activeRange.setHorizontalAlignment(2);
          toast.success('Đã căn giữa');
          break;
        case 'right':
          activeRange.setHorizontalAlignment(3);
          toast.success('Đã căn lề phải');
          break;
        case 'wrap':
          activeRange.setWrapStrategy(WRAP_STRATEGY_WRAP);
          toast.success('Đã bật ngắt dòng');
          break;
        case 'merge':
          activeRange.merge();
          toast.success('Đã gộp ô (Merge)');
          break;
        case 'unmerge':
          activeRange.unmerge();
          toast.success('Đã hủy gộp ô (Unmerge)');
          break;
        case 'fontFamily':
          activeRange.setFontFamily(paramValue);
          setCurrentFont(paramValue);
          toast.success(`Đổi phông chữ: ${paramValue}`);
          break;
        case 'fontSize':
          activeRange.setFontSize(paramValue);
          setCurrentFontSize(paramValue);
          toast.success(`Cỡ chữ: ${paramValue}`);
          break;
        case 'fill':
          activeRange.setBackgroundColor(paramValue || fillColor);
          break;
        case 'fontColor':
          activeRange.setFontColor(paramValue || fontColor);
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

  const handleApplyFormatCellsModal = (options: CellFormatOptions) => {
    const activeRange = univerAPIRef.current?.getActiveWorkbook()?.getActiveSheet()?.getActiveRange();
    if (!activeRange) return;
    const ok = applyFormatCellsOptionsToRange(activeRange, options);
    if (ok) {
      toast.success(`Đã áp dụng định dạng ô vào ${currentSelectionStr}`);
    }
  };

  const ribbonButtonClass = 'inline-flex min-w-12 flex-col items-center justify-center gap-1 rounded px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 cursor-pointer';
  const selectionButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-slate-700 hover:border-slate-300 hover:bg-slate-100 cursor-pointer disabled:cursor-not-allowed';

  return (
    <div 
      className={`bg-white flex flex-col transition-all duration-200 select-none ${
        isFullscreen 
          ? 'fixed inset-0 z-[9999] w-screen h-screen shadow-2xl' 
          : 'flex-1 w-full h-full min-h-[550px] relative rounded-xl border border-slate-300 shadow-xl overflow-hidden'
      }`}
    >
      {/* 1. TOP EXCEL 365 TITLE BAR */}
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
              placeholder="Search (Ctrl + F)"
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

        {/* Right: Actions and Fullscreen Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportUniverToExcelFile({ univerAPI: univerAPIRef.current, filename: `BaoGia_${activeSheet || 'PhucGia'}.xlsx`, fallbackWorkbook: workbook })}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 text-white font-medium text-xs transition-colors cursor-pointer"
            title="Tải về file Excel đầy đủ 100% dữ liệu đã sửa (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tải Excel</span>
          </button>

          <button
            type="button"
            onClick={() => printSpreadsheetDirectly({ univerAPI: univerAPIRef.current, activeSheet, title: 'Báo Giá Phúc Gia' })}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 text-white font-medium text-xs transition-colors cursor-pointer"
            title="In bảng báo giá chuẩn khổ A4"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden md:inline">In Báo Giá</span>
          </button>

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

      {/* 2. RIBBON TABS NAVIGATION */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-300 bg-[#f3f2f1] px-2 pt-1 text-xs custom-scrollbar">
        {ribbonTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeRibbonTab === tab.id}
            onClick={() => setActiveRibbonTab(tab.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              activeRibbonTab === tab.id
                ? 'border-[#107c41] bg-white font-bold text-slate-900'
                : 'border-transparent text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. CONTEXTUAL RIBBON ACTIONS BAR */}
      <div className="flex min-h-[84px] shrink-0 flex-wrap items-stretch gap-2 border-b border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">
        {/* TAB HOME: ĐẦY ĐỦ FORMAT, FONT, ALIGNMENT, MERGE, NUMBER, FORMAT PAINTER, FIND */}
        {activeRibbonTab === 'home' && (
          <div className="flex w-full items-stretch gap-2 overflow-x-auto">
            {/* Clipboard & Format Painter & Find */}
            <div className="relative flex items-center gap-1 border-r border-slate-200 pb-3 pr-2">
              <button
                type="button"
                onClick={() => {
                  const activeRange = univerAPIRef.current?.getActiveWorkbook()?.getActiveSheet()?.getActiveRange();
                  if (!activeRange) {
                    toast.error('Vui lòng chọn ô nguồn để sao chép định dạng.');
                    return;
                  }
                  formatPainterRef.current.copyFormat(activeRange, false);
                  toast.success('Đã sao chép định dạng (Click vào ô đích để dán)');
                }}
                onDoubleClick={() => {
                  const activeRange = univerAPIRef.current?.getActiveWorkbook()?.getActiveSheet()?.getActiveRange();
                  if (!activeRange) return;
                  formatPainterRef.current.copyFormat(activeRange, true);
                  toast.success('Chế độ chổi sơn liên tục (Nhấn ESC để hủy)');
                }}
                className={`${ribbonButtonClass} ${
                  painterMode !== 'inactive'
                    ? 'bg-emerald-100 text-emerald-800 font-bold ring-2 ring-emerald-500 animate-pulse'
                    : ''
                }`}
                title="Format Painter (Nhấp 1 lần: dán 1 lần | Nhấp đúp: dán liên tục | ESC: hủy)"
              >
                <Paintbrush className="h-4 w-4 text-emerald-700" />
                <span>Painter</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFindReplace(true)}
                className={ribbonButtonClass}
                title="Tìm kiếm & Thay thế (Ctrl + F)"
              >
                <Search className="h-4 w-4 text-slate-700" />
                <span>Find</span>
              </button>
              <span className="absolute bottom-0 left-0 right-2 text-center text-[9px] text-slate-500">Clipboard & Find</span>
            </div>

            {/* Font Family, Size & Styling */}
            <div className="relative flex flex-col justify-center gap-1 border-r border-slate-200 px-2 pb-3">
              <div className="flex items-center gap-1">
                {/* Windows System Fonts Selector */}
                <select
                  value={currentFont}
                  onChange={(e) => applySelectionFormat('fontFamily', e.target.value)}
                  disabled={locked && mode === 'user'}
                  className="h-6 rounded border border-slate-300 bg-white px-1.5 text-[11px] font-medium outline-none focus:border-[#107c41]"
                  title="Kiểu phông chữ Windows có sẵn"
                >
                  {WINDOWS_FONTS.map(f => (
                    <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                  ))}
                </select>

                {/* Font Size Selector */}
                <select
                  value={currentFontSize}
                  onChange={(e) => applySelectionFormat('fontSize', parseInt(e.target.value, 10))}
                  disabled={locked && mode === 'user'}
                  className="h-6 w-12 rounded border border-slate-300 bg-white px-1 text-[11px] font-medium outline-none focus:border-[#107c41]"
                  title="Cỡ chữ"
                >
                  {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => applySelectionFormat('bold')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Đậm (Bold)"><Bold className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => applySelectionFormat('italic')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Nghiêng (Italic)"><Italic className="h-3.5 w-3.5" /></button>
                <label className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-slate-700 hover:bg-slate-100" title="Màu chữ">
                  <span className="flex flex-col items-center text-[11px] font-bold">A<span className="h-1 w-3" style={{ backgroundColor: fontColor }} /></span>
                  <input aria-label="Font color" type="color" value={fontColor} disabled={locked && mode === 'user'} onChange={event => { setFontColor(event.target.value); applySelectionFormat('fontColor', event.target.value); }} className="sr-only" />
                </label>
                <label className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-slate-700 hover:bg-slate-100" title="Màu nền ô (Fill)">
                  <PaintBucket className="h-3.5 w-3.5" />
                  <input aria-label="Cell fill color" type="color" value={fillColor} disabled={locked && mode === 'user'} onChange={event => { setFillColor(event.target.value); applySelectionFormat('fill', event.target.value); }} className="sr-only" />
                </label>
              </div>
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
                className="flex items-center gap-1 h-8 px-2 rounded border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-800 hover:bg-slate-100 cursor-pointer" 
                title="Gộp các ô đang chọn (Merge & Center)"
              >
                <Grid2X2 className="h-3.5 w-3.5 text-emerald-700" />
                <span>Merge</span>
              </button>
              <button 
                type="button" 
                onClick={() => applySelectionFormat('unmerge')} 
                disabled={locked && mode === 'user'} 
                className="flex items-center gap-1 h-8 px-2 rounded border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-800 hover:bg-slate-100 cursor-pointer" 
                title="Hủy gộp ô"
              >
                <LayersIcon className="h-3.5 w-3.5 text-amber-700" />
                <span>Unmerge</span>
              </button>
              <span className="absolute bottom-0 left-2 right-2 text-center text-[9px] text-slate-500">Merge Cells</span>
            </div>

            {/* Number Format */}
            <div className="relative flex items-center gap-1 border-r border-slate-200 px-2 pb-3">
              <button type="button" onClick={() => applySelectionFormat('number')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Định dạng số (#,##0)"><Hash className="h-4 w-4" /></button>
              <button type="button" onClick={() => applySelectionFormat('currency')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Tiền tệ (VNĐ)"><DollarSign className="h-4 w-4" /></button>
              <button type="button" onClick={() => applySelectionFormat('percent')} disabled={locked && mode === 'user'} className={selectionButtonClass} title="Phần trăm (%)"><Percent className="h-4 w-4" /></button>
              <span className="absolute bottom-0 left-2 right-2 text-center text-[9px] text-slate-500">Number</span>
            </div>

            {/* Format Cells Modal Launcher */}
            <div className="relative flex items-center gap-1 border-r border-slate-200 px-2 pb-3">
              <button
                type="button"
                onClick={() => setShowFormatCellsModal(true)}
                disabled={locked && mode === 'user'}
                className="flex items-center gap-1 h-8 px-2.5 rounded border border-emerald-300 bg-emerald-50 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer shadow-2xs"
                title="Mở bảng định dạng ô chi tiết (Ctrl + 1)"
              >
                <Sliders className="h-3.5 w-3.5 text-[#107c41]" />
                <span>Format Cells</span>
              </button>
              <span className="absolute bottom-0 left-2 right-2 text-center text-[9px] text-slate-500">Dialog</span>
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

        {/* TAB INSERT: ROWS, COLS & INSERT FLOATING IMAGE */}
        {activeRibbonTab === 'insert' && (
          <div className="flex items-stretch gap-2">
            <div className="flex flex-col items-center justify-center border-r border-slate-200 px-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={locked && mode === 'user'}
                className="flex flex-col items-center gap-1 rounded px-3 py-1 text-slate-800 hover:bg-slate-100 cursor-pointer"
                title="Chèn ảnh / logo nổi vào bảng tính"
              >
                <ImageIcon className="h-6 w-6 text-emerald-700" />
                <span className="text-[10px] font-semibold">Chèn Hình Ảnh</span>
              </button>
              <span className="mt-1 text-[9px] text-slate-500">Illustrations</span>
            </div>

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

        {/* TAB PAGE LAYOUT */}
        {activeRibbonTab === 'pageLayout' && (
          <div className="flex items-stretch gap-2">
            <div className="flex flex-col items-center justify-center border-r border-slate-200 px-3">
              <Layout className="h-6 w-6 text-slate-500" />
              <span className="mt-1 text-[10px] text-slate-600">Page Setup</span>
            </div>
            <button
              type="button"
              onClick={() => printSpreadsheetDirectly({ univerAPI: univerAPIRef.current, activeSheet, orientation: 'portrait' })}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <Printer className="h-4 w-4 text-emerald-700" />
              <span>In A4 Dọc (Portrait)</span>
            </button>
            <button
              type="button"
              onClick={() => printSpreadsheetDirectly({ univerAPI: univerAPIRef.current, activeSheet, orientation: 'landscape' })}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <Printer className="h-4 w-4 text-emerald-700" />
              <span>In A4 Ngang (Landscape)</span>
            </button>
            <button
              type="button"
              onClick={() => exportUniverToExcelFile({ univerAPI: univerAPIRef.current, filename: `BaoGia_${activeSheet || 'PhucGia'}.xlsx`, fallbackWorkbook: workbook })}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white cursor-pointer ml-auto"
            >
              <Download className="h-4 w-4" />
              <span>Tải file Excel (.xlsx)</span>
            </button>
          </div>
        )}

        {/* TAB FORMULAS */}
        {activeRibbonTab === 'formulas' && (
          <div className="flex items-stretch gap-2">
            <div className="flex flex-col items-center justify-center border-r border-slate-200 pr-3">
              <Sigma className="h-6 w-6 text-[#107c41]" />
              <span className="mt-1 text-[9px] text-slate-500">Function Library</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', 'IF', 'VLOOKUP', 'SUMIF'].map(fn => (
                <button
                  key={fn}
                  onClick={() => handleInsertFormula(fn)}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] font-semibold text-slate-800 transition-colors hover:bg-slate-100 cursor-pointer"
                >
                  ={fn}()
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB DATA: SẮP XẾP A-Z, Z-A & LỌC DỮ LIỆU */}
        {activeRibbonTab === 'data' && (
          <div className="flex items-stretch gap-2">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-3">
              <button
                type="button"
                onClick={() => {
                  const res = executeSortWorksheet(univerAPIRef.current, { direction: 'asc' });
                  if (res.success) {
                    toast.success(res.message);
                  } else {
                    toast.error(res.message);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer"
                title="Sắp xếp tăng dần A → Z (giữ nguyên tiêu đề Header)"
              >
                <ArrowUpAZ className="h-4 w-4 text-emerald-700" />
                <span>Sắp xếp A → Z</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const res = executeSortWorksheet(univerAPIRef.current, { direction: 'desc' });
                  if (res.success) {
                    toast.success(res.message);
                  } else {
                    toast.error(res.message);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer"
                title="Sắp xếp giảm dần Z → A (giữ nguyên tiêu đề Header)"
              >
                <ArrowDownAZ className="h-4 w-4 text-amber-700" />
                <span>Sắp xếp Z → A</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toast.info('Đã bật chế độ lọc tự động (AutoFilter)');
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer"
              >
                <Filter className="h-4 w-4 text-blue-700" />
                <span>Lọc (Filter)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowFindReplace(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer"
            >
              <Search className="h-4 w-4 text-slate-700" />
              <span>Tìm kiếm & Thay thế (Ctrl+F)</span>
            </button>
          </div>
        )}

        {/* TAB REVIEW */}
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
                  className="flex flex-col items-center justify-center gap-1 rounded px-3 text-emerald-800 transition-colors hover:bg-emerald-50 cursor-pointer"
                  title="Cấp quyền sửa cho ô/vùng đang bôi đen"
                >
                  <Plus className="h-6 w-6 text-emerald-700" />
                  <span className="text-[10px]">Allow Edit Ranges</span>
                  <span className="font-mono text-[9px]">{currentSelectionStr || '(Select range)'}</span>
                </button>

                {currentSelectionStr && editableRange.includes(currentSelectionStr) && (
                  <button
                    onClick={handleRemoveSelectionFromEditableRange}
                    className="flex flex-col items-center justify-center gap-1 rounded px-3 text-rose-700 transition-colors hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="h-6 w-6" />
                    <span className="text-[10px]">Remove Range</span>
                  </button>
                )}

                <button
                  onClick={() => setShowAllowEditDialog(true)}
                  className="flex flex-col items-center justify-center gap-1 rounded px-3 text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
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

        {/* TAB VIEW */}
        {activeRibbonTab === 'view' && (
          <div className="flex items-stretch gap-2">
            <button
              onClick={toggleFullscreen}
              className="flex min-w-28 flex-col items-center justify-center gap-1 rounded px-3 text-slate-800 transition-colors hover:bg-slate-100 cursor-pointer"
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

        {/* TAB HELP */}
        {activeRibbonTab === 'help' && (
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <HelpCircle className="w-4 h-4 text-[#107c41]" />
            <span>Sử dụng thanh công cụ để chỉnh sửa, tính toán và xuất dữ liệu. Nhấn Ctrl+S hoặc nút "Lưu" để lưu báo giá.</span>
          </div>
        )}
      </div>

      {/* 4. FORMULA BAR (THANH CÔNG THỨC CHUẨN EXCEL) */}
      <FormulaBar
        activeCellAddress={currentSelectionStr}
        activeCellValue={activeCellValue}
        univerAPI={univerAPIRef.current}
        onCommitValue={handleFormulaBarCommit}
        onNavigateToCell={handleNavigateToCell}
        disabled={locked && mode === 'user'}
      />

      {/* 5. MAIN UNIVER CANVAS HOST CONTAINER WITH IMAGE OVERLAY */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-white" style={{ minHeight: isFullscreen ? 0 : '520px' }}>
        <div ref={containerRef} className="w-full h-full relative overflow-hidden" />
        <ImageOverlay
          images={images}
          activeSheet={activeSheet}
          onUpdateImage={(updated) => {
            setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
          }}
          onRemoveImage={(id) => {
            setImages((prev) => prev.filter((img) => img.id !== id));
            toast.success('Đã xóa hình ảnh');
          }}
          disabled={locked && mode === 'user'}
        />
      </div>

      {/* 6. MODAL: FIND & REPLACE (CTRL + F) */}
      <FindReplaceModal
        isOpen={showFindReplace}
        onClose={() => setShowFindReplace(false)}
        univerAPI={univerAPIRef.current}
        activeSheet={activeSheet}
      />

      {/* 7. MODAL: FORMAT CELLS (CTRL + 1) */}
      <FormatCellsModal
        isOpen={showFormatCellsModal}
        onClose={() => setShowFormatCellsModal(false)}
        univerAPI={univerAPIRef.current}
        activeSelectionStr={currentSelectionStr}
        onApplyFormat={handleApplyFormatCellsModal}
      />

      {/* 8. DIALOG: QUẢN LÝ DANH SÁCH VÙNG ĐƯỢC PHÉP SỬA */}
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

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

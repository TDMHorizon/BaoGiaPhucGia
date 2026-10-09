import React, { useState, useEffect } from 'react';
import { Search, Replace, X, ChevronDown, ChevronUp, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { clientLogger } from '../../../lib/logger';

interface FindMatch {
  sheetName: string;
  row: number;
  col: number;
  cellRef: string;
  value: string;
}

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  univerAPI: any;
  activeSheet: string;
}

/**
 * Trích xuất text đầy đủ từ Univer cell data (bao gồm cả rich text document stream)
 */
export function extractCellSearchText(cell: any): string {
  if (!cell) return '';
  if (cell.v !== undefined && cell.v !== null) {
    return String(cell.v).normalize('NFC');
  }
  if (cell.p?.body?.dataStream) {
    return cell.p.body.dataStream
      .replace(/\r\n$/, '')
      .replace(/\n$/, '')
      .normalize('NFC');
  }
  if (cell.f) {
    return String(cell.f).normalize('NFC');
  }
  return '';
}

export function FindReplaceModal({ isOpen, onClose, univerAPI, activeSheet }: FindReplaceModalProps) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeCell, setWholeCell] = useState(false);
  const [searchScope, setSearchScope] = useState<'sheet' | 'workbook'>('sheet');
  const [matches, setMatches] = useState<FindMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          handlePrev();
        } else {
          handleFindNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, findText, matches, currentIndex]);

  if (!isOpen) return null;

  const performSearch = (): FindMatch[] => {
    if (!univerAPI || !findText.trim()) return [];

    const fWorkbook = univerAPI.getActiveWorkbook();
    if (!fWorkbook) return [];

    const sheetsToSearch = searchScope === 'workbook'
      ? fWorkbook.getSheets()
      : [fWorkbook.getActiveSheet()];

    const found: FindMatch[] = [];
    const normalizedQuery = findText.trim().normalize('NFC');
    const query = matchCase ? normalizedQuery : normalizedQuery.toLowerCase();

    sheetsToSearch.forEach((ws: any) => {
      if (!ws) return;
      const sheetName = ws.getSheetName();
      const snapshot = ws.getSnapshot?.() || {};
      const cellData = snapshot.cellData || {};

      Object.keys(cellData).forEach(rStr => {
        const r = parseInt(rStr, 10);
        const rowObj = cellData[r];
        if (!rowObj) return;

        Object.keys(rowObj).forEach(cStr => {
          const c = parseInt(cStr, 10);
          const cell = rowObj[c];
          if (!cell) return;

          const val = extractCellSearchText(cell);
          if (!val) return;

          const target = matchCase ? val : val.toLowerCase();
          const isMatch = wholeCell ? target === query : target.includes(query);

          if (isMatch) {
            found.push({
              sheetName,
              row: r,
              col: c,
              cellRef: XLSX.utils.encode_cell({ r, c }),
              value: val,
            });
          }
        });
      });
    });

    return found;
  };

  const focusMatch = (match: FindMatch) => {
    try {
      const fWorkbook = univerAPI.getActiveWorkbook();
      if (!fWorkbook) return;

      const targetWs = fWorkbook.getSheetByName(match.sheetName);
      if (targetWs) fWorkbook.setActiveSheet(targetWs);

      const range = fWorkbook.getActiveSheet()?.getRange(match.row, match.col, 1, 1);
      if (range) {
        range.activate();
      }
    } catch (err) {
      console.warn("Could not focus cell:", err);
    }
  };

  const handleFindNext = () => {
    const list = performSearch();
    setMatches(list);

    if (list.length === 0) {
      setStatusMsg('Không tìm thấy kết quả nào.');
      setCurrentIndex(-1);
      return;
    }

    const nextIndex = (currentIndex + 1) % list.length;
    setCurrentIndex(nextIndex);
    focusMatch(list[nextIndex]);
    setStatusMsg(`Khớp ${nextIndex + 1}/${list.length} (${list[nextIndex].cellRef}: "${list[nextIndex].value}")`);

    clientLogger.action("FIND_REPLACE", "FIND_NEXT", {
      query: findText,
      matchIndex: nextIndex,
      total: list.length,
      cell: list[nextIndex].cellRef,
    });
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const prevIndex = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prevIndex);
    focusMatch(matches[prevIndex]);
    setStatusMsg(`Khớp ${prevIndex + 1}/${matches.length} (${matches[prevIndex].cellRef})`);
  };

  const handleReplace = () => {
    if (currentIndex < 0 || currentIndex >= matches.length) {
      handleFindNext();
      return;
    }

    const match = matches[currentIndex];
    try {
      const fWorkbook = univerAPI.getActiveWorkbook();
      const ws = fWorkbook?.getSheetByName(match.sheetName);
      const range = ws?.getRange(match.row, match.col, 1, 1);

      if (range) {
        const oldVal = match.value;
        const newVal = wholeCell 
          ? replaceText 
          : oldVal.replace(new RegExp(findText, matchCase ? 'g' : 'gi'), replaceText);
        
        range.setValue(newVal);
        setStatusMsg(`Đã thay thế ô ${match.cellRef}`);
        
        // re-run search to update matches
        setTimeout(() => {
          handleFindNext();
        }, 50);
      }
    } catch (err) {
      console.error("Replace failed:", err);
    }
  };

  const handleReplaceAll = () => {
    const list = performSearch();
    if (list.length === 0) {
      setStatusMsg('Không có ô nào phù hợp để thay thế.');
      return;
    }

    let count = 0;
    try {
      const fWorkbook = univerAPI.getActiveWorkbook();
      list.forEach(m => {
        const ws = fWorkbook?.getSheetByName(m.sheetName);
        const range = ws?.getRange(m.row, m.col, 1, 1);
        if (range) {
          const oldVal = m.value;
          const newVal = wholeCell 
            ? replaceText 
            : oldVal.replace(new RegExp(findText, matchCase ? 'g' : 'gi'), replaceText);
          range.setValue(newVal);
          count++;
        }
      });
      setStatusMsg(`Đã thay thế thành công ${count} vị trí.`);
      setMatches([]);
      setCurrentIndex(-1);
    } catch (err) {
      console.error("Replace all failed:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#107c41] px-4 py-2.5 text-white">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-white" />
            <span className="font-semibold text-sm">Tìm Kiếm & Thay Thế (Find & Replace)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/80 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5">
          {/* Find input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tìm gì (Find what):
            </label>
            <input
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="Nhập chuỗi cần tìm (ví dụ: Bình sơn xịt, 740000...)"
              autoFocus
              className="w-full h-8 rounded-lg border border-slate-300 px-3 text-xs outline-none focus:border-[#107c41] focus:ring-1 focus:ring-[#107c41]"
            />
          </div>

          {/* Replace input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Thay thế bằng (Replace with):
            </label>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Nhập nội dung thay thế..."
              className="w-full h-8 rounded-lg border border-slate-300 px-3 text-xs outline-none focus:border-[#107c41] focus:ring-1 focus:ring-[#107c41]"
            />
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="rounded text-[#107c41]"
              />
              Phân biệt hoa/thường
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={wholeCell}
                onChange={(e) => setWholeCell(e.target.checked)}
                className="rounded text-[#107c41]"
              />
              Khớp toàn bộ ô
            </label>
          </div>

          {/* Scope */}
          <div className="flex items-center gap-4 text-xs text-slate-700">
            <span className="font-semibold">Phạm vi:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="searchScope"
                value="sheet"
                checked={searchScope === 'sheet'}
                onChange={() => setSearchScope('sheet')}
                className="text-[#107c41]"
              />
              Sheet hiện tại ({activeSheet || 'Sheet1'})
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="searchScope"
                value="workbook"
                checked={searchScope === 'workbook'}
                onChange={() => setSearchScope('workbook')}
                className="text-[#107c41]"
              />
              Toàn bộ sổ tính
            </label>
          </div>

          {/* Status message */}
          {statusMsg && (
            <div className={`p-2 rounded text-xs font-medium ${
              statusMsg.includes('Không tìm')
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              {statusMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-[#f8f9fa] px-4 py-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              disabled={matches.length === 0}
              className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
              title="Khớp trước đó"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFindNext}
              className="flex items-center gap-1 rounded bg-[#107c41] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d6b38] transition-colors cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Tìm tiếp (Find Next)</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleReplace}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Thay thế
            </button>
            <button
              type="button"
              onClick={handleReplaceAll}
              className="flex items-center gap-1 rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors cursor-pointer"
            >
              <Replace className="h-3.5 w-3.5" />
              <span>Thay thế tất cả</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

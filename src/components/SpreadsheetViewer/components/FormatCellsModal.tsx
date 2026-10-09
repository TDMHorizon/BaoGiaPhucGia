import React, { useState, useEffect } from 'react';
import { X, Check, HelpCircle, Palette, AlignLeft, AlignCenter, AlignRight, Type, Hash, Shield } from 'lucide-react';
import { clientLogger } from '../../../lib/logger';

export interface FormatCellsModalProps {
  isOpen: boolean;
  onClose: () => void;
  univerAPI: any;
  activeSelectionStr?: string;
  onApplyFormat: (formatOptions: CellFormatOptions) => void;
}

export interface CellFormatOptions {
  category?: string;
  numberFormat?: string;
  decimals?: number;
  useSeparator?: boolean;
  currencySymbol?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontColor?: string;
  backgroundColor?: string;
  horizontalAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  wrapText?: boolean;
  borderPreset?: 'none' | 'outline' | 'all' | 'top' | 'bottom';
  borderColor?: string;
}

const NUMBER_CATEGORIES = [
  { id: 'General', label: 'General' },
  { id: 'Number', label: 'Number' },
  { id: 'Currency', label: 'Currency' },
  { id: 'Accounting', label: 'Accounting' },
  { id: 'Date', label: 'Date' },
  { id: 'Time', label: 'Time' },
  { id: 'Percentage', label: 'Percentage' },
  { id: 'Fraction', label: 'Fraction' },
  { id: 'Scientific', label: 'Scientific' },
  { id: 'Text', label: 'Text' },
  { id: 'Special', label: 'Special' },
  { id: 'Custom', label: 'Custom' },
];

export const WINDOWS_FONTS = [
  'Arial',
  'Times New Roman',
  'Calibri',
  'Segoe UI',
  'Tahoma',
  'Roboto',
  'Verdana',
  'Courier New',
  'Georgia',
  'Trebuchet MS',
];

export function FormatCellsModal({
  isOpen,
  onClose,
  univerAPI,
  activeSelectionStr = 'A1',
  onApplyFormat,
}: FormatCellsModalProps) {
  const [activeTab, setActiveTab] = useState<'number' | 'alignment' | 'font' | 'border' | 'fill'>('number');
  
  // Number Tab states
  const [category, setCategory] = useState<string>('Currency');
  const [decimals, setDecimals] = useState<number>(0);
  const [useSeparator, setUseSeparator] = useState<boolean>(true);
  const [currencySymbol, setCurrencySymbol] = useState<string>('₫');
  const [dateFormat, setDateFormat] = useState<string>('DD/MM/YYYY');
  const [customPattern, setCustomPattern] = useState<string>('#,##0 "₫"');

  // Alignment Tab states
  const [horizontalAlign, setHorizontalAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [verticalAlign, setVerticalAlign] = useState<'top' | 'middle' | 'bottom'>('middle');
  const [wrapText, setWrapText] = useState<boolean>(false);

  // Font Tab states
  const [fontFamily, setFontFamily] = useState<string>('Calibri');
  const [fontStyle, setFontStyle] = useState<'Regular' | 'Italic' | 'Bold' | 'Bold Italic'>('Regular');
  const [fontSize, setFontSize] = useState<number>(11);
  const [underline, setUnderline] = useState<boolean>(false);
  const [fontColor, setFontColor] = useState<string>('#000000');

  // Border Tab states
  const [borderPreset, setBorderPreset] = useState<'none' | 'outline' | 'all' | 'top' | 'bottom'>('none');
  const [borderColor, setBorderColor] = useState<string>('#000000');

  // Fill Tab states
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Compute live sample preview
  const getSamplePreview = (): string => {
    const rawVal = 5000000;
    if (category === 'General') return '5000000';
    if (category === 'Number') {
      const formatted = useSeparator ? rawVal.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : rawVal.toFixed(decimals);
      return formatted;
    }
    if (category === 'Currency') {
      const formatted = rawVal.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      return `${formatted} ${currencySymbol}`;
    }
    if (category === 'Accounting') {
      const formatted = rawVal.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      return `${currencySymbol} ${formatted}`;
    }
    if (category === 'Date') return '24/10/2026';
    if (category === 'Percentage') return `${(0.15).toFixed(decimals)}%`;
    if (category === 'Text') return '5000000 (Văn bản)';
    if (category === 'Custom') return customPattern;
    return '5000000';
  };

  const getComputedNumFmt = (): string => {
    const sep = useSeparator ? '#,##0' : '0';
    const dec = decimals > 0 ? '.' + '0'.repeat(decimals) : '';
    switch (category) {
      case 'General': return 'General';
      case 'Number': return `${sep}${dec}`;
      case 'Currency': return `${sep}${dec} "${currencySymbol}"`;
      case 'Accounting': return `_(${currencySymbol}* ${sep}${dec}_);_(${currencySymbol}* (${sep}${dec});_(${currencySymbol}* "-"_);_(@_)`;
      case 'Date': return dateFormat === 'DD/MM/YYYY' ? 'dd/mm/yyyy' : 'yyyy-mm-dd';
      case 'Percentage': return `0${dec}%`;
      case 'Text': return '@';
      case 'Custom': return customPattern || 'General';
      default: return 'General';
    }
  };

  const handleApply = () => {
    const isBold = fontStyle.includes('Bold');
    const isItalic = fontStyle.includes('Italic');

    const options: CellFormatOptions = {
      category,
      numberFormat: getComputedNumFmt(),
      decimals,
      useSeparator,
      currencySymbol,
      fontFamily,
      fontSize,
      bold: isBold,
      italic: isItalic,
      underline,
      fontColor,
      backgroundColor,
      horizontalAlign,
      verticalAlign,
      wrapText,
      borderPreset,
      borderColor,
    };

    clientLogger.action("FORMAT_CELLS", "APPLY_DIALOG_FORMAT", options);
    onApplyFormat(options);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col overflow-hidden text-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8f9fa] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-900">Format Cells</span>
            <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-xs text-slate-700">
              Vùng: {activeSelectionStr}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100 px-4 pt-1.5 gap-1 text-xs">
          {[
            { id: 'number', label: 'Number' },
            { id: 'alignment', label: 'Alignment' },
            { id: 'font', label: 'Font' },
            { id: 'border', label: 'Border' },
            { id: 'fill', label: 'Fill' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`border-b-2 px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[#107c41] bg-white font-bold text-[#107c41]'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-4 min-h-[320px] max-h-[420px] overflow-y-auto">
          {/* 1. NUMBER TAB */}
          {activeTab === 'number' && (
            <div className="grid grid-cols-12 gap-4">
              {/* Category List */}
              <div className="col-span-4 border-r border-slate-200 pr-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category:</label>
                <div className="border border-slate-300 rounded-md bg-white p-1 max-h-[260px] overflow-y-auto">
                  {NUMBER_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategory(cat.id);
                        if (cat.id === 'Currency') setCustomPattern('#,##0 "₫"');
                      }}
                      className={`block w-full text-left px-2.5 py-1.5 text-xs rounded transition-colors ${
                        category === cat.id
                          ? 'bg-[#107c41] text-white font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Options & Live Sample */}
              <div className="col-span-8 flex flex-col justify-between">
                <div>
                  {/* Sample Box */}
                  <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <span className="block text-[11px] font-semibold text-slate-500 mb-1">Sample (Xem trước):</span>
                    <div className="font-mono text-sm font-bold text-slate-900 bg-white border border-slate-200 p-2 rounded">
                      {getSamplePreview()}
                    </div>
                  </div>

                  {/* Options per Category */}
                  {(category === 'Number' || category === 'Currency' || category === 'Accounting') && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-700">Decimal places (Số thập phân):</label>
                        <input
                          type="number"
                          min={0}
                          max={6}
                          value={decimals}
                          onChange={(e) => setDecimals(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-16 h-7 rounded border border-slate-300 px-2 text-xs text-right outline-none focus:border-[#107c41]"
                        />
                      </div>

                      {category === 'Number' && (
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useSeparator}
                            onChange={(e) => setUseSeparator(e.target.checked)}
                            className="rounded text-[#107c41] focus:ring-[#107c41]"
                          />
                          Use 1000 Separator (,) (Phân cách hàng nghìn)
                        </label>
                      )}

                      {(category === 'Currency' || category === 'Accounting') && (
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-700">Symbol (Ký hiệu tiền tệ):</label>
                          <select
                            value={currencySymbol}
                            onChange={(e) => setCurrencySymbol(e.target.value)}
                            className="h-7 rounded border border-slate-300 px-2 text-xs outline-none focus:border-[#107c41]"
                          >
                            <option value="₫">₫ (VNĐ)</option>
                            <option value="đ">đ</option>
                            <option value="$">$ (USD)</option>
                            <option value="€">€ (EUR)</option>
                            <option value="¥">¥ (JPY)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {category === 'Date' && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700">Type (Kiểu ngày tháng):</label>
                      <select
                        value={dateFormat}
                        onChange={(e) => setDateFormat(e.target.value)}
                        className="w-full h-8 rounded border border-slate-300 px-2 text-xs outline-none focus:border-[#107c41]"
                      >
                        <option value="DD/MM/YYYY">24/10/2026 (Ngày/Tháng/Năm - Chuẩn VN)</option>
                        <option value="YYYY-MM-DD">2026-10-24 (ISO Standard)</option>
                        <option value="DD-MM-YYYY">24-10-2026</option>
                      </select>
                    </div>
                  )}

                  {category === 'Custom' && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700">Type pattern:</label>
                      <input
                        type="text"
                        value={customPattern}
                        onChange={(e) => setCustomPattern(e.target.value)}
                        placeholder='#,##0 "đồng"'
                        className="w-full h-8 rounded border border-slate-300 px-2 font-mono text-xs outline-none focus:border-[#107c41]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. ALIGNMENT TAB */}
          {activeTab === 'alignment' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Horizontal (Căn ngang):</label>
                  <select
                    value={horizontalAlign}
                    onChange={(e) => setHorizontalAlign(e.target.value as any)}
                    className="w-full h-8 rounded border border-slate-300 px-2 text-xs outline-none focus:border-[#107c41]"
                  >
                    <option value="left">Left (Trái)</option>
                    <option value="center">Center (Giữa)</option>
                    <option value="right">Right (Phải)</option>
                    <option value="justify">Justify (Đều 2 bên)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Vertical (Căn dọc):</label>
                  <select
                    value={verticalAlign}
                    onChange={(e) => setVerticalAlign(e.target.value as any)}
                    className="w-full h-8 rounded border border-slate-300 px-2 text-xs outline-none focus:border-[#107c41]"
                  >
                    <option value="top">Top (Trên)</option>
                    <option value="middle">Middle (Giữa dòng)</option>
                    <option value="bottom">Bottom (Dưới)</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wrapText}
                    onChange={(e) => setWrapText(e.target.checked)}
                    className="rounded text-[#107c41] focus:ring-[#107c41]"
                  />
                  Wrap text (Tự động xuống dòng khi nội dung dài)
                </label>
              </div>
            </div>
          )}

          {/* 3. FONT TAB */}
          {activeTab === 'font' && (
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-5">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Font Family:</label>
                <div className="border border-slate-300 rounded max-h-[160px] overflow-y-auto p-1 bg-white">
                  {WINDOWS_FONTS.map((fn) => (
                    <button
                      key={fn}
                      type="button"
                      onClick={() => setFontFamily(fn)}
                      style={{ fontFamily: fn }}
                      className={`block w-full text-left px-2 py-1 text-xs rounded ${
                        fontFamily === fn ? 'bg-[#107c41] text-white font-bold' : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      {fn}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Font Style:</label>
                <div className="border border-slate-300 rounded max-h-[160px] overflow-y-auto p-1 bg-white">
                  {['Regular', 'Italic', 'Bold', 'Bold Italic'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFontStyle(st as any)}
                      className={`block w-full text-left px-2 py-1 text-xs rounded ${
                        fontStyle === st ? 'bg-[#107c41] text-white font-bold' : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Size:</label>
                <div className="border border-slate-300 rounded max-h-[160px] overflow-y-auto p-1 bg-white">
                  {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setFontSize(sz)}
                      className={`block w-full text-left px-2 py-1 text-xs rounded ${
                        fontSize === sz ? 'bg-[#107c41] text-white font-bold' : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-12 flex items-center justify-between border-t border-slate-200 pt-3 mt-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={underline}
                    onChange={(e) => setUnderline(e.target.checked)}
                    className="rounded text-[#107c41]"
                  />
                  Underline (Gạch chân)
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">Màu chữ:</span>
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    className="h-7 w-10 cursor-pointer rounded border border-slate-300 p-0.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. BORDER TAB */}
          {activeTab === 'border' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Presets (Kiểu viền):</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'none', label: 'None (Bỏ viền)' },
                    { id: 'outline', label: 'Outline (Khung ngoài)' },
                    { id: 'all', label: 'All Borders (Toàn bộ)' },
                    { id: 'bottom', label: 'Bottom (Viền dưới)' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setBorderPreset(preset.id as any)}
                      className={`p-2 rounded border text-xs font-medium transition-colors ${
                        borderPreset === preset.id
                          ? 'border-[#107c41] bg-emerald-50 text-[#107c41] font-bold'
                          : 'border-slate-300 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-200 pt-3">
                <span className="text-xs font-medium text-slate-700">Màu viền:</span>
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="h-7 w-12 cursor-pointer rounded border border-slate-300 p-0.5"
                />
              </div>
            </div>
          )}

          {/* 5. FILL TAB */}
          {activeTab === 'fill' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Background Color (Màu nền ô):</label>
              <div className="grid grid-cols-8 gap-2">
                {[
                  '#ffffff', '#f8f9fa', '#fff2cc', '#d9ead3', '#cfe2f3', '#d9d2e9', '#f4cccc', '#fce5cd',
                  '#dcdcdc', '#e2e8f0', '#ffe599', '#b6d7a8', '#9fc5e8', '#b4a7d6', '#ea9999', '#f9cb9c',
                  '#999999', '#64748b', '#ffd966', '#93c47d', '#6fa8dc', '#8e7cc3', '#e06666', '#f6b26b',
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBackgroundColor(color)}
                    style={{ backgroundColor: color }}
                    className={`h-7 w-full rounded border transition-all ${
                      backgroundColor.toLowerCase() === color.toLowerCase()
                        ? 'border-slate-900 ring-2 ring-[#107c41]'
                        : 'border-slate-300 hover:scale-105'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 border-t border-slate-200 pt-3">
                <span className="text-xs font-medium text-slate-700">Màu tùy chỉnh (Custom Hex):</span>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="h-7 w-12 cursor-pointer rounded border border-slate-300 p-0.5"
                />
                <span className="font-mono text-xs text-slate-600">{backgroundColor}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-[#f8f9fa] px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Hủy bỏ (Cancel)
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded bg-[#107c41] px-5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0d6b38] transition-colors cursor-pointer"
          >
            Áp dụng (OK)
          </button>
        </div>
      </div>
    </div>
  );
}

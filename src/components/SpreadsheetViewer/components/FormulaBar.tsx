import React, { useState, useEffect, useRef } from 'react';
import { Check, X, FunctionSquare, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';

interface FormulaBarProps {
  activeCellAddress: string;
  activeCellValue: string;
  univerAPI: any;
  onCommitValue: (value: string) => void;
  onNavigateToCell?: (address: string) => void;
  disabled?: boolean;
}

const COMMON_FUNCTIONS = [
  { name: 'SUM', desc: 'Tính tổng các giá trị trong vùng được chọn', syntax: '=SUM(number1, [number2], ...)' },
  { name: 'AVERAGE', desc: 'Tính giá trị trung bình cộng', syntax: '=AVERAGE(number1, [number2], ...)' },
  { name: 'COUNT', desc: 'Đếm số lượng ô chứa giá trị số', syntax: '=COUNT(value1, [value2], ...)' },
  { name: 'MAX', desc: 'Tìm giá trị lớn nhất trong vùng', syntax: '=MAX(number1, [number2], ...)' },
  { name: 'MIN', desc: 'Tìm giá trị nhỏ nhất trong vùng', syntax: '=MIN(number1, [number2], ...)' },
  { name: 'IF', desc: 'Kiểm tra điều kiện logic', syntax: '=IF(logical_test, value_if_true, value_if_false)' },
  { name: 'VLOOKUP', desc: 'Tra cứu giá trị theo cột', syntax: '=VLOOKUP(lookup_value, table_array, col_index, [range_lookup])' },
  { name: 'SUMIF', desc: 'Tính tổng theo điều kiện', syntax: '=SUMIF(range, criteria, [sum_range])' },
  { name: 'ROUND', desc: 'Làm tròn số đến số chữ số thập phân chỉ định', syntax: '=ROUND(number, num_digits)' },
];

export function FormulaBar({
  activeCellAddress,
  activeCellValue,
  univerAPI,
  onCommitValue,
  onNavigateToCell,
  disabled = false,
}: FormulaBarProps) {
  const [addressInput, setAddressInput] = useState(activeCellAddress || 'A1');
  const [formulaInput, setFormulaInput] = useState(activeCellValue || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFxMenu, setShowFxMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialValueRef = useRef(activeCellValue);

  // Sync external active cell changes
  useEffect(() => {
    setAddressInput(activeCellAddress || 'A1');
  }, [activeCellAddress]);

  useEffect(() => {
    if (!isEditing) {
      setFormulaInput(activeCellValue || '');
      initialValueRef.current = activeCellValue || '';
    }
  }, [activeCellValue, isEditing]);

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cleanAddr = addressInput.trim().toUpperCase();
      if (cleanAddr) {
        onNavigateToCell?.(cleanAddr);
      }
    }
  };

  const handleCancel = () => {
    setFormulaInput(initialValueRef.current);
    setIsEditing(false);
    textareaRef.current?.blur();
  };

  const handleAccept = () => {
    onCommitValue(formulaInput);
    initialValueRef.current = formulaInput;
    setIsEditing(false);
    textareaRef.current?.blur();
  };

  const handleFormulaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAccept();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleSelectFunction = (fnName: string) => {
    setShowFxMenu(false);
    let newFormula = formulaInput.trim();
    if (!newFormula.startsWith('=')) {
      newFormula = `=${fnName}()`;
    } else {
      newFormula = `${newFormula}${fnName}()`;
    }
    setFormulaInput(newFormula);
    setIsEditing(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const cursorPosition = newFormula.indexOf('()') + 1;
        if (cursorPosition > 0) {
          textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
      }
    }, 50);
  };

  return (
    <div className="relative flex items-center gap-1 border-b border-slate-300 bg-[#f8f9fa] px-2 py-1 text-xs text-slate-800 shadow-xs">
      {/* 1. Name Box (Tọa độ ô ví dụ: B8 hoặc B8:C10) */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          onKeyDown={handleAddressKeyDown}
          disabled={disabled}
          title="Tên ô hiện tại (Gõ địa chỉ và nhấn Enter để nhảy tới ô)"
          aria-label="Cell Name Box"
          className="h-6 w-20 rounded border border-slate-300 bg-white px-1.5 font-mono text-[11px] font-semibold text-slate-800 shadow-2xs outline-none focus:border-[#107c41] focus:ring-1 focus:ring-[#107c41] disabled:bg-slate-100"
        />
      </div>

      {/* Phân cách đứng */}
      <div className="h-4 w-px bg-slate-300 mx-0.5" />

      {/* 2. Action Buttons: Cancel (X), Confirm (V), Function (fx) */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={handleCancel}
          disabled={disabled || !isEditing}
          title="Hủy bỏ thay đổi (ESC)"
          aria-label="Cancel formula edit"
          className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
            isEditing
              ? 'text-rose-600 hover:bg-rose-50 cursor-pointer'
              : 'text-slate-300 cursor-not-allowed'
          }`}
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={handleAccept}
          disabled={disabled || !isEditing}
          title="Xác nhận nhập liệu (Enter)"
          aria-label="Accept formula edit"
          className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
            isEditing
              ? 'text-emerald-700 hover:bg-emerald-50 cursor-pointer'
              : 'text-slate-300 cursor-not-allowed'
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFxMenu((prev) => !prev)}
            disabled={disabled}
            title="Chèn hàm công thức (Insert Function)"
            aria-label="Insert Function"
            className="flex h-6 px-1.5 items-center justify-center gap-0.5 rounded text-slate-700 hover:bg-slate-200 hover:text-emerald-800 font-serif italic font-bold text-xs cursor-pointer"
          >
            <span className="text-[13px] leading-none text-[#107c41]">ƒx</span>
          </button>

          {/* Function Dropdown Menu */}
          {showFxMenu && (
            <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
              <div className="px-2 py-1 text-[11px] font-bold text-slate-600 border-b border-slate-100">
                CHÈN CÔNG THỨC EXCEL
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {COMMON_FUNCTIONS.map((fn) => (
                  <button
                    key={fn.name}
                    type="button"
                    onClick={() => handleSelectFunction(fn.name)}
                    className="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-emerald-50 text-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-800">={fn.name}()</span>
                      <span className="text-[9px] text-slate-400">Excel Standard</span>
                    </div>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{fn.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phân cách đứng */}
      <div className="h-4 w-px bg-slate-300 mx-0.5" />

      {/* 3. Formula Input / Edit Box (Có thể mở rộng nhiều dòng) */}
      <div className="relative flex flex-1 items-center">
        <textarea
          ref={textareaRef}
          rows={isExpanded ? 3 : 1}
          value={formulaInput}
          onChange={(e) => {
            setFormulaInput(e.target.value);
            setIsEditing(true);
          }}
          onKeyDown={handleFormulaKeyDown}
          onFocus={() => setIsEditing(true)}
          disabled={disabled}
          placeholder="Nhập giá trị hoặc công thức (ví dụ: =SUM(D3:D16))"
          aria-label="Formula Bar Input"
          className="min-h-[24px] w-full resize-none rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] text-slate-900 shadow-2xs outline-none focus:border-[#107c41] focus:ring-1 focus:ring-[#107c41] disabled:bg-slate-100"
        />

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          title={isExpanded ? 'Thu gọn thanh công thức' : 'Mở rộng thanh công thức'}
          className="absolute right-1 top-1 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

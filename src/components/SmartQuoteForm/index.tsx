import React, { useState, useMemo } from 'react';
import {
  QuoteFormData,
  WorkItem,
  DEFAULT_QUOTE_FORM,
  calculateQuote,
  formatVND
} from '../../lib/quote-calculator';
import { LiveA4Preview } from './LiveA4Preview';
import {
  FileSpreadsheet,
  Building2,
  Users2,
  ListPlus,
  Trash2,
  Percent,
  Clock,
  Send,
  Eye,
  Edit3,
  Layers,
  Sparkles,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const SmartQuoteForm: React.FC = () => {
  const [formData, setFormData] = useState<QuoteFormData>(DEFAULT_QUOTE_FORM);
  const [activeTab, setActiveTab] = useState<'project' | 'team' | 'items' | 'terms'>('items');
  const [mobileView, setMobileView] = useState<'form' | 'preview'>('form');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tính toán số liệu tự động
  const calculations = useMemo(() => calculateQuote(formData), [formData]);

  // Cập nhật thông tin dự án
  const handleUpdateField = <K extends keyof QuoteFormData>(field: K, value: QuoteFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Cập nhật cấu hình tổ đội
  const handleUpdateTeam = <K extends keyof QuoteFormData['teamConfig']>(field: K, value: QuoteFormData['teamConfig'][K]) => {
    setFormData(prev => ({
      ...prev,
      teamConfig: { ...prev.teamConfig, [field]: value }
    }));
  };

  // Thêm dòng công việc mới
  const handleAddItem = () => {
    const newItem: WorkItem = {
      id: `item-${Date.now()}`,
      code: `KS-0${formData.items.length + 1}`,
      name: 'Đo vẽ bổ sung mặt bằng chi tiết',
      unit: 'Điểm',
      quantity: 1,
      unitPrice: 1500000,
      note: 'Áp dụng thiết bị RTK tiêu chuẩn'
    };
    setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  // Xóa dòng công việc
  const handleDeleteItem = (id: string) => {
    if (formData.items.length <= 1) {
      alert('Báo giá cần có ít nhất 1 hạng mục công việc.');
      return;
    }
    setFormData(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
  };

  // Sửa dòng công việc
  const handleUpdateItem = (id: string, updates: Partial<WorkItem>) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => (item.id === id ? { ...item, ...updates } : item))
    }));
  };

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] p-3 sm:p-5 lg:p-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#105CB3] text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 border border-[#BAE0FD] animate-fade-in text-xs font-semibold">
          <CheckCircle className="w-4 h-4 text-[#BAE0FD]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Capsule Header */}
      <header className="max-w-7xl mx-auto bg-white/90 backdrop-blur-md rounded-2xl border border-[#BAE0FD] p-3 sm:p-4 shadow-sm mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#105CB3] to-[#268DF0] text-white flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg text-[#0F172A] leading-tight">
                  Studio Soạn Thảo Báo Giá Trắc Địa
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0F7FF] text-[#105CB3] border border-[#BAE0FD]">
                  Phúc Gia Engine v2.0
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Mã hồ sơ: <span className="font-mono font-bold text-[#105CB3]">{formData.quoteCode}</span> • Định mức tự động
              </p>
            </div>
          </div>

          {/* Quick Actions & Mobile Toggle */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="lg:hidden flex bg-[#F0F7FF] p-1 rounded-xl border border-[#BAE0FD]">
              <button
                type="button"
                onClick={() => setMobileView('form')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  mobileView === 'form' ? 'bg-[#268DF0] text-white shadow-2xs' : 'text-[#64748B]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Nhập Liệu</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileView('preview')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  mobileView === 'preview' ? 'bg-[#268DF0] text-white shadow-2xs' : 'text-[#64748B]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Xem A4</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => showNotification('Đã đồng bộ và lưu nháp thành công!')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-white bg-[#268DF0] hover:bg-[#105CB3] transition-all shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi Duyệt</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Layout: Form Bento on Left, Live A4 Preview on Right */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: BENTO FORM EDITOR */}
        <div className={`lg:col-span-6 space-y-4 ${mobileView === 'preview' ? 'hidden lg:block' : 'block'}`}>
          {/* Navigation Pill Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-[#BAE0FD] shadow-2xs overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'items'
                  ? 'bg-[#268DF0] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#105CB3] hover:bg-[#F0F7FF]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>1. Hạng Mục Khảo Sát ({formData.items.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('project')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'project'
                  ? 'bg-[#268DF0] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#105CB3] hover:bg-[#F0F7FF]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>2. Thông Tin Dự Án</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'team'
                  ? 'bg-[#268DF0] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#105CB3] hover:bg-[#F0F7FF]'
              }`}
            >
              <Users2 className="w-3.5 h-3.5" />
              <span>3. Tổ Đội & OT</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'terms'
                  ? 'bg-[#268DF0] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#105CB3] hover:bg-[#F0F7FF]'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>4. VAT & Điều Khoản</span>
            </button>
          </div>

          {/* TAB 1: WORK ITEMS LIST */}
          {activeTab === 'items' && (
            <div className="bg-white rounded-2xl border border-[#BAE0FD] p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#BAE0FD]/60">
                <div>
                  <h3 className="font-bold text-sm text-[#0F172A]">Danh Mục Công Việc Đo Đạc</h3>
                  <p className="text-[11px] text-[#64748B]">Click trực tiếp vào ô để sửa số lượng & đơn giá</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-[#268DF0] hover:bg-[#105CB3] transition-all shadow-2xs"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>Thêm Dòng</span>
                </button>
              </div>

              <div className="space-y-3">
                {formData.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#F0F7FF]/50 hover:bg-[#F0F7FF] rounded-xl border border-[#BAE0FD] transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-5 h-5 rounded-full bg-[#105CB3] text-white text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => handleUpdateItem(item.id, { name: e.target.value })}
                          className="flex-1 text-xs font-semibold text-[#0F172A] bg-white border border-[#BAE0FD] rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-[#268DF0] outline-hidden"
                          placeholder="Tên hạng mục khảo sát..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                        title="Xóa dòng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-12 gap-2 text-xs">
                      <div className="col-span-3">
                        <label className="text-[10px] font-medium text-[#64748B] block mb-0.5">ĐVT</label>
                        <select
                          value={item.unit}
                          onChange={e => handleUpdateItem(item.id, { unit: e.target.value })}
                          className="w-full bg-white border border-[#BAE0FD] rounded-lg px-2 py-1 text-xs font-medium text-[#0F172A] outline-hidden"
                        >
                          <option value="Điểm">Điểm</option>
                          <option value="Ha">Ha</option>
                          <option value="Km">Km</option>
                          <option value="Ca">Ca</option>
                          <option value="Ngày">Ngày</option>
                          <option value="Bộ">Bộ</option>
                          <option value="Vị trí">Vị trí</option>
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="text-[10px] font-medium text-[#64748B] block mb-0.5">Khối Lượng</label>
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          value={item.quantity}
                          onChange={e => handleUpdateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-[#BAE0FD] rounded-lg px-2 py-1 text-xs font-bold text-[#0F172A] outline-hidden"
                        />
                      </div>

                      <div className="col-span-6">
                        <label className="text-[10px] font-medium text-[#64748B] block mb-0.5">Đơn Giá (VNĐ)</label>
                        <input
                          type="number"
                          step="10000"
                          value={item.unitPrice}
                          onChange={e => handleUpdateItem(item.id, { unitPrice: parseInt(e.target.value, 10) || 0 })}
                          className="w-full bg-white border border-[#BAE0FD] rounded-lg px-2 py-1 text-xs font-mono font-semibold text-[#105CB3] outline-hidden text-right"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#BAE0FD]/50">
                      <span className="text-[#64748B] italic">{item.note || 'Không có ghi chú'}</span>
                      <span className="font-mono font-bold text-[#105CB3]">
                        = {(item.quantity * item.unitPrice).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: PROJECT INFO */}
          {activeTab === 'project' && (
            <div className="bg-white rounded-2xl border border-[#BAE0FD] p-4 sm:p-5 shadow-2xs space-y-4">
              <h3 className="font-bold text-sm text-[#0F172A] pb-2 border-b border-[#BAE0FD]/60">
                Thông Tin Dự Án & Chủ Đầu Tư
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-[#475569] mb-1">Tên Dự Án Khảo Sát</label>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={e => handleUpdateField('projectName', e.target.value)}
                    className="w-full bg-[#F0F7FF]/50 border border-[#BAE0FD] rounded-xl px-3 py-2 font-semibold text-[#0F172A] focus:bg-white outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-[#475569] mb-1">Tên Khách Hàng / Chủ Đầu Tư</label>
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={e => handleUpdateField('clientName', e.target.value)}
                      className="w-full bg-[#F0F7FF]/50 border border-[#BAE0FD] rounded-xl px-3 py-2 text-[#0F172A] focus:bg-white outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-[#475569] mb-1">Người Đại Diện / Hotline</label>
                    <input
                      type="text"
                      value={formData.clientContact}
                      onChange={e => handleUpdateField('clientContact', e.target.value)}
                      className="w-full bg-[#F0F7FF]/50 border border-[#BAE0FD] rounded-xl px-3 py-2 text-[#0F172A] focus:bg-white outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-[#475569] mb-1">Địa Điểm Thực Hiện Đo Đạc</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => handleUpdateField('location', e.target.value)}
                    className="w-full bg-[#F0F7FF]/50 border border-[#BAE0FD] rounded-xl px-3 py-2 text-[#0F172A] focus:bg-white outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-[#475569] mb-1">Loại Hình Khảo Sát</label>
                    <select
                      value={formData.surveyType}
                      onChange={e => handleUpdateField('surveyType', e.target.value as QuoteFormData['surveyType'])}
                      className="w-full bg-[#F0F7FF]/50 border border-[#BAE0FD] rounded-xl px-3 py-2 font-medium text-[#0F172A] outline-hidden"
                    >
                      <option value="dia_hinh">Đo vẽ Địa hình</option>
                      <option value="dia_chinh">Đo đạc Địa chính</option>
                      <option value="quan_trac">Quan trắc công trình</option>
                      <option value="scan_3d_laser">Scan 3D Laser</option>
                      <option value="uav_flycam">Bay quét UAV Flycam</option>
                      <option value="tong_hop">Khảo sát Tổng hợp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-[#475569] mb-1">Tiến Độ Thực Hiện (Ngày)</label>
                    <input
                      type="number"
                      value={formData.executionDurationDays}
                      onChange={e => handleUpdateField('executionDurationDays', parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-[#F0F7FF]/50 border border-[#BAE0FD] rounded-xl px-3 py-2 font-bold text-[#105CB3] outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SURVEY TEAM & OT */}
          {activeTab === 'team' && (
            <div className="bg-white rounded-2xl border border-[#BAE0FD] p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#BAE0FD]/60">
                <div>
                  <h3 className="font-bold text-sm text-[#0F172A]">Tổ Đội Trắc Địa & Định Mức OT</h3>
                  <p className="text-[11px] text-[#64748B]">Tự động áp chuẩn: 01 KS chính + 01 KS phụ, OT 505.000đ/h</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                  Định mức 26 công
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#F0F7FF]/60 rounded-xl border border-[#BAE0FD]">
                  <label className="text-[10px] font-bold text-[#105CB3] uppercase block mb-1">Kỹ Sư Chính (Người)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.teamConfig.leadSurveyor}
                    onChange={e => handleUpdateTeam('leadSurveyor', parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-white border border-[#BAE0FD] rounded-lg px-2.5 py-1.5 font-bold text-sm text-[#0F172A]"
                  />
                </div>

                <div className="p-3 bg-[#F0F7FF]/60 rounded-xl border border-[#BAE0FD]">
                  <label className="text-[10px] font-bold text-[#105CB3] uppercase block mb-1">Kỹ Sư Phụ (Người)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.teamConfig.assistantSurveyor}
                    onChange={e => handleUpdateTeam('assistantSurveyor', parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-[#BAE0FD] rounded-lg px-2.5 py-1.5 font-bold text-sm text-[#0F172A]"
                  />
                </div>
              </div>

              {/* OT Widget */}
              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Làm Thêm Giờ Phụ Trội (OT)
                  </span>
                  <span className="font-mono text-xs font-semibold text-amber-800">
                    Đơn giá chuẩn: 505.000 đ/h
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-medium text-amber-800 block mb-0.5">Số Giờ OT Cần Tính</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.teamConfig.otHours}
                      onChange={e => handleUpdateTeam('otHours', parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-bold text-amber-950"
                      placeholder="0 giờ"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-amber-800 block mb-0.5">Thành Tiền OT</label>
                    <div className="w-full bg-amber-100/80 border border-amber-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-amber-950 text-right">
                      {calculations.totalOtCost.toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                </div>
              </div>

              {/* Allowances */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-medium text-[#64748B] block mb-1">Phụ cấp máy RTK & UAV (VNĐ)</label>
                  <input
                    type="number"
                    step="100000"
                    value={formData.teamConfig.equipmentAllowance}
                    onChange={e => handleUpdateTeam('equipmentAllowance', parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-[#BAE0FD] rounded-lg px-2.5 py-1.5 font-mono text-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-[#64748B] block mb-1">Phụ cấp đi lại & ăn ở (VNĐ)</label>
                  <input
                    type="number"
                    step="100000"
                    value={formData.teamConfig.travelAllowance}
                    onChange={e => handleUpdateTeam('travelAllowance', parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-[#BAE0FD] rounded-lg px-2.5 py-1.5 font-mono text-[#0F172A]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VAT & PAYMENT TERMS */}
          {activeTab === 'terms' && (
            <div className="bg-white rounded-2xl border border-[#BAE0FD] p-4 sm:p-5 shadow-2xs space-y-4">
              <h3 className="font-bold text-sm text-[#0F172A] pb-2 border-b border-[#BAE0FD]/60">
                Thuế Suất VAT & Điều Khoản Bàn Giao
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#F0F7FF]/60 rounded-xl border border-[#BAE0FD]">
                  <label className="text-[10px] font-bold text-[#105CB3] uppercase block mb-1">Thuế Suất VAT (%)</label>
                  <select
                    value={formData.vatRate}
                    onChange={e => handleUpdateField('vatRate', parseInt(e.target.value, 10) || 8)}
                    className="w-full bg-white border border-[#BAE0FD] rounded-lg px-2.5 py-1.5 font-bold text-[#105CB3]"
                  >
                    <option value={8}>8% (Nghị định giảm thuế)</option>
                    <option value={10}>10% (Thuế suất chuẩn)</option>
                    <option value={0}>0% (Không chịu thuế)</option>
                  </select>
                </div>

                <div className="p-3 bg-[#F0F7FF]/60 rounded-xl border border-[#BAE0FD]">
                  <label className="text-[10px] font-bold text-[#105CB3] uppercase block mb-1">Tỷ Lệ Tạm Ứng (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.advanceRate}
                    onChange={e => handleUpdateField('advanceRate', parseInt(e.target.value, 10) || 30)}
                    className="w-full bg-white border border-[#BAE0FD] rounded-lg px-2.5 py-1.5 font-bold text-[#0F172A]"
                  />
                </div>
              </div>

              {/* Summary Card */}
              <div className="p-4 bg-gradient-to-tr from-[#105CB3] to-[#268DF0] text-white rounded-xl shadow-md space-y-2">
                <div className="flex justify-between items-center text-xs opacity-90">
                  <span>Tổng cộng trước thuế:</span>
                  <span className="font-mono font-semibold">{formatVND(calculations.totalBeforeVat)}</span>
                </div>
                <div className="flex justify-between items-center text-xs opacity-90">
                  <span>Tiền thuế VAT ({formData.vatRate}%):</span>
                  <span className="font-mono font-semibold">{formatVND(calculations.vatAmount)}</span>
                </div>
                <div className="pt-2 border-t border-white/20 flex justify-between items-center">
                  <span className="font-bold text-sm">TỔNG THANH TOÁN:</span>
                  <span className="font-mono font-black text-base lg:text-lg bg-white/10 px-2 py-0.5 rounded">
                    {formatVND(calculations.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats Footer Bento */}
          <div className="bg-white rounded-2xl border border-[#BAE0FD] p-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#268DF0]" />
              <span className="text-[#64748B]">Tổng thanh toán:</span>
              <span className="font-mono font-bold text-[#105CB3] text-sm">
                {formatVND(calculations.grandTotal)}
              </span>
            </div>
            <span className="text-[11px] text-[#64748B] flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-[#268DF0]" />
              Tự động lưu nháp
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE A4 PREVIEW (Desktop Always Visible, Mobile Toggle) */}
        <div className={`lg:col-span-6 h-[720px] lg:h-[840px] sticky top-6 ${mobileView === 'form' ? 'hidden lg:block' : 'block'}`}>
          <LiveA4Preview
            formData={formData}
            calculations={calculations}
            onExportExcel={() => showNotification('Đang tạo và tải file Excel A4 chuẩn Phúc Gia...')}
            onPrint={() => window.print()}
          />
        </div>
      </main>
    </div>
  );
};

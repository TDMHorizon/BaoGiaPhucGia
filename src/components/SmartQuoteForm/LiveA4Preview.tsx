import React from 'react';
import { QuoteFormData, QuoteCalculations, formatVND } from '../../lib/quote-calculator';
import { Printer, Download, CheckCircle2, ShieldCheck } from 'lucide-react';

interface LiveA4PreviewProps {
  formData: QuoteFormData;
  calculations: QuoteCalculations;
  onPrint?: () => void;
  onExportExcel?: () => void;
}

export const LiveA4Preview: React.FC<LiveA4PreviewProps> = ({
  formData,
  calculations,
  onPrint,
  onExportExcel
}) => {
  return (
    <div className="flex flex-col h-full bg-[#F0F7FF]/60 rounded-2xl border border-[#BAE0FD] p-4 lg:p-6 shadow-sm overflow-hidden">
      {/* Top Action Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#BAE0FD]/80 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#268DF0] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            A4
          </div>
          <div>
            <h3 className="font-semibold text-sm text-[#0F172A] leading-tight">
              Bản In Trực Quan Khổ A4
            </h3>
            <p className="text-[11px] text-[#64748B]">Tỷ lệ chuẩn 100% theo mẫu Phúc Gia</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrint || (() => window.print())}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-[#105CB3] bg-white border border-[#BAE0FD] hover:bg-[#F0F7FF] transition-all shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-[#268DF0]" />
            <span>In A4</span>
          </button>
          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-[#268DF0] hover:bg-[#105CB3] transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* A4 Sheet Paper Simulation */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <div className="bg-white rounded-xl shadow-md border border-[#BAE0FD]/70 p-6 lg:p-8 text-[#0F172A] text-[12px] leading-relaxed max-w-[800px] mx-auto transition-all">
          {/* Header Doanh nghiệp */}
          <div className="flex items-start justify-between border-b-2 border-[#105CB3] pb-4 mb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded bg-[#105CB3] text-white font-black text-[13px] tracking-wider">
                  PHÚC GIA
                </div>
                <span className="font-bold text-[#105CB3] text-sm uppercase">
                  CÔNG TY CỔ PHẦN ĐO ĐẠC XÂY DỰNG PHÚC GIA
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Địa chỉ: Số 88 Trần Hưng Đạo, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh
              </p>
              <p className="text-[11px] text-[#64748B]">
                Hotline: (028) 38.888.999 • Website: tracdiaphucgia.com
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F0F7FF] text-[#105CB3] border border-[#BAE0FD]">
                {formData.quoteCode}
              </span>
              <p className="text-[11px] text-[#64748B]">Ngày: {formData.createdDate}</p>
            </div>
          </div>

          {/* Tiêu đề Báo giá */}
          <div className="text-center my-4">
            <h1 className="text-base lg:text-lg font-black text-[#105CB3] uppercase tracking-wide">
              BẢNG BÁO GIÁ DỊCH VỤ TRẮC ĐỊA & KHẢO SÁT ĐỊA HÌNH
            </h1>
            <p className="text-[11px] text-[#64748B] italic mt-0.5">
              (Áp dụng theo định mức kỹ thuật chuyên ngành & thiết bị RTK tiêu chuẩn)
            </p>
          </div>

          {/* Thông tin Khách hàng & Dự án */}
          <div className="bg-[#F0F7FF]/80 rounded-lg p-3.5 mb-5 border border-[#BAE0FD]/60 text-[11.5px] space-y-1.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <span className="text-[#64748B]">Khách hàng: </span>
                <span className="font-bold text-[#0F172A]">{formData.clientName}</span>
              </div>
              <div>
                <span className="text-[#64748B]">Người liên hệ: </span>
                <span className="font-medium text-[#0F172A]">{formData.clientContact} ({formData.clientPhone})</span>
              </div>
              <div>
                <span className="text-[#64748B]">Tên dự án: </span>
                <span className="font-semibold text-[#105CB3]">{formData.projectName}</span>
              </div>
              <div>
                <span className="text-[#64748B]">Địa điểm đo đạc: </span>
                <span className="font-medium text-[#0F172A]">{formData.location}</span>
              </div>
            </div>
          </div>

          {/* Bảng chi tiết hạng mục */}
          <div className="overflow-x-auto rounded-lg border border-[#BAE0FD] mb-4">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-[#105CB3] text-white font-semibold">
                  <th className="py-2 px-2 text-center w-8 border-r border-[#268DF0]/40">STT</th>
                  <th className="py-2 px-3 border-r border-[#268DF0]/40">Hạng mục công việc khảo sát</th>
                  <th className="py-2 px-2 text-center w-12 border-r border-[#268DF0]/40">ĐVT</th>
                  <th className="py-2 px-2 text-right w-14 border-r border-[#268DF0]/40">KL</th>
                  <th className="py-2 px-3 text-right w-24 border-r border-[#268DF0]/40">Đơn giá (VNĐ)</th>
                  <th className="py-2 px-3 text-right w-28">Thành tiền (VNĐ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BAE0FD]/40">
                {formData.items.map((item, idx) => {
                  const lineTotal = item.quantity * item.unitPrice;
                  return (
                    <tr key={item.id} className={idx % 2 === 1 ? 'bg-[#F0F7FF]/50' : 'bg-white'}>
                      <td className="py-2 px-2 text-center text-[#64748B] font-medium border-r border-[#BAE0FD]/40">{idx + 1}</td>
                      <td className="py-2 px-3 border-r border-[#BAE0FD]/40">
                        <div className="font-semibold text-[#0F172A]">{item.name}</div>
                        {item.note && <div className="text-[10px] text-[#64748B] italic">{item.note}</div>}
                      </td>
                      <td className="py-2 px-2 text-center text-[#64748B] border-r border-[#BAE0FD]/40">{item.unit}</td>
                      <td className="py-2 px-2 text-right font-medium border-r border-[#BAE0FD]/40">{item.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono text-[#475569] border-r border-[#BAE0FD]/40">{item.unitPrice.toLocaleString('vi-VN')}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-[#105CB3]">{lineTotal.toLocaleString('vi-VN')}</td>
                    </tr>
                  );
                })}

                {/* Dòng OT nếu có */}
                {formData.teamConfig.otHours > 0 && (
                  <tr className="bg-[#FFFBEB]">
                    <td className="py-2 px-2 text-center text-amber-700 font-medium border-r border-[#BAE0FD]/40">*</td>
                    <td className="py-2 px-3 border-r border-[#BAE0FD]/40 text-amber-900 font-medium">
                      Phụ trội làm thêm giờ (OT ca đêm / khẩn cấp: {formData.teamConfig.otHours} giờ)
                    </td>
                    <td className="py-2 px-2 text-center text-amber-700 border-r border-[#BAE0FD]/40">Giờ</td>
                    <td className="py-2 px-2 text-right font-medium text-amber-900 border-r border-[#BAE0FD]/40">{formData.teamConfig.otHours}</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-800 border-r border-[#BAE0FD]/40">
                      {formData.teamConfig.otHourlyRate.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-900">
                      {calculations.totalOtCost.toLocaleString('vi-VN')}
                    </td>
                  </tr>
                )}

                {/* Dòng phụ cấp thiết bị & di chuyển */}
                {calculations.totalAllowances > 0 && (
                  <tr className="bg-[#F8FAFC]">
                    <td className="py-2 px-2 text-center text-[#64748B] border-r border-[#BAE0FD]/40">**</td>
                    <td colSpan={4} className="py-2 px-3 border-r border-[#BAE0FD]/40 text-[#475569]">
                      Phí kiểm định mốc tọa độ, phụ cấp trạm phát RTK & di chuyển xa
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-[#475569]">
                      {calculations.totalAllowances.toLocaleString('vi-VN')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Phần Tổng Kết Giá Trị & Thuế */}
          <div className="bg-[#F0F7FF]/50 rounded-lg p-3 border border-[#BAE0FD] mb-5 space-y-1.5">
            <div className="flex justify-between items-center text-[11.5px]">
              <span className="text-[#475569]">Tổng tiền trước thuế VAT:</span>
              <span className="font-mono font-bold text-[#0F172A]">{formatVND(calculations.totalBeforeVat)}</span>
            </div>
            <div className="flex justify-between items-center text-[11.5px]">
              <span className="text-[#475569]">Thuế giá trị gia tăng VAT ({formData.vatRate}%):</span>
              <span className="font-mono font-medium text-[#0F172A]">{formatVND(calculations.vatAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-[13px] pt-1.5 border-t border-[#BAE0FD] font-bold text-[#105CB3]">
              <span>TỔNG CỘNG GIÁ TRỊ BÁO GIÁ:</span>
              <span className="font-mono text-sm lg:text-base text-[#105CB3] bg-white px-2 py-0.5 rounded border border-[#BAE0FD]">
                {formatVND(calculations.grandTotal)}
              </span>
            </div>
            <div className="text-[11px] italic text-[#475569] pt-1">
              <span className="font-semibold text-[#0F172A]">Số tiền bằng chữ: </span>
              <span className="text-[#105CB3]">{calculations.amountInWords}</span>
            </div>
          </div>

          {/* Điều khoản & Chữ ký */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 text-[11px]">
            <div className="space-y-1">
              <h4 className="font-bold text-[#105CB3] uppercase flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#268DF0]" />
                ĐIỀU KHOẢN KỸ THUẬT & THANH TOÁN
              </h4>
              <ul className="list-disc list-inside space-y-0.5 text-[#475569]">
                <li>Thời gian thực hiện dự kiến: <strong>{formData.executionDurationDays} ngày</strong> làm việc.</li>
                <li>Tạm ứng đợt 1 ({formData.advanceRate}%): <strong>{formatVND(calculations.advancePayment)}</strong> khi ký HĐ.</li>
                <li>Thanh toán đợt 2 (Còn lại): <strong>{formatVND(calculations.remainingPayment)}</strong> sau khi bàn giao nghiệm thu.</li>
                <li>Báo giá có hiệu lực trong vòng <strong>{formData.validityDays} ngày</strong>.</li>
              </ul>
            </div>

            <div className="text-center space-y-1">
              <p className="font-bold text-[#0F172A] uppercase">ĐẠI DIỆN CÔNG TY CP ĐO ĐẠC PHÚC GIA</p>
              <p className="text-[10px] text-[#64748B] italic">(Ký, ghi rõ họ tên và đóng dấu)</p>
              <div className="h-14 flex items-center justify-center">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#105CB3] bg-[#F0F7FF] px-2.5 py-1 rounded border border-[#BAE0FD]">
                  <CheckCircle2 className="w-3 h-3 text-[#268DF0]" />
                  Đã xác thực chữ ký số nội bộ
                </span>
              </div>
              <p className="font-bold text-[#105CB3]">GIÁM ĐỐC ĐIỀU HÀNH</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

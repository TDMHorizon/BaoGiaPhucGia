import React from 'react';
import { 
  Plus, 
  FileSpreadsheet, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

const ExecutiveDashboard = () => {
  return (
    // Nền tổng thể sử dụng màu Primary-mist (#F0F7FF)
    <div className="min-h-screen bg-[#F0F7FF] p-6 font-sans">
      
      {/* Header Dashboard */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">EXECUTIVE COMMAND CENTER</h1>
          <p className="text-[#64748B]">Trung tâm điều hành và giám sát doanh số trắc địa</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="h-10 w-10 rounded-full bg-[#268DF0] flex items-center justify-center text-white font-bold">
            PG
          </div>
        </div>
      </div>

      {/* Lưới Bento Grid Bất Đối Xứng */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* THẺ BENTO 1: TỔNG QUAN TÀI CHÍNH (4 cột) */}
        <div className="col-span-12 md:col-span-4 bg-white rounded-2xl p-6 shadow-sm border border-[#BAE0FD] flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#64748B] mb-2 uppercase">Doanh số báo giá trong tháng</h2>
            <p className="text-3xl font-bold text-[#0F172A]">1.450.000.000 đ</p>
          </div>
          
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-sm text-[#64748B] mb-1">Tỷ lệ chuyển đổi</p>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-[#108981]">68%</span>
                <span className="flex items-center text-xs text-[#108981] bg-[#108981]/10 px-2 py-1 rounded-full">
                  <TrendingUp size={14} className="mr-1" /> +5.2%
                </span>
              </div>
            </div>
            {/* Mini Sparkline mô phỏng */}
            <svg width="100" height="40" viewBox="0 0 100 40" className="stroke-[#268DF0] fill-none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M0 30 C 20 30, 20 10, 40 20 C 60 30, 60 5, 80 15 C 90 20, 95 10, 100 5" />
            </svg>
          </div>
        </div>

        {/* THẺ BENTO 2: HÀNH ĐỘNG NHANH (4 cột) */}
        <div className="col-span-12 md:col-span-4 bg-white rounded-2xl p-6 shadow-sm border border-[#BAE0FD] flex flex-col justify-center space-y-4">
          <h2 className="text-sm font-semibold text-[#64748B] uppercase mb-1">Thao tác nhanh 1-chạm</h2>
          <button className="w-full flex items-center justify-center py-3 px-4 bg-[#268DF0] hover:bg-[#105CB3] text-white rounded-xl font-medium transition-colors">
            <Plus size={18} className="mr-2" />
            Tạo Báo giá Khảo sát mới
          </button>
          <button className="w-full flex items-center justify-center py-3 px-4 bg-[#F0F7FF] hover:bg-[#BAE0FD] text-[#105CB3] border border-[#268DF0]/20 rounded-xl font-medium transition-colors">
            <FileSpreadsheet size={18} className="mr-2" />
            Soạn Hợp đồng trắc địa mẫu
          </button>
          <button className="w-full flex items-center justify-center py-3 px-4 bg-white hover:bg-gray-50 text-[#0F172A] border border-gray-200 rounded-xl font-medium transition-colors">
            Nhập nhanh bảng tính Excel
          </button>
        </div>

        {/* THẺ BENTO 3: DÒNG SỰ KIỆN (4 cột ngang, 2 cột dọc - Trải dài xuống) */}
        <div className="col-span-12 md:col-span-4 md:row-span-2 bg-white rounded-2xl p-6 shadow-sm border border-[#BAE0FD] overflow-hidden flex flex-col">
          <h2 className="text-sm font-semibold text-[#64748B] uppercase mb-4">Dòng sự kiện hoạt động (Live Feed)</h2>
          <div className="flex-1 overflow-y-auto space-y-5 pr-2">
            
            {/* Feed Item 1 */}
            <div className="flex items-start space-x-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-[#268DF0] ring-4 ring-[#F0F7FF]"></div>
              <div>
                <p className="text-sm text-[#0F172A]">Kỹ sư <strong>Nguyễn Văn A</strong> vừa cập nhật tọa độ DA Waterpoint</p>
                <p className="text-xs text-[#64748B] flex items-center mt-1"><Clock size={12} className="mr-1"/> Vài giây trước</p>
              </div>
            </div>

            {/* Feed Item 2 */}
            <div className="flex items-start space-x-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-[#108981] ring-4 ring-[#108981]/10"></div>
              <div>
                <p className="text-sm text-[#0F172A]">Giám đốc vừa duyệt <strong>Báo giá #12</strong></p>
                <p className="text-xs text-[#64748B] flex items-center mt-1"><Clock size={12} className="mr-1"/> 5 phút trước</p>
              </div>
            </div>

            {/* Feed Item 3 */}
            <div className="flex items-start space-x-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-[#F59E0B] ring-4 ring-[#F59E0B]/10"></div>
              <div>
                <p className="text-sm text-[#0F172A]">Khách hàng Hưng Thịnh yêu cầu chỉnh sửa <strong>Báo giá #08</strong></p>
                <p className="text-xs text-[#64748B] flex items-center mt-1"><Clock size={12} className="mr-1"/> 15 phút trước</p>
              </div>
            </div>

            {/* Feed Item 4 */}
            <div className="flex items-start space-x-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-[#268DF0] ring-4 ring-[#F0F7FF]"></div>
              <div>
                <p className="text-sm text-[#0F172A]">Kỹ sư <strong>Trần Thị B</strong> đã xuất bản PDF Báo giá #11</p>
                <p className="text-xs text-[#64748B] flex items-center mt-1"><Clock size={12} className="mr-1"/> 1 giờ trước</p>
              </div>
            </div>
            
          </div>
        </div>

        {/* THẺ BENTO 4: CẦN XỬ LÝ GẤP (5 cột) */}
        <div className="col-span-12 md:col-span-5 bg-white rounded-2xl p-6 shadow-sm border border-[#BAE0FD]">
          <h2 className="text-sm font-semibold text-[#64748B] uppercase mb-4">Danh sách báo giá cần xử lý gấp</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[#64748B] border-b border-gray-100">
                  <th className="pb-3 font-medium">Mã BG</th>
                  <th className="pb-3 font-medium">Dự án</th>
                  <th className="pb-3 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50 last:border-0 hover:bg-[#F0F7FF]/50 transition-colors">
                  <td className="py-3 font-medium text-[#0F172A]">BG-12</td>
                  <td className="py-3 text-[#64748B]">DA Vinhomes Grand Park</td>
                  <td className="py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#F59E0B]/10 text-[#F59E0B]">
                      Chờ duyệt
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-gray-50 last:border-0 hover:bg-[#F0F7FF]/50 transition-colors">
                  <td className="py-3 font-medium text-[#0F172A]">BG-08</td>
                  <td className="py-3 text-[#64748B]">DA Aqua City</td>
                  <td className="py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#EF4444]/10 text-[#EF4444]">
                      KH yêu cầu điều chỉnh
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-gray-50 last:border-0 hover:bg-[#F0F7FF]/50 transition-colors">
                  <td className="py-3 font-medium text-[#0F172A]">BG-15</td>
                  <td className="py-3 text-[#64748B]">DA Waterpoint Nam Long</td>
                  <td className="py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#F59E0B]/10 text-[#F59E0B]">
                      Chờ thẩm định kỹ thuật
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* THẺ BENTO 5: CẢNH BÁO ĐỊNH MỨC KỸ THUẬT (3 cột) */}
        <div className="col-span-12 md:col-span-3 bg-white rounded-2xl p-6 shadow-sm border border-[#BAE0FD]">
          <h2 className="text-sm font-semibold text-[#64748B] uppercase mb-4 flex items-center">
            <AlertTriangle size={16} className="mr-2 text-[#F59E0B]" />
            Cảnh báo tham số
          </h2>
          <div className="space-y-4">
            
            <div className="flex items-start space-x-3 p-3 bg-[#F59E0B]/5 rounded-xl border border-[#F59E0B]/20">
              <AlertCircle size={18} className="text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">OT vượt quá 40 giờ</p>
                <p className="text-xs text-[#64748B] mt-1">Tổ đội 1 (Dự án Waterpoint) đã vượt định mức OT trong tháng.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-[#EF4444]/5 rounded-xl border border-[#EF4444]/20">
              <AlertCircle size={18} className="text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">VAT chưa chuẩn 8%</p>
                <p className="text-xs text-[#64748B] mt-1">BG-09 đang sử dụng mức thuế 10%, cần cập nhật.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-[#F0F7FF] rounded-xl border border-[#BAE0FD]">
              <AlertTriangle size={18} className="text-[#268DF0] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Thiếu chi phí máy GPS</p>
                <p className="text-xs text-[#64748B] mt-1">BG-12 đo lưới nhưng chưa add hạng mục máy.</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default ExecutiveDashboard;
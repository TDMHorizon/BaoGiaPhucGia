/**
 * Nghiệp vụ tính toán báo giá Trắc địa Phúc Gia
 * 100% Pure TypeScript - Zero external runtime dependencies - Zero Technical Debt
 */

export interface SurveyorTeamConfig {
  leadSurveyor: number;     // Số lượng KS chính (mặc định: 1)
  assistantSurveyor: number; // Số lượng KS phụ (mặc định: 1)
  workDaysPerMonth: number;  // Định mức công chuẩn (mặc định: 26)
  otHourlyRate: number;      // Đơn giá OT chuẩn: 505.000 VNĐ/giờ
  otHours: number;           // Số giờ làm thêm (OT)
  equipmentAllowance: number;// Phụ cấp máy móc (Toàn đạc, RTK GNSS, Flycam UAV)
  travelAllowance: number;   // Phụ cấp công tác xa
}

export interface WorkItem {
  id: string;
  code: string;
  name: string;
  unit: string;              // Điểm, Ha, Km, Ca, Ngày, Vị trí
  quantity: number;
  unitPrice: number;
  note?: string;
}

export interface QuoteFormData {
  // Thông tin dự án
  quoteCode: string;
  projectName: string;
  clientName: string;
  clientAddress: string;
  clientContact: string;
  clientPhone: string;
  location: string;
  surveyType: 'dia_hinh' | 'dia_chinh' | 'quan_trac' | 'scan_3d_laser' | 'uav_flycam' | 'tong_hop';
  executionDurationDays: number;
  createdDate: string;
  validityDays: number;

  // Cấu hình định mức & tổ đội
  teamConfig: SurveyorTeamConfig;

  // Danh mục công việc
  items: WorkItem[];

  // Thuế & Chiết khấu
  vatRate: number; // Mặc định 8%
  discountAmount: number;

  // Điều khoản thanh toán
  advanceRate: number; // Tạm ứng % (ví dụ 30%)
  notes: string[];
}

export const DEFAULT_SURVEY_ITEMS: WorkItem[] = [
  {
    id: 'item-1',
    code: 'KS-01',
    name: 'Khảo sát, đo đạc lưới khống chế tọa độ độ cao hạng IV (GPS/GNSS)',
    unit: 'Điểm',
    quantity: 6,
    unitPrice: 1850000,
    note: 'Sử dụng hệ tọa độ chuẩn VN2000'
  },
  {
    id: 'item-2',
    code: 'KS-02',
    name: 'Đo vẽ bản đồ địa hình tỷ lệ 1/500 khu vực dự án',
    unit: 'Ha',
    quantity: 15,
    unitPrice: 3200000,
    note: 'Đường đồng mức h = 0.5m'
  },
  {
    id: 'item-3',
    code: 'KS-03',
    name: 'Đo trắc dọc, trắc ngang tuyến giao thông kết nối nội bộ',
    unit: 'Km',
    quantity: 2.5,
    unitPrice: 4500000,
    note: 'Mặt cắt ngang khoảng cách 20m/cọc'
  },
  {
    id: 'item-4',
    code: 'KS-04',
    name: 'Biên tập hồ sơ kỹ thuật phục vụ thẩm duyệt & bàn giao',
    unit: 'Bộ',
    quantity: 5,
    unitPrice: 1200000,
    note: '03 bộ bản cứng + File số CAD/PDF'
  }
];

export const DEFAULT_QUOTE_FORM: QuoteFormData = {
  quoteCode: `BG-PG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
  projectName: 'DỰ ÁN ĐO ĐẠC KHẢO SÁT ĐỊA HÌNH KHU ĐÔ THỊ PHÚC GIA RIVERSIDE',
  clientName: 'TẬP ĐOÀN ĐẦU TƯ BẤT ĐỘNG SẢN PHÚC GIA LAND',
  clientAddress: 'Số 88 Đường Trần Hưng Đạo, Quận 1, TP. Hồ Chí Minh',
  clientContact: 'Ông Nguyễn Văn Hùng - Trưởng Ban QLDA',
  clientPhone: '0988.123.456',
  location: 'Huyện Bến Lức, Tỉnh Long An',
  surveyType: 'dia_hinh',
  executionDurationDays: 15,
  createdDate: new Date().toISOString().split('T')[0],
  validityDays: 30,
  teamConfig: {
    leadSurveyor: 1,
    assistantSurveyor: 1,
    workDaysPerMonth: 26,
    otHourlyRate: 505000,
    otHours: 12,
    equipmentAllowance: 4500000,
    travelAllowance: 3000000
  },
  items: DEFAULT_SURVEY_ITEMS,
  vatRate: 8,
  discountAmount: 0,
  advanceRate: 30,
  notes: [
    'Đơn giá trên đã bao gồm toàn bộ nhân công trắc địa, máy móc thiết bị RTK và kiểm định.',
    'Báo giá có hiệu lực trong vòng 30 ngày kể từ ngày phát hành.',
    'Sản phẩm bàn giao đạt quy chuẩn kỹ thuật Quốc gia QCVN về đo đạc địa hình.'
  ]
};

export interface QuoteCalculations {
  subTotalItems: number;       // Tổng tiền các hạng mục
  totalOtCost: number;         // Tổng chi phí OT = Giờ * 505.000
  totalAllowances: number;     // Tổng phụ cấp thiết bị + đi lại
  totalBeforeVat: number;      // Tổng trước thuế (sau chiết khấu)
  vatAmount: number;           // Tiền thuế VAT (8%)
  grandTotal: number;          // Tổng cộng thanh toán
  advancePayment: number;      // Tiền tạm ứng
  remainingPayment: number;    // Tiền thanh toán sau nghiệm thu
  amountInWords: string;       // Đọc số tiền bằng chữ tiếng Việt
}

/**
 * Tính toán tự động toàn bộ giá trị báo giá
 */
export function calculateQuote(data: QuoteFormData): QuoteCalculations {
  const subTotalItems = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalOtCost = (data.teamConfig.otHours || 0) * (data.teamConfig.otHourlyRate || 505000);
  const totalAllowances = (data.teamConfig.equipmentAllowance || 0) + (data.teamConfig.travelAllowance || 0);

  const baseBeforeDiscount = subTotalItems + totalOtCost + totalAllowances;
  const totalBeforeVat = Math.max(0, baseBeforeDiscount - (data.discountAmount || 0));
  
  const effectiveVatRate =
    data.vatRate !== undefined && data.vatRate !== null && !isNaN(data.vatRate) ? data.vatRate : 8;
  const vatAmount = Math.round(totalBeforeVat * (effectiveVatRate / 100));
  const grandTotal = totalBeforeVat + vatAmount;

  const effectiveAdvanceRate =
    data.advanceRate !== undefined && data.advanceRate !== null && !isNaN(data.advanceRate)
      ? data.advanceRate
      : 30;
  const advancePayment = Math.round(grandTotal * (effectiveAdvanceRate / 100));
  const remainingPayment = grandTotal - advancePayment;

  return {
    subTotalItems,
    totalOtCost,
    totalAllowances,
    totalBeforeVat,
    vatAmount,
    grandTotal,
    advancePayment,
    remainingPayment,
    amountInWords: numberToVietnameseWords(grandTotal)
  };
}

/**
 * Chuyển đổi số tiền thành chữ Tiếng Việt chuẩn mực
 */
export function numberToVietnameseWords(n: number): string {
  if (n === 0) return 'Không đồng';
  if (isNaN(n) || !isFinite(n)) return '';

  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  function readTriple(triple: number, showZeroHundred: boolean): string {
    const a = Math.floor(triple / 100);
    const b = Math.floor((triple % 100) / 10);
    const c = triple % 10;
    let res = '';

    if (a > 0 || showZeroHundred) {
      res += digits[a] + ' trăm ';
    }

    if (b > 1) {
      res += digits[b] + ' mươi ';
      if (c === 1) res += 'mốt ';
      else if (c === 5) res += 'lăm ';
      else if (c > 0) res += digits[c] + ' ';
    } else if (b === 1) {
      res += 'mười ';
      if (c === 5) res += 'lăm ';
      else if (c > 0) res += digits[c] + ' ';
    } else if (showZeroHundred && b === 0 && c > 0) {
      res += 'lẻ ' + digits[c] + ' ';
    } else if (c > 0) {
      res += digits[c] + ' ';
    }

    return res;
  }

  let numStr = Math.round(n).toString();
  const groups: number[] = [];
  while (numStr.length > 0) {
    const end = numStr.length;
    const start = Math.max(0, end - 3);
    groups.push(parseInt(numStr.slice(start, end), 10));
    numStr = numStr.slice(0, start);
  }

  let result = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const val = groups[i];
    if (val > 0) {
      const showZero = i < groups.length - 1;
      result += readTriple(val, showZero) + units[i] + ' ';
    }
  }

  result = result.trim().replace(/\s+/g, ' ');
  if (!result) return 'Không đồng';

  // Viết hoa chữ cái đầu và thêm từ 'đồng chẵn'
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng chẵn.';
}

/**
 * Format tiền tệ VNĐ hiển thị nhanh
 */
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

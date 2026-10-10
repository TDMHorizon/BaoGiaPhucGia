import React from "react";
import {
  FiShield,
  FiCheck,
  FiX,
  FiInfo,
  FiLock,
  FiUsers,
  FiFileText,
  FiDollarSign,
  FiLayers,
} from "react-icons/fi";

interface Capability {
  category: string;
  name: string;
  code: string;
  admin: boolean;
  manager: boolean;
  user: boolean;
  note?: string;
}

const CAPABILITIES: Capability[] = [
  // Quản trị người dùng & hệ thống
  {
    category: "Quản trị Hệ thống & Người dùng (UC19, UC20)",
    name: "Tạo mới, sửa thông tin & đổi vai trò tài khoản",
    code: "USER_CRUD",
    admin: true,
    manager: false,
    user: false,
    note: "Chỉ Admin có thẩm quyền tạo và cấp role",
  },
  {
    category: "Quản trị Hệ thống & Người dùng (UC19, UC20)",
    name: "Khóa / Mở khóa tài khoản & Reset mật khẩu",
    code: "USER_LOCK_RESET",
    admin: true,
    manager: false,
    user: false,
    note: "Socket.IO cảnh báo tức thì khi tài khoản bị khóa",
  },
  {
    category: "Quản trị Hệ thống & Người dùng (UC19, UC20)",
    name: "Xem nhật ký kiểm toán hệ thống (Audit Logs)",
    code: "SYSTEM_AUDIT",
    admin: true,
    manager: false,
    user: false,
  },

  // Quản lý Báo giá & Phân công
  {
    category: "Quản lý Báo giá & Phân công (UC01, UC07)",
    name: "Tạo mới báo giá (Tải lên Excel / Báo giá trắng)",
    code: "PROJECT_CREATE",
    admin: true,
    manager: true,
    user: false,
    note: "Tạo dự án cấp công ty",
  },
  {
    category: "Quản lý Báo giá & Phân công (UC01, UC07)",
    name: "Phân công thành viên & người phụ trách chính (UC07)",
    code: "PROJECT_ASSIGN",
    admin: true,
    manager: false,
    user: false,
    note: "Admin-only; bảo vệ quyền phân bổ tổ đội",
  },
  {
    category: "Quản lý Báo giá & Phân công (UC01, UC07)",
    name: "Xóa báo giá mềm & Khôi phục từ Thùng rác (30 ngày)",
    code: "PROJECT_TRASH_RESTORE",
    admin: true,
    manager: true,
    user: false,
  },

  // Soạn thảo Excel & Cấu hình quyền (UC05, UC04)
  {
    category: "Soạn thảo Excel & Cấu hình quyền (UC05, UC04)",
    name: "Mở xem bảng tính Excel của dự án",
    code: "EXCEL_VIEW",
    admin: true,
    manager: true,
    user: true,
    note: "User chỉ mở dự án mình được phân công",
  },
  {
    category: "Soạn thảo Excel & Cấu hình quyền (UC05, UC04)",
    name: "Nhập khối lượng kỹ thuật (Khảo sát, Đo đạc, Điểm...)",
    code: "EXCEL_EDIT_TECH",
    admin: true,
    manager: false,
    user: true,
    note: "Kỹ sư nhập trong dải ô được cấp quyền",
  },
  {
    category: "Soạn thảo Excel & Cấu hình quyền (UC05, UC04)",
    name: "Sửa đơn giá, thuế VAT & chiết khấu thương mại",
    code: "EXCEL_EDIT_PRICE",
    admin: true,
    manager: true,
    user: false,
    note: "Nghiệp vụ tài chính kế toán",
  },
  {
    category: "Soạn thảo Excel & Cấu hình quyền (UC05, UC04)",
    name: "Cấu hình dải ô được phép sửa (editable_ranges)",
    code: "EXCEL_CONFIG_RANGES",
    admin: true,
    manager: false,
    user: false,
    note: "Admin cấu hình phạm vi trước khi giao việc",
  },
  {
    category: "Soạn thảo Excel & Cấu hình quyền (UC05, UC04)",
    name: "Vô hiệu hóa logic ô / dòng / cột (UC04 Tình huống 10)",
    code: "EXCEL_DISABLE_LOGICAL",
    admin: true,
    manager: false,
    user: false,
    note: "Giữ nguyên tọa độ, chặn sửa an toàn",
  },
  {
    category: "Soạn thảo Excel & Cấu hình quyền (UC05, UC04)",
    name: "Xuất file Excel tổng hợp & Tải về máy",
    code: "EXCEL_EXPORT",
    admin: true,
    manager: true,
    user: true,
  },
];

export const RolePanel: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#105CB3] border border-blue-200 shrink-0">
            3 Vai Trò Cốt Lõi
          </span>
        </div>
      </div>

      {/* Role Descriptions Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
          <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1">
            <FiLock className="h-4 w-4 text-indigo-600" />
            <span>Quản trị viên (Admin)</span>
          </div>
          <p className="text-indigo-800 text-[11px] leading-relaxed">
            Toàn quyền vận hành hệ thống, quản lý tài khoản, phân công tổ đội kỹ sư và cấu hình cấu trúc bảng tính Excel.
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 font-bold text-amber-900 mb-1">
            <FiDollarSign className="h-4 w-4 text-amber-600" />
            <span>Kế toán / Quản lý (Manager)</span>
          </div>
          <p className="text-amber-800 text-[11px] leading-relaxed">
            Theo dõi tiến độ toàn công ty, thẩm định đơn giá, chiết khấu, VAT và kiểm tra số liệu dự toán phục vụ hợp đồng.
          </p>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
          <div className="flex items-center gap-2 font-bold text-sky-900 mb-1">
            <FiUsers className="h-4 w-4 text-sky-600" />
            <span>Kỹ sư / Nhân viên (User)</span>
          </div>
          <p className="text-sky-800 text-[11px] leading-relaxed">
            Soạn thảo và nhập số lượng, khối lượng trắc địa trong phạm vi các ô được cấp quyền thuộc dự án được phân công.
          </p>
        </div>
      </div>

      {/* Capabilities Table */}
      <div className="rounded-xl border border-blue-100 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-[#F0F7FF] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#105CB3] uppercase tracking-wider">
            Bảng Tra Cứu Thẩm Quyền Chi Tiết (Role vs Capability)
          </h3>
          <span className="text-[11px] text-slate-500">Áp dụng cho toàn bộ API endpoints</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                <th className="px-4 py-3">Nhóm Nghiệp Vụ & Quyền Hạn</th>
                <th className="px-4 py-3">Mã Quyền (Code)</th>
                <th className="px-4 py-3 text-center w-28 bg-indigo-50/50 text-indigo-900">
                  Admin
                </th>
                <th className="px-4 py-3 text-center w-28 bg-amber-50/50 text-amber-900">
                  Manager (Kế toán)
                </th>
                <th className="px-4 py-3 text-center w-28 bg-sky-50/50 text-sky-900">
                  User (Nhân viên)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {CAPABILITIES.map((cap, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{cap.name}</p>
                    <p className="text-[11px] text-slate-400">{cap.category}</p>
                    {cap.note && (
                      <p className="text-[10px] text-blue-600 italic mt-0.5">{cap.note}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    {cap.code}
                  </td>
                  <td className="px-4 py-3 text-center bg-indigo-50/20">
                    {cap.admin ? (
                      <FiCheck className="h-4 w-4 mx-auto text-emerald-600 font-bold" />
                    ) : (
                      <FiX className="h-4 w-4 mx-auto text-slate-300" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center bg-amber-50/20">
                    {cap.manager ? (
                      <FiCheck className="h-4 w-4 mx-auto text-emerald-600 font-bold" />
                    ) : (
                      <FiX className="h-4 w-4 mx-auto text-slate-300" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center bg-sky-50/20">
                    {cap.user ? (
                      <FiCheck className="h-4 w-4 mx-auto text-emerald-600 font-bold" />
                    ) : (
                      <FiX className="h-4 w-4 mx-auto text-slate-300" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import {
  FiTrendingUp,
  FiAlertCircle,
  FiInfo,
  FiDollarSign,
  FiPieChart,
  FiCalendar,
  FiCheckCircle,
} from "react-icons/fi";

export const RevenuePanel: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const list = await api.getProjects();
        setProjects(list || []);
      } catch (e) {
        console.error("Failed to load revenue projects:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const total = projects.length;
  const daGui = projects.filter((p) => p.trangThai === "da_gui").length;
  const dangLam = projects.filter((p) => p.trangThai === "dang_lam").length;

  return (
    <div className="space-y-6">

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Hồ sơ Dự toán Hoàn tất
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FiCheckCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{daGui} hồ sơ</p>
          <p className="mt-1 text-[11px] text-slate-500">Đã gửi khách hàng để ký hợp đồng</p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Dự toán Đang Thẩm định
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#105CB3]">
              <FiTrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-[#105CB3]">{dangLam} hồ sơ</p>
          <p className="mt-1 text-[11px] text-slate-500">Kỹ sư đang hoàn thiện đơn giá & khối lượng</p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Doanh thu Kế toán Thực thu
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <FiDollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-sm font-bold text-slate-400 italic">Chưa có dữ liệu xác minh</p>
          <p className="mt-1 text-[11px] text-slate-400">Chờ kết nối nguồn hợp đồng kinh tế đã ký</p>
        </div>
      </div>

      {/* Verified Data Details */}
      <div className="rounded-xl border border-blue-100 bg-white p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <FiPieChart className="h-4 w-4 text-[#105CB3]" />
          <span>Danh mục Báo giá Kỹ thuật Phục vụ Quyết toán</span>
        </h3>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Đang tải dữ liệu hồ sơ...</div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
            Chưa có hồ sơ báo giá nào trong cơ sở dữ liệu
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F0F7FF] text-[#105CB3] uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Mã Báo Giá</th>
                  <th className="px-4 py-3">Tên Dự Án</th>
                  <th className="px-4 py-3">Khách Hàng / Đối Tác</th>
                  <th className="px-4 py-3">Trạng Thái Kỹ Thuật</th>
                  <th className="px-4 py-3 text-right rounded-r-lg">Ghi Chú Kế Toán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono font-semibold text-[#105CB3]">
                      {p.soBaoGia || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.khachHang || "Khách hàng vãng lai"}</td>
                    <td className="px-4 py-3">
                      {p.trangThai === "da_gui" && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          Đã gửi khách
                        </span>
                      )}
                      {p.trangThai === "dang_lam" && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-[#105CB3]">
                          Đang lập báo giá
                        </span>
                      )}
                      {p.trangThai === "nhap" && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                          Mới tạo / Nháp
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 italic">
                      Dự toán kỹ thuật
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

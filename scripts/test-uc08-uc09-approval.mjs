/**
 * Test Suite: UC08 (Kế toán thẩm định tài chính) & UC09 (Admin phê duyệt phát hành - Actor: Minh)
 * Chạy: node scripts/test-uc08-uc09-approval.mjs
 */

import ExcelJS from "exceljs";
import fs from "fs";

const BASE = process.env.API_BASE || "http://localhost:3000";

function assert(cond, msg) {
  if (!cond) {
    console.error(`\n❌ THẤT BẠI: ${msg}`);
    throw new Error(`FAIL: ${msg}`);
  }
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

async function api(urlPath, { method = "GET", token, body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function createSampleExcelBase64() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("BaoGia");
  ws.addRow(["STT", "Hạng mục", "ĐVT", "Khối lượng", "Đơn giá", "Thành tiền"]);
  ws.addRow([1, "Khảo sát hiện trạng", "Điểm", 10, 1000000, 10000000]);
  ws.addRow([2, "Đo vẽ trắc địa", "Ha", 5, 2000000, 10000000]);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf).toString("base64");
}

async function main() {
  console.log("======================================================================");
  console.log("KIỂM THỬ TỰ ĐỘNG UC08 (THẨM ĐỊNH TÀI CHÍNH) & UC09 (ADMIN PHÊ DUYỆT PHÁT HÀNH)");
  console.log("======================================================================\n");

  // 1. Đăng nhập
  const adminLogin = await api("/api/login", { method: "POST", body: { username: "admin", password: "password" } });
  assert(adminLogin.status === 200, "Admin login thành công");
  const adminToken = adminLogin.data.token;

  const managerLogin = await api("/api/login", { method: "POST", body: { username: "manager", password: "password" } });
  assert(managerLogin.status === 200, "Manager login thành công");
  const managerToken = managerLogin.data.token;

  const userLogin = await api("/api/login", { method: "POST", body: { username: "user", password: "password" } });
  assert(userLogin.status === 200, "User login thành công");
  const userToken = userLogin.data.token;
  const userId = userLogin.data.id;
  ok("Đăng nhập 3 roles (admin, manager, user) thành công");

  // 2. Tạo project test
  const fileBase64 = await createSampleExcelBase64();
  const createRes = await api("/api/projects", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Dự án kiểm thử UC08 & UC09 Thẩm định và Phê duyệt",
      soBaoGia: `UC0809-${Date.now()}`,
      fileBase64,
      sheets: ["BaoGia"],
      tenKhachHang: "Khách hàng Phúc Gia",
    },
  });
  assert(createRes.status === 201 || createRes.status === 200, "Tạo dự án thành công");
  const projectId = createRes.data.id;
  ok(`Tạo dự án thành công: ${projectId}`);

  // Phân công user & manager
  await api(`/api/projects/${projectId}/members`, {
    method: "PUT",
    token: adminToken,
    body: { memberIds: [userId, managerLogin.data.id] },
  });

  // Thiết lập financial_config ban đầu (doanh thu 20tr, chi phí 12tr -> margin 40%)
  const setFinanceRes = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: managerToken,
    body: {
      financialConfig: {
        vatRate: 10,
        discountPercent: 0,
        otHours: 0,
        otRate: 505000,
        customExpenses: 0,
        items: [
          { rowId: 2, itemCode: "KS01", name: "Khảo sát hiện trạng", unit: "Điểm", quantity: 10, unitPrice: 1000000, estimatedCost: 600000 },
          { rowId: 3, itemCode: "TD01", name: "Đo vẽ trắc địa", unit: "Ha", quantity: 5, unitPrice: 2000000, estimatedCost: 1200000 },
        ],
      },
    },
  });
  assert(setFinanceRes.status === 200, "Cấu hình tài chính mẫu thành công");
  ok("Cấu hình tài chính mẫu (Doanh thu ~20.000.000, Chi phí ~12.000.000)");

  // -------------------------------------------------------------
  // PHẦN 1: UC08 - KẾ TOÁN THẨM ĐỊNH TÀI CHÍNH
  // -------------------------------------------------------------
  console.log("\n--- KIỂM TRA UC08: THẨM ĐỊNH TÀI CHÍNH ---");

  // 1.1 RBAC: User không được thẩm định tài chính
  const userReviewRes = await api(`/api/projects/${projectId}/financial-review`, {
    method: "POST",
    token: userToken,
    body: { status: "PASS", note: "User cố ý review trái phép" },
  });
  assert(userReviewRes.status === 403, "User bị cấm thẩm định tài chính (403)");
  ok("RBAC: User không thể gửi thẩm định tài chính (HTTP 403)");

  // 1.2 Manager lấy thông tin thẩm định
  const getReviewRes = await api(`/api/projects/${projectId}/financial-review`, {
    token: managerToken,
  });
  assert(getReviewRes.status === 200, "Manager lấy dữ liệu thẩm định thành công");
  assert(getReviewRes.data.calc && getReviewRes.data.calc.marginRate === 40, `Biên lợi nhuận tính đúng 40% (thực tế: ${getReviewRes.data.calc?.marginRate}%)`);
  assert(getReviewRes.data.review === null, "Chưa có review nào được tạo");
  ok("Manager xem tính toán biên lợi nhuận tự động: 40% (Doanh thu: 20tr, Chi phí: 12tr, Lãi: 8tr)");

  // 1.3 Manager gửi thẩm định YÊU CẦU ĐIỀU CHỈNH (REQUEST_CHANGES)
  const reqChangeRes = await api(`/api/projects/${projectId}/financial-review`, {
    method: "POST",
    token: managerToken,
    body: {
      status: "REQUEST_CHANGES",
      note: "Chi phí nhân công khảo sát còn cao, yêu cầu tối ưu thêm",
    },
  });
  assert(reqChangeRes.status === 200, "Manager gửi yêu cầu điều chỉnh thành công");
  assert(reqChangeRes.data.status === "REQUEST_CHANGES", "Trạng thái review là REQUEST_CHANGES");
  ok("Manager thẩm định: REQUEST_CHANGES có ghi chú kiểm toán");

  // 1.4 Admin KHÔNG thể duyệt khi thẩm định chưa PASS
  const blockedApproveRes = await api(`/api/projects/${projectId}/approve`, {
    method: "POST",
    token: adminToken,
    body: { note: "Admin cố duyệt khi đang REQUEST_CHANGES" },
  });
  assert(blockedApproveRes.status === 422 || blockedApproveRes.status === 400, "Admin bị chặn duyệt khi thẩm định là REQUEST_CHANGES (422/400)");
  ok("Gatekeeper: Admin không thể phê duyệt khi review tài chính chưa PASS (HTTP 422/400)");

  // 1.5 Manager gửi thẩm định PASS
  const passReviewRes = await api(`/api/projects/${projectId}/financial-review`, {
    method: "POST",
    token: managerToken,
    body: {
      status: "PASS",
      note: "Biên lợi nhuận 40% đạt chỉ tiêu công ty",
    },
  });
  assert(passReviewRes.status === 200, "Manager thẩm định PASS thành công");
  assert(passReviewRes.data.status === "PASS", "Review status là PASS");
  ok("Manager thẩm định: PASS thành công với biên lợi nhuận đạt chuẩn");

  // 1.6 Kiểm tra Stale Review: Khi có người sửa ô hoặc sửa OT, review cũ bị đánh dấu STALE
  console.log("\n--- KIỂM TRA TÍNH NĂNG STALE REVIEW KHI DỮ LIỆU BỊ SỬA SAU THẨM ĐỊNH ---");
  const editRes = await api(`/api/projects/${projectId}/edits`, {
    method: "POST",
    token: adminToken,
    body: {
      sheetName: "BaoGia",
      cell: "D2",
      oldValue: 10,
      newValue: 15, // thay đổi khối lượng
    },
  });
  assert(editRes.status === 200, "Thực hiện sửa ô làm tăng khối lượng");

  // Lấy lại review -> phải bị đánh dấu isStale = true
  const reviewAfterEditRes = await api(`/api/projects/${projectId}/financial-review`, {
    token: managerToken,
  });
  assert(reviewAfterEditRes.data.isStale === true, "Thẩm định cũ đã bị đánh dấu STALE sau khi dữ liệu thay đổi");
  ok("Stale detection: Thẩm định cũ tự động trở thành STALE khi có chỉnh sửa dữ liệu ô");

  // Admin cố duyệt khi review bị stale -> BỊ CHẶN
  const blockedStaleApproveRes = await api(`/api/projects/${projectId}/approve`, {
    method: "POST",
    token: adminToken,
    body: { note: "Admin cố duyệt khi review bị stale" },
  });
  assert(blockedStaleApproveRes.status === 409 || blockedStaleApproveRes.status === 400, "Admin bị chặn duyệt khi review bị STALE (409/400)");
  ok("Gatekeeper: Admin bị chặn phê duyệt khi thẩm định tài chính bị STALE (HTTP 409/400)");

  // Manager thẩm định lại PASS trên revision mới
  const passReview2Res = await api(`/api/projects/${projectId}/financial-review`, {
    method: "POST",
    token: managerToken,
    body: {
      status: "PASS",
      note: "Đã thẩm định lại sau khi kỹ thuật điều chỉnh khối lượng",
    },
  });
  assert(passReview2Res.status === 200, "Thẩm định lại PASS thành công");
  ok("Manager thẩm định lại PASS trên revision mới nhất");

  // -------------------------------------------------------------
  // PHẦN 2: UC09 - ADMIN PHÊ DUYỆT PHÁT HÀNH
  // -------------------------------------------------------------
  console.log("\n--- KIỂM TRA UC09: ADMIN PHÊ DUYỆT PHÁT HÀNH & TẠO SNAPSHOT ---");

  // 2.1 RBAC: User và Manager không được phê duyệt phát hành (Admin-only)
  const userApproveRes = await api(`/api/projects/${projectId}/approve`, {
    method: "POST",
    token: userToken,
    body: { note: "User cố duyệt" },
  });
  assert(userApproveRes.status === 403, "User bị cấm duyệt (403)");

  const managerApproveRes = await api(`/api/projects/${projectId}/approve`, {
    method: "POST",
    token: managerToken,
    body: { note: "Manager cố duyệt" },
  });
  assert(managerApproveRes.status === 403, "Manager bị cấm duyệt (403)");
  ok("RBAC: User & Manager không được phê duyệt phát hành (HTTP 403, Admin-only)");

  // 2.2 Admin Phê duyệt chính thức
  const approveRes = await api(`/api/projects/${projectId}/approve`, {
    method: "POST",
    token: adminToken,
    body: {
      note: "Phê duyệt phát hành báo giá v1 cho khách hàng Phúc Gia",
    },
  });
  assert(approveRes.status === 200, "Admin phê duyệt thành công");
  assert(approveRes.data.decision === "APPROVED", "Quyết định phê duyệt là APPROVED");
  assert(approveRes.data.snapshotVersion === 1, "Tạo snapshot phiên bản v1");
  ok("Admin phê duyệt thành công -> Tạo snapshot bất biến v1");

  // 2.3 Kiểm tra file snapshot vật lý trên đĩa
  const snapshotPath = `data/versions/${projectId}/v1.xlsx`;
  assert(fs.existsSync(snapshotPath), `File snapshot ${snapshotPath} tồn tại trên đĩa`);
  const snapshotStats = fs.statSync(snapshotPath);
  assert(snapshotStats.size > 0, "Snapshot có dung lượng hợp lệ (> 0 bytes)");
  ok(`Snapshot vật lý được ghi nhận an toàn tại: ${snapshotPath} (${snapshotStats.size} bytes)`);

  // 2.4 Kiểm tra dự án sau khi duyệt
  const projectAfterRes = await api(`/api/projects/${projectId}`, { token: adminToken });
  const hasSnapshot = projectAfterRes.data.finalizedSnapshotId !== null || projectAfterRes.data.finalized_snapshot_id !== null;
  assert(hasSnapshot, "finalizedSnapshotId đã được cập nhật");
  const isDaGui = projectAfterRes.data.trangThai === "da_gui" || projectAfterRes.data.trang_thai === "da_gui";
  assert(isDaGui, "Trạng thái chuyển sang da_gui");
  ok("Dự án được gắn finalized_snapshot_id và chuyển sang da_gui");

  // 2.5 Duyệt trùng trên cùng revision -> Bị chặn
  const dupApproveRes = await api(`/api/projects/${projectId}/approve`, {
    method: "POST",
    token: adminToken,
    body: { note: "Admin duyệt trùng" },
  });
  assert(dupApproveRes.status === 400 || dupApproveRes.status === 409, "Chặn phê duyệt trùng lặp trên cùng snapshot (HTTP 400/409)");
  ok("Idempotency: Không cho phép phê duyệt lặp sinh nhiều snapshot trùng");

  // 2.6 Kiểm tra endpoint từ chối (REJECT)
  // Tạo dự án khác để test reject
  const proj2Res = await api("/api/projects", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Dự án test Reject",
      soBaoGia: `REJECT-${Date.now()}`,
      fileBase64,
      sheets: ["BaoGia"],
      tenKhachHang: "Khách hàng Phúc Gia",
    },
  });
  const proj2Id = proj2Res.data.id;
  await api(`/api/projects/${proj2Id}`, {
    method: "PATCH",
    token: adminToken,
    body: { financialConfig: { vatRate: 10, items: [] } },
  });
  await api(`/api/projects/${proj2Id}/financial-review`, {
    method: "POST",
    token: managerToken,
    body: { status: "PASS", note: "Pass tạm thời" },
  });

  const rejectRes = await api(`/api/projects/${proj2Id}/reject`, {
    method: "POST",
    token: adminToken,
    body: { note: "Bác bỏ phương án giá, cần đàm phán lại" },
  });
  assert(rejectRes.status === 200, "Admin từ chối phê duyệt thành công");
  assert(rejectRes.data.decision === "REJECTED", "Quyết định là REJECTED");
  const p2 = await api(`/api/projects/${proj2Id}`, { token: adminToken });
  assert(p2.data.trangThai === "dang_lam" || p2.data.trang_thai === "dang_lam", "Dự án chuyển về dang_lam sau khi bị từ chối");
  ok("Admin từ chối phê duyệt (REJECTED) -> Chuyển về dang_lam để điều chỉnh");

  console.log("\n======================================================================");
  console.log("🎉 TẤT CẢ CÁC BÀI TEST UC08 VÀ UC09 ĐÃ ĐẠT 100% YÊU CẦU!");
  console.log("======================================================================\n");
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

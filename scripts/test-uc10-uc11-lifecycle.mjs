/**
 * Test Suite: UC10 (Admin Khóa / Mở khóa báo giá) và UC11 (Vòng đời: Xóa nháp, Lưu trữ, Xóa cứng)
 * Chạy: node scripts/test-uc10-uc11-lifecycle.mjs
 */

import ExcelJS from "exceljs";

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
  ws.addRow([1, "Đo vẽ địa hình", "Ha", 5, 2000000, 10000000]);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf).toString("base64");
}

async function main() {
  console.log("======================================================================");
  console.log("KIỂM THỬ TỰ ĐỘNG UC10 (KHÓA/MỞ KHÓA) & UC11 (XÓA NHÁP, LƯU TRỮ, XÓA CỨNG)");
  console.log("======================================================================\n");

  // 1. Đăng nhập 3 roles
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
  ok("1. Đăng nhập thành công Admin, Manager, User");

  const fileBase64 = await createSampleExcelBase64();

  // ==========================================
  // PHẦN 1: UC10 - KHÓA VÀ MỞ KHÓA BÁO GIÁ
  // ==========================================
  console.log("\n--- KIỂM TRA UC10: KHÓA / MỞ KHÓA BÁO GIÁ ---");

  // 1.1 Admin tạo project và phân công user1
  const projRes = await api("/api/projects", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Dự án Kiểm thử UC10",
      fileBase64,
      sheets: ["BaoGia"],
      editableRanges: { BaoGia: "D2:D10" },
      soBaoGia: "BG-UC10-001",
      tenKhachHang: "Khách hàng UC10",
      nguoiPhuTrachId: userId,
      memberIds: [userId],
    },
  });
  assert(projRes.status === 201 || projRes.status === 200, "Admin tạo project thành công");
  const p10Id = projRes.data.id;
  ok("Admin tạo project và phân công nhân viên");

  // 1.2 Chuyển sang dang_lam
  const startRes = await api(`/api/projects/${p10Id}/status`, {
    method: "POST",
    token: userToken,
    body: { trangThai: "dang_lam" },
  });
  assert(startRes.status === 200, "User bắt đầu điền (nhap -> dang_lam)");
  ok("Chuyển trạng thái sang dang_lam");

  // 1.3 User sửa ô D2 khi đang mở -> thành công
  const edit1Res = await api(`/api/projects/${p10Id}/edits`, {
    method: "POST",
    token: userToken,
    body: { sheetName: "BaoGia", cell: "D2", newValue: "10" },
  });
  assert(edit1Res.status === 200, "User sửa ô D2 thành công khi chưa khóa");
  ok("User sửa ô hợp lệ khi chưa khóa");

  // 1.4 Admin khóa thủ công project (UC10)
  const lockRes = await api(`/api/projects/${p10Id}/lock`, {
    method: "POST",
    token: adminToken,
    body: { reason: "Bảo trì dữ liệu kiểm toán" },
  });
  assert(lockRes.status === 200, "Admin khóa project thành công");
  assert(lockRes.data.lockedManually === true, "lockedManually = true");
  ok("Admin khóa thủ công báo giá thành công");

  // 1.5 Nhân viên và Manager cố sửa ô khi bị khóa -> Bị từ chối 403
  const editLockedUser = await api(`/api/projects/${p10Id}/edits`, {
    method: "POST",
    token: userToken,
    body: { sheetName: "BaoGia", cell: "D2", newValue: "15" },
  });
  assert(editLockedUser.status === 403, "Nhân viên bị chặn 403 khi project bị khóa thủ công");

  const editLockedMgr = await api(`/api/projects/${p10Id}/edits`, {
    method: "POST",
    token: managerToken,
    body: { sheetName: "BaoGia", cell: "D2", newValue: "20" },
  });
  assert(editLockedMgr.status === 403, "Manager bị chặn 403 khi project bị khóa thủ công");

  const patchLockedUser = await api(`/api/projects/${p10Id}`, {
    method: "PATCH",
    token: userToken,
    body: { ghiChu: "Thử sửa ghi chú khi khóa" },
  });
  assert(patchLockedUser.status === 403, "Cập nhật metadata bị chặn 403 khi bị khóa");
  ok("Tất cả thao tác sửa ô / metadata của User/Manager bị chặn 403 khi project bị khóa");

  // 1.6 Admin mở khóa báo giá (UC10)
  const unlockRes = await api(`/api/projects/${p10Id}/unlock`, {
    method: "POST",
    token: adminToken,
    body: { reason: "Hoàn tất bảo trì, cho phép điền tiếp" },
  });
  assert(unlockRes.status === 200, "Admin mở khóa thành công");
  assert(unlockRes.data.lockedManually === false, "lockedManually = false");
  ok("Admin mở khóa thành công");

  // 1.7 User sửa ô sau khi mở khóa -> thành công
  const editUnlockedUser = await api(`/api/projects/${p10Id}/edits`, {
    method: "POST",
    token: userToken,
    body: { sheetName: "BaoGia", cell: "D2", newValue: "25" },
  });
  assert(editUnlockedUser.status === 200, "User sửa ô thành công sau khi Admin mở khóa");
  ok("User sửa ô bình thường sau khi mở khóa");

  // ==========================================
  // PHẦN 2: UC11 - VÒNG ĐỜI DỰ ÁN (XÓA NHÁP, LƯU TRỮ, XÓA CỨNG)
  // ==========================================
  console.log("\n--- KIỂM TRA UC11: VÒNG ĐỜI DỰ ÁN ---");

  // 2.1 User tạo bản nháp của chính mình
  const draftRes = await api("/api/projects", {
    method: "POST",
    token: userToken,
    body: {
      name: "Bản nháp của User",
      fileBase64,
      sheets: ["BaoGia"],
      soBaoGia: "BG-DRAFT-01",
    },
  });
  assert(draftRes.status === 201 || draftRes.status === 200, "User tạo bản nháp thành công");
  const draftId = draftRes.data.id;
  ok("User tạo bản nháp trạng thái nhap thành công");

  // 2.2 User xóa bản nháp của chính mình -> Thành công (soft-delete vào thùng rác)
  const delDraftRes = await api(`/api/projects/${draftId}`, {
    method: "DELETE",
    token: userToken,
  });
  assert(delDraftRes.status === 200, "User soft-delete bản nháp thành công");
  assert(delDraftRes.data.isDelete === true, "isDelete = true");
  ok("User xóa bản nháp của chính mình thành công (UC11)");

  // 2.3 User cố xóa project đang làm hoặc của người khác -> 403
  const delP10ByUser = await api(`/api/projects/${p10Id}`, {
    method: "DELETE",
    token: userToken,
  });
  assert(delP10ByUser.status === 403, "User không được xóa project đang_lam (403)");
  ok("User bị từ chối 403 khi cố xóa project không phải nháp của mình");

  // 2.4 Manager lưu trữ dự án p10 (UC11)
  const archRes = await api(`/api/projects/${p10Id}/archive`, {
    method: "POST",
    token: managerToken,
  });
  assert(archRes.status === 200, "Manager lưu trữ project thành công");
  assert(archRes.data.isArchived === true, "isArchived = true");
  ok("Manager lưu trữ báo giá (archive) thành công (UC11)");

  // 2.5 Kiểm tra project lưu trữ hiển thị trong danh sách lưu trữ
  const archListRes = await api("/api/projects/archived", {
    method: "GET",
    token: managerToken,
  });
  assert(archListRes.status === 200, "Lấy danh sách lưu trữ thành công");
  assert(archListRes.data.some((p) => p.id === p10Id), "Project p10 có trong danh sách lưu trữ");
  ok("Danh sách báo giá đã lưu trữ hiển thị chính xác");

  // 2.6 User cố truy cập project đã lưu trữ -> 403
  const userAccessArchived = await api(`/api/projects/${p10Id}`, {
    method: "GET",
    token: userToken,
  });
  assert(userAccessArchived.status === 403, "User bị chặn 403 khi truy cập hồ sơ lưu trữ");
  ok("User bị chặn khi truy cập dự án đã lưu trữ");

  // 2.7 Manager khôi phục lưu trữ (unarchive)
  const unarchRes = await api(`/api/projects/${p10Id}/unarchive`, {
    method: "POST",
    token: managerToken,
  });
  assert(unarchRes.status === 200, "Manager mở lại hồ sơ lưu trữ thành công");
  assert(unarchRes.data.isArchived === false, "isArchived = false");
  ok("Manager unarchive hồ sơ thành công");

  // 2.8 Admin xóa vĩnh viễn (hard delete) dự án draftId
  const permDelRes = await api(`/api/projects/${draftId}/permanent`, {
    method: "DELETE",
    token: adminToken,
  });
  assert(permDelRes.status === 200, "Admin xóa vĩnh viễn thành công");
  assert(permDelRes.data.ok === true, "ok = true");
  ok("Admin xóa cứng vĩnh viễn (cascade + files purge) thành công (UC11)");

  // 2.9 Sau khi xóa vĩnh viễn, truy vấn lại trả về 404
  const getPurged = await api(`/api/projects/${draftId}`, {
    method: "GET",
    token: adminToken,
  });
  assert(getPurged.status === 404, "Dự án đã xóa vĩnh viễn trả về 404 Not Found");
  ok("Dự án đã bị xóa sạch hoàn toàn khỏi DB và đĩa");

  console.log("\n======================================================================");
  console.log("✅ TẤT CẢ TEST CASES UC10 VÀ UC11 ĐÃ PASS 100%!");
  console.log("======================================================================");
}

main().catch((err) => {
  console.error("LỖI TEST UC10/UC11:", err);
  process.exit(1);
});

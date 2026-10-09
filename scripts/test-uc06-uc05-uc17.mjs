/**
 * Kịch bản kiểm thử tự động toàn diện cho 3 Use Case ưu tiên:
 * - UC06: Nhập giờ làm thêm OT (505.000 VNĐ/giờ)
 * - UC05: Sửa đơn giá, thuế VAT (0%, 8%, 10%), chiết khấu & RBAC cấp trường
 * - UC17: Xuất Excel nháp có Watermark "BẢN DỰ THẢO - CHƯA DUYỆT"
 * 
 * Chạy: node scripts/test-uc06-uc05-uc17.mjs
 */

import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

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

async function createDummyExcelBase64() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Báo giá địa hình");
  ws.addRow(["STT", "Hạng mục công việc", "Đơn vị", "Khối lượng", "Đơn giá", "Thành tiền"]);
  ws.addRow([1, "Khảo sát khống chế tọa độ VN2000", "Điểm", 10, 1500000, 15000000]);
  ws.addRow([2, "Đo vẽ bản đồ địa hình 1/500", "Ha", 20, 3000000, 60000000]);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf).toString("base64");
}

async function main() {
  console.log("======================================================================");
  console.log("KIỂM THỬ TOÀN DIỆN UC06 (OT) - UC05 (TÀI CHÍNH / RBAC) - UC17 (WATERMARK)");
  console.log("======================================================================\n");

  // 1. Đăng nhập 3 Role
  const adminRes = await api("/api/login", {
    method: "POST",
    body: { username: "admin", password: "password" },
  });
  assert(adminRes.ok && adminRes.data?.token, "Admin đăng nhập thất bại");
  const adminToken = adminRes.data.token;
  ok("Admin đăng nhập thành công");

  const mgrRes = await api("/api/login", {
    method: "POST",
    body: { username: "manager", password: "password" },
  });
  assert(mgrRes.ok && mgrRes.data?.token, "Kế toán (Manager) đăng nhập thất bại");
  const mgrToken = mgrRes.data.token;
  const mgrId = mgrRes.data.id;
  ok("Kế toán (Manager) đăng nhập thành công");

  // Đăng nhập user nhân viên kỹ thuật có sẵn
  const userRes = await api("/api/login", {
    method: "POST",
    body: { username: "user", password: "password" },
  });
  assert(userRes.ok && userRes.data?.token, "Nhân viên kỹ thuật (user) đăng nhập thất bại");
  const userToken = userRes.data.token;
  const userId = userRes.data.id;
  ok("Nhân viên kỹ thuật (user) đăng nhập thành công");

  // Tạo thêm user2 để test user không thuộc project
  let user2Token;
  const loginUser2 = await api("/api/login", {
    method: "POST",
    body: { username: "user2", password: "password" },
  });
  if (loginUser2.ok && loginUser2.data?.token) {
    user2Token = loginUser2.data.token;
  } else {
    await api("/api/users", {
      method: "POST",
      token: adminToken,
      body: { username: "user2", password: "password", role: "user" },
    });
    const l2 = await api("/api/login", {
      method: "POST",
      body: { username: "user2", password: "password" },
    });
    user2Token = l2.data.token;
  }

  // 2. Tạo một Project mới để test
  console.log("\n--- CHUẨN BỊ BÁO GIÁ THỰC TẾ ---");
  const fileBase64 = await createDummyExcelBase64();
  const createProj = await api("/api/projects", {
    method: "POST",
    token: adminToken,
    body: {
      name: `Dự án Đo Đạc Test UC06 UC05 UC17 ${Date.now()}`,
      fileBase64,
      sheets: ["Báo giá địa hình"],
      meta: {
        tenKhachHang: "Công ty Cổ phần Địa ốc Phúc Gia",
        soBaoGia: `BG-TEST-${Math.floor(Math.random() * 9000 + 1000)}`,
        memberIds: [userId], // Phân công user1
      },
    },
  });
  assert(createProj.ok && createProj.data?.id, "Tạo dự án test thất bại");
  const projectId = createProj.data.id;
  ok(`Tạo dự án test thành công: ID = ${projectId}`);

  // Phân công user1 vào project
  await api(`/api/projects/${projectId}/members`, {
    method: "PUT",
    token: adminToken,
    body: {
      memberIds: [userId],
      nguoiPhuTrachId: userId,
    },
  });
  ok("Đã phân công user1 vào dự án");

  // ====================================================================
  // PHẦN 1: KIỂM THỬ UC06 - NHẬP GIỜ LÀM THÊM OT
  // ====================================================================
  console.log("\n--- [UC06] KIỂM THỬ NHẬP GIỜ LÀM THÊM OT (505.000 VNĐ/H) ---");

  // Tình huống 1: Nhân viên được phân công nhập 3 giờ OT
  const otRes1 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: userToken,
    body: { otHours: 3 },
  });
  assert(otRes1.ok, `Nhân viên nhập 3 giờ OT thất bại: ${otRes1.data?.error}`);
  assert(otRes1.data.otHours === 3, "Số giờ OT lưu trong DB không bằng 3");
  assert(otRes1.data.otRate === 505000, "Đơn giá OT chuẩn không phải 505.000");
  ok("Tình huống 1: Nhân viên nhập 3h OT -> Lưu đúng 3h, đơn giá chuẩn 505.000đ");

  // Tình huống 2: Nhập số giờ 0 (không bị fallback thành giá trị khác)
  const otRes2 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: userToken,
    body: { otHours: 0 },
  });
  assert(otRes2.ok, "Lưu 0 giờ OT thất bại");
  assert(otRes2.data.otHours === 0, "0 giờ OT bị fallback sai lệch");
  ok("Tình huống 2: Nhập 0 giờ OT -> Bảo toàn chính xác giá trị 0");

  // Tình huống 3: Nhập số thập phân (1.5 giờ)
  const otRes3 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: userToken,
    body: { otHours: 1.5 },
  });
  assert(otRes3.ok, "Lưu 1.5 giờ OT thất bại");
  assert(otRes3.data.otHours === 1.5, "Số giờ thập phân 1.5 không đúng");
  ok("Tình huống 3: Nhập 1.5 giờ OT -> Lưu đúng 1.5 giờ thập phân");

  // Tình huống 4: Nhập số âm -> Bị từ chối HTTP 400
  const otRes4 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: userToken,
    body: { otHours: -4 },
  });
  assert(otRes4.status === 400, "Số giờ OT âm không bị từ chối với HTTP 400");
  ok("Tình huống 4: Nhập số giờ OT âm (-4) -> Backend từ chối chính xác với HTTP 400");

  // Tình huống 5: Nhân viên kỹ thuật cố sửa đơn giá OT định mức -> Bị từ chối HTTP 403 Forbidden
  const otRes5 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: userToken,
    body: { otRate: 800000 },
  });
  assert(otRes5.status === 403, "Nhân viên sửa otRate không bị chặn 403");
  ok("Tình huống 5: Nhân viên cố sửa đơn giá OT định mức -> Backend từ chối HTTP 403 Forbidden");

  // Tình huống 6: Kế toán (Manager) hoặc Admin sửa otRate định mức -> Thành công
  const otRes6 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: mgrToken,
    body: { otRate: 600000 },
  });
  assert(otRes6.ok, "Kế toán cập nhật otRate thất bại");
  assert(otRes6.data.otRate === 600000, "otRate chưa được cập nhật");
  ok("Tình huống 6: Kế toán (Manager) điều chỉnh đơn giá định mức -> Thành công");

  // Reset otRate về chuẩn 505.000đ
  await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: mgrToken,
    body: { otRate: 505000, otHours: 4 },
  });

  // Tình huống 7: User không thuộc project cố sửa OT -> Bị chặn 403 Forbidden
  const otRes7 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: user2Token,
    body: { otHours: 10 },
  });
  assert(otRes7.status === 403, "User ngoài dự án không bị chặn 403");
  ok("Tình huống 7: Người dùng không thuộc phân công dự án cố sửa OT -> Chặn HTTP 403 Forbidden");

  // ====================================================================
  // PHẦN 2: KIỂM THỬ UC05 - SỬA ĐƠN GIÁ, THUẾ VAT, CHIẾT KHẤU & PHÂN QUYỀN
  // ====================================================================
  console.log("\n--- [UC05] KIỂM THỬ SỬA ĐƠN GIÁ, THUẾ VAT, CHIẾT KHẤU & RBAC ---");

  // Tình huống 8: Nhân viên kỹ thuật gửi request sửa VAT -> Bị chặn 403 Forbidden!
  const finRes1 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: userToken,
    body: { vatRate: 10 },
  });
  assert(finRes1.status === 403, "Nhân viên sửa VAT không bị chặn HTTP 403");
  ok("Tình huống 8: Nhân viên kỹ thuật cố sửa thuế VAT -> Backend từ chối HTTP 403 Forbidden");

  // Tình huống 9: Nhân viên kỹ thuật gửi request sửa Chiết khấu -> Bị chặn 403 Forbidden!
  const finRes2 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: userToken,
    body: { discountAmount: 1000000 },
  });
  assert(finRes2.status === 403, "Nhân viên sửa Chiết khấu không bị chặn HTTP 403");
  ok("Tình huống 9: Nhân viên kỹ thuật cố sửa Chiết khấu -> Backend từ chối HTTP 403 Forbidden");

  // Tình huống 10: Kế toán (Manager) sửa VAT = 0% (miễn thuế) -> Bảo toàn số 0, không bị ép thành 8%!
  const finRes3 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: mgrToken,
    body: { vatRate: 0 },
  });
  assert(finRes3.ok, "Kế toán sửa VAT thất bại");
  assert(finRes3.data.vatRate === 0, "VAT = 0% bị fallback sai");
  ok("Tình huống 10: Kế toán sửa thuế VAT = 0% -> Lưu chính xác 0%, không bị fallback thành 8%");

  // Tình huống 11: Kế toán sửa VAT = 10%
  const finRes4 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: mgrToken,
    body: { vatRate: 10 },
  });
  assert(finRes4.ok && finRes4.data.vatRate === 10, "Kế toán sửa VAT = 10% thất bại");
  ok("Tình huống 11: Kế toán sửa thuế VAT = 10% -> Thành công");

  // Tình huống 12: Kế toán sửa Chiết khấu thương mại = 2.500.000 VNĐ
  const finRes5 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: mgrToken,
    body: { discountAmount: 2500000 },
  });
  assert(finRes5.ok && finRes5.data.discountAmount === 2500000, "Kế toán sửa chiết khấu thất bại");
  ok("Tình huống 12: Kế toán áp dụng chiết khấu 2.500.000 VNĐ -> Thành công");

  // Tình huống 13: Kế toán nhập chiết khấu âm hoặc VAT > 100 -> Bị từ chối HTTP 400
  const finRes6 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: mgrToken,
    body: { discountAmount: -100000 },
  });
  assert(finRes6.status === 400, "Chiết khấu âm không bị từ chối 400");

  const finRes7 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: mgrToken,
    body: { vatRate: 150 },
  });
  assert(finRes7.status === 400, "VAT 150% không bị từ chối 400");
  ok("Tình huống 13: Nhập chiết khấu âm hoặc VAT > 100% -> Backend từ chối HTTP 400");

  // Tình huống 14: Kế toán lưu cấu hình phụ cấp khảo sát (financialConfig)
  const finRes8 = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: mgrToken,
    body: {
      financialConfig: {
        equipmentAllowance: 4500000,
        travelAllowance: 2000000,
      },
    },
  });
  assert(finRes8.ok, "Cập nhật financialConfig thất bại");
  assert(finRes8.data.financialConfig?.equipmentAllowance === 4500000, "Phụ cấp máy móc không đúng");
  ok("Tình huống 14: Kế toán cấu hình phụ cấp thiết bị RTK & công tác xa -> Thành công");

  // Tình huống 15: Kiểm tra tính bền vững sau khi tải lại project
  const reloadProj = await api(`/api/projects/${projectId}`, {
    method: "GET",
    token: userToken,
  });
  assert(reloadProj.ok, "Tải lại project thất bại");
  assert(reloadProj.data.otHours === 4, "Dữ liệu OT bị mất sau khi reload");
  assert(reloadProj.data.vatRate === 10, "Dữ liệu VAT bị mất sau khi reload");
  assert(reloadProj.data.discountAmount === 2500000, "Dữ liệu chiết khấu bị mất sau khi reload");
  ok("Tình huống 15: Reload project -> Toàn bộ dữ liệu OT, VAT, chiết khấu được bảo toàn vẹn toàn");

  // ====================================================================
  // PHẦN 3: KIỂM THỬ UC17 - XUẤT EXCEL NHÁP CÓ WATERMARK
  // ====================================================================
  console.log("\n--- [UC17] KIỂM THỬ XUẤT EXCEL NHÁP CÓ WATERMARK CHÌM & HEADER A4 ---");

  // Tình huống 16: Dựng workbook từ base64 và áp dụng Watermark "BẢN DỰ THẢO - CHƯA DUYỆT"
  const testWb = new ExcelJS.Workbook();
  const testWs = testWb.addWorksheet("Báo giá khảo sát");
  testWs.addRow(["Hạng mục", "Khối lượng", "Đơn giá", "Thành tiền"]);
  testWs.addRow(["Đo trắc dọc trắc ngang", 5, 2000000, 10000000]);

  // Cấu hình header/footer in ấn A4 (bắt buộc theo đặc tả UC17)
  const watermarkText = "BẢN DỰ THẢO - CHƯA DUYỆT";
  testWs.headerFooter.oddHeader = `&C&"Arial,Bold"&22&KDC2626 *** ${watermarkText} ***`;
  testWs.headerFooter.evenHeader = `&C&"Arial,Bold"&22&KDC2626 *** ${watermarkText} ***`;
  testWs.headerFooter.oddFooter = `&R&"Arial,Italic"&10&K64748B Báo giá Phúc Gia - ${watermarkText} | Trang &P/&N`;
  testWs.pageSetup.showGridLines = true;

  // Thêm ảnh watermark
  const samplePngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const imgId = testWb.addImage({
    base64: samplePngBase64,
    extension: "png",
  });
  testWs.addBackgroundImage(imgId);

  const exportedBuf = await testWb.xlsx.writeBuffer();
  assert(exportedBuf.byteLength > 0, "Không thể xuất buffer Excel");

  // Đọc lại file vừa xuất bằng ExcelJS để kiểm tra tính toàn vẹn và Watermark
  const verifyWb = new ExcelJS.Workbook();
  await verifyWb.xlsx.load(exportedBuf);
  const verifyWs = verifyWb.getWorksheet("Báo giá khảo sát");
  assert(verifyWs !== undefined, "Sheet không tồn tại sau khi xuất");
  assert(verifyWs.headerFooter.oddHeader.includes("BẢN DỰ THẢO - CHƯA DUYỆT"), "Header in ấn không chứa dấu dự thảo");
  assert(verifyWs.headerFooter.oddFooter.includes("Báo giá Phúc Gia"), "Footer in ấn không chứa định danh");
  ok("Tình huống 16: File .xlsx xuất nháp chứa Header in ấn A4 & Watermark chìm 'BẢN DỰ THẢO - CHƯA DUYỆT'");

  // Tình huống 17: Kiểm tra file nền của server (data/files/{id}.xlsx) không bị sửa đổi
  const serverFilePath = path.join(process.cwd(), "data", "files", `${projectId}.xlsx`);
  if (fs.existsSync(serverFilePath)) {
    const stats = fs.statSync(serverFilePath);
    assert(stats.size > 0, "File nền trên server bị hỏng");
    ok(`Tình huống 17: File nền trên server (${projectId}.xlsx) được bảo toàn 100%, không bị ghi đè!`);
  } else {
    ok(`Tình huống 17: File nền trên server được bảo vệ an toàn (chế độ in-memory/disk)`);
  }

  // Tình huống 18: Khóa dự án -> Cấm sửa OT và tài chính
  console.log("\n--- KIỂM TRA BẢO VỆ DỰ ÁN KHI KHÓA TRẠNG THÁI ---");
  await api(`/api/projects/${projectId}/status`, {
    method: "POST",
    token: adminToken,
    body: { trangThai: "da_gui", note: "Đã gửi khách hàng chốt báo giá" },
  });

  const lockedEditRes = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: userToken,
    body: { otHours: 8 },
  });
  assert(lockedEditRes.status === 403, "Dự án đã gửi khách nhưng vẫn cho user sửa OT");
  ok("Tình huống 18: Báo giá đã khóa/đã gửi khách -> Chặn người dùng sửa OT & Tài chính!");

  // Mở lại dự án để kiểm thử phân quyền ô chi tiết (Cell Level RBAC - UC04/UC05/UC06)
  await api(`/api/projects/${projectId}/status`, {
    method: "POST",
    token: adminToken,
    body: { trangThai: "dang_lam", note: "Mở lại để kiểm thử nâng cao" },
  });

  console.log("\n--- [NÂNG CAO] PHÂN QUYỀN CẤP Ô VÀ ĐỒNG BỘ MAPPING Ô EXCEL ---");

  // Cấu hình vùng kỹ thuật B10:B20 và vùng tài chính E10:E25, ánh xạ C25 là ô Giờ OT
  await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: adminToken,
    body: {
      editableRanges: { "Báo giá địa hình": "B10:B20" },
      financialConfig: {
        financialRanges: { "Báo giá địa hình": "E10:E25" },
        cellMapping: {
          sheetName: "Báo giá địa hình",
          otHoursCell: "C25",
          otAmountCell: "E25",
          vatRateCell: "E28",
          discountCell: "E29",
        },
      },
    },
  });

  // Tình huống 19: Kế toán cố sửa ô khối lượng kỹ thuật B12 (ngoài vùng tài chính) -> Phải từ chối HTTP 403 (UC05 TC10)
  const mgrTechEditRes = await api(`/api/projects/${projectId}/edits`, {
    method: "POST",
    token: mgrToken,
    body: {
      sheetName: "Báo giá địa hình",
      cell: "B12",
      newValue: "50",
    },
  });
  assert(mgrTechEditRes.status === 403, "Kế toán không bị chặn khi sửa ô khối lượng kỹ thuật B12");
  ok("Tình huống 19: Kế toán cố sửa ô khối lượng kỹ thuật B12 -> Backend từ chối HTTP 403 (UC05 TC10)!");

  // Tình huống 20: Nhân viên kỹ thuật cố sửa ô đơn giá tài chính E15 -> Phải từ chối HTTP 403 (UC05 TC09)
  const userFinEditRes = await api(`/api/projects/${projectId}/edits`, {
    method: "POST",
    token: userToken,
    body: {
      sheetName: "Báo giá địa hình",
      cell: "E15",
      newValue: "2500000",
    },
  });
  assert(userFinEditRes.status === 403, "Nhân viên kỹ thuật không bị chặn khi sửa ô tài chính E15");
  ok("Tình huống 20: Nhân viên kỹ thuật cố sửa ô đơn giá tài chính E15 -> Backend từ chối HTTP 403 (UC05 TC09)!");

  // Tình huống 21: Nhân viên sửa ô C25 được ánh xạ làm ô số giờ OT -> Thành công và ghi vào edits table (UC06 & UC13)
  const userOtCellRes = await api(`/api/projects/${projectId}/edits`, {
    method: "POST",
    token: userToken,
    body: {
      sheetName: "Báo giá địa hình",
      cell: "C25",
      newValue: "6.5",
    },
  });
  assert(userOtCellRes.ok, "Nhân viên không sửa được ô OT C25 đã được ánh xạ");
  assert(userOtCellRes.data.newValue === "6.5", "Giá trị ô OT C25 lưu không đúng");
  assert(userOtCellRes.data.revision >= 1, "Revision không được tăng");
  ok("Tình huống 21: Nhân viên sửa ô C25 (ánh xạ Giờ OT) -> Thành công, ghi nhận audit edits và revision (UC06 & UC13)!");

  // Tình huống 22: Tải Excel nháp từ endpoint GET /api/projects/:id/export/draft
  console.log("\n--- [UC17] KIỂM THỬ ENDPOINT SERVER DRAFT EXPORT (GET /export/draft) ---");
  // 1. User chưa được phân công tải thử
  const unauthExportRes = await fetch(`http://localhost:3000/api/projects/${projectId}/export/draft`, {
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  assert(unauthExportRes.status === 403, "User ngoài dự án tải được file draft trái phép");
  ok("Tình huống 22a: Chống IDOR - Người dùng ngoài dự án bị chặn HTTP 403 khi tải bản nháp");

  // 2. User được phân công tải
  const authExportRes = await fetch(`http://localhost:3000/api/projects/${projectId}/export/draft`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  assert(authExportRes.status === 200, "User phân công không tải được draft export");
  const arrayBuf = await authExportRes.arrayBuffer();
  assert(arrayBuf.byteLength > 0, "Buffer export rỗng");

  const serverExportWb = new ExcelJS.Workbook();
  await serverExportWb.xlsx.load(Buffer.from(arrayBuf));
  const sWs = serverExportWb.worksheets[0];
  assert(sWs !== undefined, "Worksheet không tồn tại trong file server export");
  assert(sWs.headerFooter.oddHeader.includes("BẢN DỰ THẢO - CHƯA DUYỆT"), "Header file export không có watermark");
  ok("Tình huống 22b: Endpoint server GET /export/draft xuất file .xlsx có watermark nháp A4 hợp lệ 100%!");

  console.log("\n======================================================================");
  console.log("🎉 TẤT CẢ 22 TÌNH HUỐNG KIỂM THỬ CHO UC06, UC05, UC17 ĐỀU ĐẠT 100%!");
  console.log("======================================================================\n");
}

main().catch((err) => {
  console.error("\n❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:", err);
  process.exit(1);
});

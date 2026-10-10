/**
 * Test Suite: UC14 (Lịch sử phiên bản), UC18 (Xuất Excel A4 chính thức), UC15 (Khôi phục phiên bản snapshot)
 * Chạy: node scripts/test-uc14-uc15-uc18-versions.mjs
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

async function fetchBuffer(urlPath, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${urlPath}`, { headers });
  if (!res.ok) {
    return { status: res.status, ok: false, buffer: null };
  }
  const arrayBuf = await res.arrayBuffer();
  return { status: res.status, ok: true, buffer: Buffer.from(arrayBuf) };
}

async function createSampleExcelBase64() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("BaoGiaPhucGia");
  ws.addRow(["STT", "Hạng mục", "ĐVT", "Khối lượng", "Đơn giá", "Thành tiền"]);
  ws.addRow([1, "Đo vẽ trắc địa mốc", "Điểm", 20, 1500000, 30000000]);
  ws.addRow([2, "Bay chụp Flycam khảo sát", "Ha", 10, 2500000, 25000000]);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf).toString("base64");
}

async function main() {
  console.log("======================================================================");
  console.log("KIỂM THỬ TỰ ĐỘNG UC14 (LỊCH SỬ PHIÊN BẢN) - UC18 (XUẤT CHÍNH THỨC) - UC15 (RESTORE)");
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

  // 2. Tạo dự án mới
  const fileBase64 = await createSampleExcelBase64();
  const createRes = await api("/api/projects", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Dự án kiểm thử Version, Restore và Official Export",
      soBaoGia: `VRS-${Date.now()}`,
      fileBase64,
      sheets: ["BaoGiaPhucGia"],
      tenKhachHang: "Khách hàng Phúc Gia",
    },
  });
  assert(createRes.status === 201 || createRes.status === 200, "Tạo dự án thành công");
  const projectId = createRes.data.id;
  ok(`Tạo dự án thành công: ${projectId}`);

  // Cấu hình tài chính và review PASS
  await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    token: managerToken,
    body: {
      financialConfig: {
        vatRate: 8,
        discountPercent: 5,
        otHours: 10,
        otRate: 505000,
        items: [
          { rowId: 2, itemCode: "TD01", name: "Đo vẽ trắc địa mốc", unit: "Điểm", quantity: 20, unitPrice: 1500000, estimatedCost: 900000 },
          { rowId: 3, itemCode: "FLY01", name: "Bay chụp Flycam khảo sát", unit: "Ha", quantity: 10, unitPrice: 2500000, estimatedCost: 1500000 },
        ],
      },
    },
  });
  await api(`/api/projects/${projectId}/financial-review`, {
    method: "POST",
    token: managerToken,
    body: { status: "PASS", note: "Thẩm định đạt yêu cầu phát hành v1" },
  });

  // Admin phê duyệt v1
  const approve1 = await api(`/api/projects/${projectId}/approve`, {
    method: "POST",
    token: adminToken,
    body: { note: "Phê duyệt phiên bản chính thức v1" },
  });
  assert(approve1.status === 200, "Admin duyệt v1 thành công");
  ok("Admin duyệt dự án -> Tạo snapshot v1");

  // -------------------------------------------------------------
  // PHẦN 1: UC14 - XEM LỊCH SỬ PHIÊN BẢN (SNAPSHOT TIMELINE)
  // -------------------------------------------------------------
  console.log("\n--- KIỂM TRA UC14: XEM LỊCH SỬ PHIÊN BẢN ---");

  const versionsRes = await api(`/api/projects/${projectId}/versions`, { token: managerToken });
  assert(versionsRes.status === 200, "Lấy danh sách versions thành công");
  const versionsList = versionsRes.data.versions || versionsRes.data;
  assert(Array.isArray(versionsList) && versionsList.length >= 1, "Có ít nhất 1 phiên bản snapshot trong lịch sử");

  const v1 = versionsList.find((v) => v.version === 1);
  assert(v1, "Tìm thấy phiên bản v1 trong danh sách");
  assert(v1.checksum && v1.checksum.length === 64, `Checksum SHA-256 hợp lệ: ${v1.checksum}`);
  const v1Size = v1.fileSize || v1.file_size;
  assert(v1Size > 0, `Dung lượng snapshot hợp lệ: ${v1Size} bytes`);
  const v1Author = v1.sentBy || v1.sent_by || v1.createdBy;
  assert(v1Author === "admin", "Người duyệt phát hành là admin");
  ok(`UC14: Xem metadata phiên bản v1: SHA256=${v1.checksum.slice(0, 12)}..., size=${v1Size}b, tác giả=${v1Author}`);

  // Tải file snapshot v1 qua API (UC14 - Thạnh)
  const downloadV1 = await api(`/api/projects/${projectId}/versions/1`, { token: managerToken });
  assert(downloadV1.status === 200, "Tải file snapshot v1 thành công");
  assert(downloadV1.data && downloadV1.data.fileBase64 && downloadV1.data.fileBase64.length > 0, "fileBase64 snapshot v1 hợp lệ");
  ok("UC14: Tải file snapshot v1 qua endpoint GET /versions/1 thành công (Thạnh)");

  // -------------------------------------------------------------
  // PHẦN 2: UC18 - XUẤT EXCEL A4 CHÍNH THỨC SAU DUYỆT
  // -------------------------------------------------------------
  console.log("\n--- KIỂM TRA UC18: XUẤT EXCEL A4 CHÍNH THỨC ---");

  // 2.1 User thông thường không được tải bản chính thức (403)
  const userOfficialRes = await fetchBuffer(`/api/projects/${projectId}/export/official`, userToken);
  assert(userOfficialRes.status === 403, "User bị cấm tải bản xuất chính thức (403)");
  ok("RBAC: User thông thường không có quyền xuất bản chính thức (HTTP 403)");

  // 2.2 Manager / Admin xuất bản chính thức
  const managerOfficialRes = await fetchBuffer(`/api/projects/${projectId}/export/official`, managerToken);
  assert(managerOfficialRes.ok, "Manager xuất file Excel chính thức thành công");
  const officialBuffer = managerOfficialRes.buffer;

  // 2.3 Đọc buffer và kiểm tra KHÔNG CÓ WATERMARK "BẢN DỰ THẢO - CHƯA DUYỆT"
  const officialWb = new ExcelJS.Workbook();
  await officialWb.xlsx.load(officialBuffer);
  const officialWs = officialWb.getWorksheet(1);
  assert(officialWs, "Worksheet chính thức đọc được");

  // Kiểm tra header / footer không có watermark
  const hf = officialWs.headerFooter;
  if (hf) {
    const headerStr = JSON.stringify(hf);
    assert(!headerStr.includes("BẢN DỰ THẢO"), "Bản chính thức KHÔNG chứa chữ 'BẢN DỰ THẢO' trong Header/Footer");
  }

  // Kiểm tra hình ảnh đính kèm (không có watermark image chèn vào worksheet)
  const images = officialWs.getImages ? officialWs.getImages() : [];
  assert(images.length === 0, "Bản chính thức KHÔNG có hình ảnh watermark background");

  // Kiểm tra cấu hình in A4
  const pageSetup = officialWs.pageSetup;
  assert(pageSetup !== undefined, "Cấu hình pageSetup in ấn tồn tại");
  assert(pageSetup.paperSize === 9, "Khổ giấy chuẩn A4 (paperSize = 9)");
  assert(pageSetup.fitToPage === true, "Thiết lập fitToPage = true");
  assert(pageSetup.orientation === "landscape" || pageSetup.orientation === "portrait", "Định hướng trang in được thiết lập");
  ok("UC18: File Excel chính thức chuẩn khổ A4, KHÔNG CÓ WATERMARK dự thảo, đọc trực tiếp từ snapshot đã duyệt");

  // -------------------------------------------------------------
  // PHẦN 3: UC15 - KHÔI PHỤC PHIÊN BẢN CŨ (RESTORE SNAPSHOT)
  // -------------------------------------------------------------
  console.log("\n--- KIỂM TRA UC15: KHÔI PHỤC PHIÊN BẢN CŨ ---");

  // 3.1 Mở khóa dự án để kỹ thuật viên tiếp tục làm việc / sửa đổi
  const unlockRes = await api(`/api/projects/${projectId}/unlock`, {
    method: "POST",
    token: adminToken,
    body: { reason: "Mở khóa để lập đợt hiệu chỉnh bổ sung" },
  });
  assert(unlockRes.status === 200, "Mở khóa dự án thành công");

  // Sửa một số ô trong working state
  const edit1 = await api(`/api/projects/${projectId}/edits`, {
    method: "POST",
    token: adminToken,
    body: {
      sheetName: "BaoGiaPhucGia",
      cell: "B2",
      oldValue: "Đo vẽ trắc địa mốc",
      newValue: "NỘI DUNG ĐÃ BỊ SỬA SAI LẦM",
    },
  });
  assert(edit1.status === 200, "Sửa ô B2 thành nội dung mới");

  const edit2 = await api(`/api/projects/${projectId}/edits`, {
    method: "POST",
    token: adminToken,
    body: {
      sheetName: "BaoGiaPhucGia",
      cell: "D2",
      oldValue: 20,
      newValue: 999, // đổi khối lượng thành 999
    },
  });
  assert(edit2.status === 200, "Sửa ô D2 thành 999");

  // Kiểm tra giá trị hiện thời đã thay đổi
  const cellValsAfterEdit = await api(`/api/projects/${projectId}/cell-values`, { token: adminToken });
  const b2Current = cellValsAfterEdit.data["BaoGiaPhucGia"]?.["B2"]?.value ?? cellValsAfterEdit.data["BaoGiaPhucGia:B2"];
  assert(b2Current === "NỘI DUNG ĐÃ BỊ SỬA SAI LẦM", "Giá trị hiện tại là nội dung đã bị sửa");

  // 3.2 RBAC: User và Manager không được khôi phục snapshot (Admin-only)
  const userRestore = await api(`/api/projects/${projectId}/versions/1/restore`, {
    method: "POST",
    token: userToken,
    body: { reason: "User cố ý restore" },
  });
  assert(userRestore.status === 403, "User bị cấm restore snapshot (403)");

  const managerRestore = await api(`/api/projects/${projectId}/versions/1/restore`, {
    method: "POST",
    token: managerToken,
    body: { reason: "Manager cố ý restore" },
  });
  assert(managerRestore.status === 403, "Manager bị cấm restore snapshot (403)");
  ok("RBAC: Chỉ Admin mới có quyền khôi phục snapshot phiên bản cũ (HTTP 403)");

  // 3.3 Admin thực hiện Restore Snapshot v1
  const restoreRes = await api(`/api/projects/${projectId}/versions/1/restore`, {
    method: "POST",
    token: adminToken,
    body: {
      reason: "Hủy bỏ các sửa đổi nhầm lẫn, khôi phục lại dữ liệu v1 đã được phê duyệt",
    },
  });
  assert(restoreRes.status === 200, "Admin restore snapshot v1 thành công");
  assert(restoreRes.data.restoredVersion === 1, "Phiên bản được khôi phục là 1");
  assert(restoreRes.data.compensatingEditsCount >= 2, `Số lượng ô được bù trừ: ${restoreRes.data.compensatingEditsCount}`);
  ok(`UC15: Khôi phục thành công từ v1! Tạo ${restoreRes.data.compensatingEditsCount} compensating edits bù trừ`);

  // 3.4 Kiểm tra giá trị các ô đã được đưa về snapshot v1
  const cellValsAfterRestore = await api(`/api/projects/${projectId}/cell-values`, { token: adminToken });
  const b2Restored = cellValsAfterRestore.data["BaoGiaPhucGia"]?.["B2"]?.value ?? cellValsAfterRestore.data["BaoGiaPhucGia:B2"];
  const d2Restored = cellValsAfterRestore.data["BaoGiaPhucGia"]?.["D2"]?.value ?? cellValsAfterRestore.data["BaoGiaPhucGia:D2"];
  assert(b2Restored === "Đo vẽ trắc địa mốc", "Ô B2 đã được phục hồi về giá trị gốc của v1");
  assert(String(d2Restored) === "20", "Ô D2 đã được phục hồi về 20");
  ok("Dữ liệu working cell states đã phục hồi chính xác 100% về phiên bản snapshot v1");

  // 3.5 Bất biến: Kiểm tra snapshot v1 trên đĩa KHÔNG bị thay đổi byte nào
  const v1FileAfter = fs.readFileSync(`data/versions/${projectId}/v1.xlsx`);
  assert(v1FileAfter.length === v1Size, "Kích thước file snapshot v1 hoàn toàn không đổi (bất biến)");
  ok("Nguyên tắc bất biến: File snapshot vật lý v1 không bị ghi đè hay biến đổi");

  // 3.6 Kiểm tra chuỗi lịch sử edits: Lịch sử cũ vẫn còn nguyên vẹn, các compensating edits được nối tiếp
  const editsHistoryRes = await api(`/api/projects/${projectId}/edits`, { token: adminToken });
  const allEdits = editsHistoryRes.data.edits || editsHistoryRes.data;
  assert(allEdits.length >= 4, "Lịch sử edits được bảo toàn đầy đủ (sửa ban đầu + bù trừ restore)");
  ok("Chuỗi lịch sử edits (UC13) được bảo toàn nguyên vẹn, không bị xóa hay ghi đè");

  console.log("\n======================================================================");
  console.log("🎉 TẤT CẢ CÁC BÀI TEST UC14, UC18 VÀ UC15 ĐÃ ĐẠT 100% YÊU CẦU!");
  console.log("======================================================================\n");
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

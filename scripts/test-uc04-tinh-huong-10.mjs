import assert from "assert";
import { io } from "socket.io-client";

const BASE_URL = "http://localhost:3000";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTest() {
  console.log("=== BẮT ĐẦU KIỂM THỬ UC04 - TÌNH HUỐNG 10 (LOGICAL DELETION / CELL-RANGE DEACTIVATION) ===");

  // 1. Đăng nhập Admin
  console.log("1. Đăng nhập Admin...");
  const adminLogin = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "password" }),
  });
  assert.strictEqual(adminLogin.status, 200, "Admin login phải thành công");
  const adminToken = adminLogin.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 2. Tạo hoặc lấy tài khoản User (Nhân viên)
  console.log("2. Chuẩn bị tài khoản nhân viên user_uc04...");
  const empUsername = `emp_uc04_${Date.now()}`;
  const empPassword = "password123";
  const createEmp = await request("/api/users", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ username: empUsername, password: empPassword, role: "user" }),
  });
  assert.strictEqual(createEmp.status, 200, "Tạo tài khoản nhân viên phải thành công");
  const empId = createEmp.data.id;

  const empLogin = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ username: empUsername, password: empPassword }),
  });
  assert.strictEqual(empLogin.status, 200, "Nhân viên login phải thành công");
  const empToken = empLogin.data.token;
  const empHeaders = { Authorization: `Bearer ${empToken}` };

  // 3. Admin tạo project kiểm thử UC04
  console.log("3. Admin tạo project kiểm thử...");
  const createProj = await request("/api/projects", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: `Test UC04 T10 ${Date.now()}`,
      mode: "blank",
      sheets: ["BaoGia"],
      soBaoGia: "BG-UC04-001",
      tenKhachHang: "Khách hàng Test UC04",
    }),
  });
  assert.strictEqual(createProj.status, 200, "Tạo project phải thành công");
  const projectId = createProj.data.id;

  // 4. Phân công nhân viên vào project với editableRanges
  console.log("4. Phân công nhân viên vào project với range D1:F50...");
  await request(`/api/projects/${projectId}/members`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ memberIds: [empId], nguoiPhuTrachId: empId }),
  });
  await request(`/api/projects/${projectId}/ranges`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ editableRanges: { BaoGia: "D1:F50" } }),
  });
  await request(`/api/projects/${projectId}/status`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ trangThai: "dang_lam" }),
  });

  // 5. Kết nối Socket.IO để kiểm tra phát sự kiện realtime
  console.log("5. Kết nối Socket.IO kiểm tra broadcast realtime...");
  const socket = io(BASE_URL, {
    transports: ["websocket"],
    auth: { token: adminToken },
  });

  const receivedEvents = [];
  await new Promise((resolve) => {
    socket.on("connect", () => {
      socket.emit("join_project", projectId);
      // Đợi ngắn để socket server xử lý join room
      setTimeout(resolve, 50);
    });
  });

  socket.on("range.disabled", (evt) => {
    receivedEvents.push({ event: "range.disabled", evt });
  });
  socket.on("range.enabled", (evt) => {
    receivedEvents.push({ event: "range.enabled", evt });
  });

  // 6. Nhân viên sửa ô D20 trước khi có vô hiệu hóa
  console.log("6. Nhân viên sửa ô D20 thành 2,000,000...");
  const editD20_1 = await request(`/api/projects/${projectId}/edits`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      cell: "D20",
      newValue: "2000000",
      expectedRevision: 0,
    }),
  });
  assert.strictEqual(editD20_1.status, 200, "Sửa D20 ban đầu phải thành công");
  assert.strictEqual(editD20_1.data.revision, 1, "Revision phải là 1");

  // 7. TÌNH HUỐNG 1: Admin vô hiệu hóa dòng 10 -> ô D20 không bị thay đổi tọa độ
  console.log("7. Tình huống 1: Admin vô hiệu hóa dòng 10 (Logical Deletion)...");
  const disableRow10 = await request(`/api/projects/${projectId}/disable-range`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      type: "ROW",
      target: 10,
    }),
  });
  assert.strictEqual(disableRow10.status, 200, "Disable dòng 10 phải thành công");
  assert.ok(disableRow10.data.disabledRanges.BaoGia.rows.includes(10), "Config phải có rows [10]");

  // Nhân viên tiếp tục sửa ô D20 -> Vẫn là D20, không thành D19, sửa bình thường!
  console.log("   -> Nhân viên sửa tiếp ô D20 thành 2,500,000 (tọa độ không bị lệch)...");
  const editD20_2 = await request(`/api/projects/${projectId}/edits`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      cell: "D20",
      newValue: "2500000",
      expectedRevision: 1,
    }),
  });
  assert.strictEqual(editD20_2.status, 200, "Nhân viên phải sửa được D20 bình thường!");
  assert.strictEqual(editD20_2.data.newValue, "2500000");

  // 8. TÌNH HUỐNG 5 & 6: Nhân viên cố sửa ô D10 (thuộc dòng 10 đã bị vô hiệu hóa)
  console.log("8. Tình huống 5 & 6: Nhân viên cố sửa ô D10 nằm trong dòng 10 đã bị vô hiệu hóa...");
  const editD10 = await request(`/api/projects/${projectId}/edits`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      cell: "D10",
      newValue: "Giá trị sai",
      expectedRevision: 0,
    }),
  });
  assert.strictEqual(editD10.status, 403, "Backend phải từ chối HTTP 403");
  assert.strictEqual(editD10.data.code, "CELL_DISABLED", "Mã lỗi phải là CELL_DISABLED");
  console.log("   -> Backend đã từ chối an toàn với 403 CELL_DISABLED:", editD10.data.error);

  // 9. TÌNH HUỐNG 3 & 7: Admin vô hiệu hóa cột E
  console.log("9. Tình huống 3 & 7: Admin vô hiệu hóa cột E...");
  const disableColE = await request(`/api/projects/${projectId}/disable-range`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      type: "COLUMN",
      target: "E",
    }),
  });
  assert.strictEqual(disableColE.status, 200, "Disable cột E phải thành công");
  assert.ok(disableColE.data.disabledRanges.BaoGia.columns.includes("E"));

  // Nhân viên sửa ô F20 (cột F không bị ảnh hưởng) -> Thành công
  console.log("   -> Nhân viên sửa ô F20 (cột F) không bị ảnh hưởng...");
  const editF20 = await request(`/api/projects/${projectId}/edits`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      cell: "F20",
      newValue: "500000",
      expectedRevision: 0,
    }),
  });
  assert.strictEqual(editF20.status, 200, "Sửa F20 phải thành công");

  // Nhân viên cố sửa ô E15 (nằm trong cột E) -> Backend từ chối 403 CELL_DISABLED
  console.log("   -> Nhân viên cố sửa ô E15 trong cột E...");
  const editE15 = await request(`/api/projects/${projectId}/edits`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      cell: "E15",
      newValue: "Không được sửa",
      expectedRevision: 0,
    }),
  });
  assert.strictEqual(editE15.status, 403, "Backend phải từ chối HTTP 403");
  assert.strictEqual(editE15.data.code, "CELL_DISABLED");

  // 10. Kiểm tra API Batch Edits: nếu batch chứa ô bị disabled -> Từ chối cả batch
  console.log("10. Kiểm tra Batch Edit chứa ô trong cột E đã bị vô hiệu hóa...");
  const batchEdit = await request(`/api/projects/${projectId}/edits/batch`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      edits: [
        { sheetName: "BaoGia", cell: "D21", newValue: "Hợp lệ" },
        { sheetName: "BaoGia", cell: "E15", newValue: "Không hợp lệ vì bị disabled" },
      ],
    }),
  });
  assert.strictEqual(batchEdit.status, 403, "Batch edit phải bị từ chối cả batch 403");
  assert.strictEqual(batchEdit.data.code, "CELL_DISABLED");
  console.log("   -> Backend đã bảo vệ an toàn batch edit:", batchEdit.data.error);

  // 11. TÌNH HUỐNG 9: Admin khôi phục (enable-range) cột E
  console.log("11. Tình huống 9: Admin khôi phục cột E...");
  const enableColE = await request(`/api/projects/${projectId}/enable-range`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      type: "COLUMN",
      target: "E",
    }),
  });
  assert.strictEqual(enableColE.status, 200, "Khôi phục cột E phải thành công");
  assert.ok(!enableColE.data.disabledRanges.BaoGia.columns.includes("E"), "Cột E không còn trong danh sách disabled");

  // Nhân viên sửa lại ô E15 -> Thành công!
  console.log("   -> Nhân viên sửa lại ô E15 sau khi Admin khôi phục...");
  const editE15After = await request(`/api/projects/${projectId}/edits`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      cell: "E15",
      newValue: "Đã sửa thành công sau khôi phục",
      expectedRevision: 0,
    }),
  });
  assert.strictEqual(editE15After.status, 200, "Sửa E15 sau khi khôi phục phải thành công!");
  assert.strictEqual(editE15After.data.newValue, "Đã sửa thành công sau khôi phục");

  // 12. TÌNH HUỐNG: Vô hiệu hóa một ô đơn lẻ (CELL)
  console.log("12. Kiểm tra vô hiệu hóa ô đơn lẻ F15...");
  const disableF15 = await request(`/api/projects/${projectId}/disable-range`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      type: "CELL",
      target: "F15",
    }),
  });
  assert.strictEqual(disableF15.status, 200);
  assert.ok(disableF15.data.disabledRanges.BaoGia.cells.includes("F15"));

  const editF15 = await request(`/api/projects/${projectId}/edits`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      cell: "F15",
      newValue: "Thử sửa F15",
      expectedRevision: 0,
    }),
  });
  assert.strictEqual(editF15.status, 403);
  assert.strictEqual(editF15.data.code, "CELL_DISABLED");

  // 13. Kiểm tra phân quyền: Nhân viên không thể gọi disable-range / enable-range
  console.log("13. Kiểm tra phân quyền: Nhân viên thử gọi disable-range...");
  const empTryDisable = await request(`/api/projects/${projectId}/disable-range`, {
    method: "POST",
    headers: empHeaders,
    body: JSON.stringify({
      sheetName: "BaoGia",
      type: "ROW",
      target: 20,
    }),
  });
  assert.strictEqual(empTryDisable.status, 403, "Nhân viên gọi disable-range phải bị từ chối 403");

  // 14. Kiểm tra Socket.IO đã nhận được các sự kiện range.disabled và range.enabled
  console.log("14. Kiểm tra sự kiện realtime Socket.IO đã nhận được...");
  assert.ok(receivedEvents.length >= 3, `Phải nhận ít nhất 3 sự kiện socket (nhận được: ${receivedEvents.length})`);
  console.log(`   -> Đã nhận được ${receivedEvents.length} events Socket.IO realtime thành công!`);

  socket.disconnect();

  console.log("\n>>> TẤT CẢ 14 BƯỚC KIỂM THỬ UC04 - TÌNH HUỐNG 10 ĐÃ ĐẠT 100% THÀNH CÔNG! <<<\n");
}

runTest().catch((err) => {
  console.error("Test thất bại:", err);
  process.exit(1);
});

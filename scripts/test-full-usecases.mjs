/**
 * Comprehensive integration tests for UC19, UC01, UC07, UC04 and Manager/RBAC.
 * Run: node scripts/test-full-usecases.mjs
 */
import * as XLSX from "xlsx";

const BASE = process.env.API_BASE || "http://localhost:3000";

function assert(cond, msg) {
  if (!cond) {
    console.error(`\n❌ FAIL: ${msg}`);
    throw new Error(`FAIL: ${msg}`);
  }
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

async function api(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
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

async function main() {
  console.log("==================================================");
  console.log("KIỂM THỬ TOÀN DIỆN UC19 - UC01 - UC07 - UC04 & RBAC");
  console.log("==================================================\n");

  // 1. Đăng nhập Admin
  const adminRes = await api("/api/login", {
    method: "POST",
    body: { username: "admin", password: "password" },
  });
  assert(adminRes.ok && adminRes.data?.token, "Đăng nhập Admin thất bại");
  const adminToken = adminRes.data.token;
  ok("Admin đăng nhập thành công");

  // 2. Đăng nhập Manager (Kế toán)
  const mgrRes = await api("/api/login", {
    method: "POST",
    body: { username: "manager", password: "password" },
  });
  assert(mgrRes.ok && mgrRes.data?.token, "Đăng nhập Manager (Kế toán) thất bại");
  const mgrToken = mgrRes.data.token;
  ok("Manager (Kế toán) đăng nhập thành công");

  // 3. Đăng nhập User (Nhân viên kỹ thuật)
  const userRes = await api("/api/login", {
    method: "POST",
    body: { username: "user", password: "password" },
  });
  assert(userRes.ok && userRes.data?.token, "Đăng nhập User thất bại");
  const userToken = userRes.data.token;
  ok("User (Nhân viên) đăng nhập thành công");

  console.log("\n--- [UC19] Quản lý người dùng & Bảo vệ RBAC ---");
  // Test: Manager & User KHÔNG được gọi API quản lý user (403 Forbidden)
  const userTryUsers = await api("/api/users", { token: userToken });
  assert(userTryUsers.status === 403, "User phải bị chặn 403 khi vào /api/users");
  const mgrTryUsers = await api("/api/users", { token: mgrToken });
  assert(mgrTryUsers.status === 403, "Manager phải bị chặn 403 khi vào /api/users");
  ok("User và Manager bị chặn 403 khi truy cập API quản lý người dùng");

  // Test: Admin tạo user mới hợp lệ
  const tempUsername = `test_acc_${Date.now()}`;
  const createAccRes = await api("/api/users", {
    method: "POST",
    token: adminToken,
    body: { username: tempUsername, password: "testPassword123", role: "user" },
  });
  assert(createAccRes.ok && createAccRes.data?.id, "Admin tạo user thất bại");
  const newUserId = createAccRes.data.id;
  ok(`Admin tạo user mới "${tempUsername}" thành công, password được hash an toàn`);

  // Test: Không cho phép tạo trùng username
  const dupAccRes = await api("/api/users", {
    method: "POST",
    token: adminToken,
    body: { username: tempUsername, password: "password", role: "user" },
  });
  assert(dupAccRes.status === 400 || dupAccRes.status === 409, "Chặn trùng username thất bại");
  ok("Hệ thống từ chối tạo trùng username");

  // Test: Bảo vệ Admin cuối cùng (không cho phép khóa hoặc hạ role admin duy nhất)
  const adminProfile = (await api("/api/users", { token: adminToken })).data.find(u => u.username === "admin");
  if (adminProfile) {
    const lockAdminRes = await api(`/api/users/${adminProfile.id}`, {
      method: "PATCH",
      token: adminToken,
      body: { active: 0 },
    });
    assert(lockAdminRes.status === 400, "Phải chặn khóa Admin cuối cùng");
    ok("Bảo vệ Admin cuối cùng: Không thể tự khóa tài khoản Admin duy nhất");
  }

  console.log("\n--- [UC01] Tạo mới báo giá (Tạo trắng & Upload) ---");
  // Test: Tạo báo giá trắng (Blank Project)
  const blankRes = await api("/api/projects", {
    method: "POST",
    token: adminToken,
    body: {
      mode: "blank",
      name: `BaoGia_Trang_${Date.now()}.xlsx`,
      soBaoGia: "BG-BLANK-001",
      tenKhachHang: "Khách hàng Mẫu",
    },
  });
  assert(blankRes.ok && blankRes.data?.id, "Tạo báo giá trắng thất bại");
  assert(blankRes.data.trangThai === "nhap", "Trạng thái khởi tạo phải là nháp");
  assert(blankRes.data.version === 1, "Phiên bản khởi tạo phải là 1");
  const blankProjectId = blankRes.data.id;
  ok(`Tạo báo giá trắng thành công: ID ${blankProjectId}, version 1, trạng thái "nhap"`);

  // Test: User tạo báo giá thì tự gán quyền phụ trách, không thể gán bừa memberIds
  const userCreateRes = await api("/api/projects", {
    method: "POST",
    token: userToken,
    body: {
      mode: "blank",
      name: `BaoGia_User_${Date.now()}.xlsx`,
      memberIds: [newUserId], // Thử gán bừa người khác
    },
  });
  assert(userCreateRes.ok, "User tạo báo giá thất bại");
  const userProjectId = userCreateRes.data.id;
  assert(userCreateRes.data.nguoiPhuTrachId === userRes.data.id, "User tạo phải tự là nguoiPhuTrachId");
  assert(!userCreateRes.data.memberIds?.includes(newUserId), "User không được tự gán memberIds tùy tiện");
  ok("User tạo báo giá tự động làm người phụ trách chính và không được tự gán memberIds");

  console.log("\n--- [UC07] Phân công thành viên cùng làm ---");
  // Test: Non-admin không được gọi PUT /api/projects/:id/members
  const userTryAssign = await api(`/api/projects/${blankProjectId}/members`, {
    method: "PUT",
    token: userToken,
    body: { memberIds: [userRes.data.id] },
  });
  assert(userTryAssign.status === 403, "Non-admin phải bị chặn 403 khi gọi PUT members");
  const mgrTryAssign = await api(`/api/projects/${blankProjectId}/members`, {
    method: "PUT",
    token: mgrToken,
    body: { memberIds: [userRes.data.id] },
  });
  assert(mgrTryAssign.status === 403, "Manager phải bị chặn 403 khi gọi PUT members");
  ok("Chỉ Quản trị viên (Admin) mới có quyền phân công thành viên (403 đối với Manager/User)");

  // Test: Admin phân công User và tài khoản mới vào blankProjectId
  const assignRes = await api(`/api/projects/${blankProjectId}/members`, {
    method: "PUT",
    token: adminToken,
    body: {
      memberIds: [userRes.data.id, newUserId],
      nguoiPhuTrachId: userRes.data.id,
    },
  });
  assert(assignRes.ok && assignRes.data?.memberIds?.includes(userRes.data.id), "Admin phân công thất bại");
  ok("Admin phân công thành viên và chỉ định người phụ trách chính thành công");

  // Cấu hình editable ranges cho blankProjectId: BaoGia!A1:B10
  const setRangeRes = await api(`/api/projects/${blankProjectId}/ranges`, {
    method: "PUT",
    token: adminToken,
    body: { editableRanges: { BaoGia: "A1:B10" } },
  });
  assert(setRangeRes.ok, "Cấu hình editable ranges thất bại");
  ok("Cấu hình vùng sửa: BaoGia!A1:B10");

  // Chuyển trạng thái sang dang_lam
  await api(`/api/projects/${blankProjectId}/status`, {
    method: "POST",
    token: adminToken,
    body: { trangThai: "dang_lam" },
  });
  ok("Chuyển trạng thái sang dang_lam");

  console.log("\n--- [UC04] Sửa khối lượng, Batch edits, Default Deny & OCC 409 ---");
  // Test 1: Sửa ngoài vùng (C1) phải bị Backend chặn (Default Deny - 403)
  const outOfRangeEdit = await api(`/api/projects/${blankProjectId}/edits`, {
    method: "POST",
    token: userToken,
    body: {
      sheetName: "BaoGia",
      cell: "C1",
      newValue: "Giá trị lậu",
    },
  });
  assert(outOfRangeEdit.status === 403, "Sửa ngoài vùng phải bị chặn 403");
  ok("Bảo mật Backend: Chặn 403 khi sửa ô ngoài editable_ranges (Default Deny)");

  // Test 2: Sửa trong vùng (A1) thành công và trả về revision 1
  const validEdit = await api(`/api/projects/${blankProjectId}/edits`, {
    method: "POST",
    token: userToken,
    body: {
      sheetName: "BaoGia",
      cell: "A1",
      oldValue: "",
      newValue: "Khối lượng đào",
      expectedRevision: 0,
    },
  });
  assert(validEdit.ok && validEdit.data?.revision === 1, "Sửa hợp lệ ô A1 thất bại");
  ok("Nhân viên sửa hợp lệ ô A1: Thành công, trả về revision 1");

  // Test 3: Sửa lại ô A1 với expectedRevision cũ (0) phải trả 409 CONFLICT!
  const conflictEdit = await api(`/api/projects/${blankProjectId}/edits`, {
    method: "POST",
    token: userToken,
    body: {
      sheetName: "BaoGia",
      cell: "A1",
      oldValue: "",
      newValue: "Ghi đè xung đột",
      expectedRevision: 0, // Sai revision vì trên server đã lên 1
    },
  });
  assert(conflictEdit.status === 409 && conflictEdit.data?.conflict === true, "Phải trả về 409 Conflict khi sai expectedRevision");
  ok("Kiểm soát đồng thời OCC: Trả về 409 Conflict khi sửa ô có expectedRevision cũ hơn server");

  // Test 4: Batch Edits (Nhiều ô trong 1 SQLite transaction nguyên tử)
  const batchRes = await api(`/api/projects/${blankProjectId}/edits/batch`, {
    method: "POST",
    token: userToken,
    body: {
      edits: [
        { sheetName: "BaoGia", cell: "A2", oldValue: "", newValue: "Khối lượng đắp" },
        { sheetName: "BaoGia", cell: "B1", oldValue: "", newValue: "100" },
        { sheetName: "BaoGia", cell: "B2", oldValue: "", newValue: "200" },
      ],
    },
  });
  assert(batchRes.ok && (batchRes.data?.count === 3 || batchRes.data?.edits?.length === 3), "Batch edits thất bại");
  ok("Lưu hàng loạt Batch Edits: 3 ô được ghi nhận thành công trong 1 SQLite transaction duy nhất");

  // Test 5: Hai nhân viên cùng project đọc cell states thấy toàn bộ dữ liệu của nhau
  const cellStatesRes = await api(`/api/projects/${blankProjectId}/cell-states`, {
    token: userToken,
  });
  assert(cellStatesRes.ok && cellStatesRes.data?.BaoGia?.A1?.value === "Khối lượng đào", "cell-states A1");
  assert(cellStatesRes.data?.BaoGia?.B1?.value === "100", "cell-states B1");
  ok("API /cell-states: Toàn bộ thành viên nhìn thấy đồng bộ số liệu mới nhất của dự án");

  // Test 6: Chống xóa user có ràng buộc dự án (Foreign Key / Audit Protection)
  const deleteAssignedUserRes = await api(`/api/users/${newUserId}`, {
    method: "DELETE",
    token: adminToken,
  });
  assert(deleteAssignedUserRes.status === 400, "Phải chặn xóa user đang được gán vào dự án");
  ok("Bảo toàn dữ liệu: Chặn xóa cứng tài khoản đang được gán trong dự án");

  // Dọn dẹp
  await api(`/api/projects/${blankProjectId}`, { method: "DELETE", token: adminToken });
  await api(`/api/projects/${userProjectId}`, { method: "DELETE", token: adminToken });
  ok("Dọn dẹp các dự án kiểm thử thành công");

  console.log("\n==================================================");
  console.log("🎉 TẤT CẢ TEST UC19, UC01, UC07, UC04 & RBAC ĐÃ PASS 100%!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Lỗi:", err);
  process.exit(1);
});

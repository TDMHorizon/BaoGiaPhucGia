/**
 * Test Suite: UC21 (Admin xem toàn bộ vết sửa đổi trên mọi dự án)
 * Chạy: node scripts/test-uc21-global-audit.mjs
 */

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

async function main() {
  console.log("======================================================================");
  console.log("KIỂM THỬ TỰ ĐỘNG UC21: ADMIN KIỂM TOÁN VẾT SỬA ĐỔI TOÀN HỆ THỐNG");
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
  ok("Đăng nhập 3 roles thành công");

  // -------------------------------------------------------------
  // PHẦN 1: RBAC (CHỈ ADMIN MỚI ĐƯỢC XEM TOÀN BỘ VẾT SỬA HỆ THỐNG)
  // -------------------------------------------------------------
  console.log("\n--- KIỂM TRA RBAC UC21 ---");

  const userRes = await api("/api/audit/edits", { token: userToken });
  assert(userRes.status === 403, "User bị cấm xem vết sửa toàn hệ thống (403)");
  ok("RBAC: User thông thường bị từ chối truy cập (HTTP 403)");

  const managerRes = await api("/api/audit/edits", { token: managerToken });
  assert(managerRes.status === 403, "Manager bị cấm xem vết sửa toàn hệ thống (403)");
  ok("RBAC: Manager bị từ chối truy cập vết sửa toàn hệ thống (HTTP 403, Admin-only)");

  const adminRes = await api("/api/audit/edits", { token: adminToken });
  assert(adminRes.status === 200, "Admin truy cập thành công (200)");
  assert(adminRes.data && Array.isArray(adminRes.data.items), "Trả về danh sách items");
  assert(typeof adminRes.data.total === "number", "Có trường total tổng số bản ghi");
  ok(`Admin truy vấn toàn bộ vết sửa thành công: ${adminRes.data.total} bản ghi ghi nhận`);

  // -------------------------------------------------------------
  // PHẦN 2: BỘ LỌC VÀ PHÂN TRANG (FILTERING & PAGINATION)
  // -------------------------------------------------------------
  console.log("\n--- KIỂM TRA BỘ LỌC VÀ PHÂN TRANG SQL ---");

  // 2.1 Phân trang limit=3, page=1 và page=2
  const p1Res = await api("/api/audit/edits?page=1&limit=3", { token: adminToken });
  assert(p1Res.status === 200, "Lấy trang 1 thành công");
  assert(p1Res.data.items.length <= 3, "Trang 1 có tối đa 3 phần tử");
  assert(p1Res.data.currentPage === 1, "currentPage là 1");
  const itemP1 = p1Res.data.items[0];

  if (p1Res.data.total > 3) {
    const p2Res = await api("/api/audit/edits?page=2&limit=3", { token: adminToken });
    assert(p2Res.status === 200, "Lấy trang 2 thành công");
    assert(p2Res.data.currentPage === 2, "currentPage là 2");
    if (p2Res.data.items.length > 0) {
      assert(p2Res.data.items[0].id !== itemP1.id, "Bản ghi trang 2 khác bản ghi trang 1");
    }
    ok("Phân trang SQL hoạt động chính xác (Trang 1, Trang 2 không trùng lặp)");
  }

  // 2.2 Lọc theo userId
  if (itemP1 && itemP1.userId) {
    const filterUserRes = await api(`/api/audit/edits?userId=${itemP1.userId}`, { token: adminToken });
    assert(filterUserRes.status === 200, "Lọc theo userId thành công");
    for (const item of filterUserRes.data.items) {
      assert(item.userId === itemP1.userId, `Mọi bản ghi phải thuộc userId=${itemP1.userId}`);
    }
    ok(`Bộ lọc theo userId=${itemP1.userId} hoạt động chuẩn xác`);
  }

  // 2.3 Lọc theo cell
  if (itemP1 && itemP1.cell) {
    const filterCellRes = await api(`/api/audit/edits?cell=${encodeURIComponent(itemP1.cell)}`, { token: adminToken });
    assert(filterCellRes.status === 200, "Lọc theo cell thành công");
    for (const item of filterCellRes.data.items) {
      assert(item.cell === itemP1.cell, `Mọi bản ghi phải thuộc cell=${itemP1.cell}`);
    }
    ok(`Bộ lọc theo địa chỉ ô cell=${itemP1.cell} hoạt động chuẩn xác`);
  }

  // 2.4 Cấu trúc dữ liệu bản ghi audit
  if (itemP1) {
    assert(itemP1.id !== undefined, "Có trường id");
    assert(itemP1.projectId !== undefined, "Có trường projectId");
    assert(itemP1.sheetName !== undefined, "Có trường sheetName");
    assert(itemP1.cell !== undefined, "Có trường cell");
    assert(itemP1.oldValue !== undefined, "Có trường oldValue");
    assert(itemP1.newValue !== undefined, "Có trường newValue");
    assert(itemP1.timestamp !== undefined, "Có trường timestamp");
    ok(`Cấu trúc DTO bản ghi audit chuẩn chỉnh: ID=${itemP1.id}, Project=${itemP1.projectId}, Cell=${itemP1.sheetName}!${itemP1.cell}, Old=${itemP1.oldValue} -> New=${itemP1.newValue}`);
  }

  console.log("\n======================================================================");
  console.log("🎉 TẤT CẢ CÁC BÀI TEST UC21 ĐÃ ĐẠT 100% YÊU CẦU!");
  console.log("======================================================================\n");
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

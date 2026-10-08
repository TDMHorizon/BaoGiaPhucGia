/**
 * Integration test: admin upload Excel, editable ranges, assign staff, status workflow.
 * Run: node scripts/test-admin-workflow.mjs
 * Requires server at http://localhost:3000
 */
import * as XLSX from "xlsx";

const BASE = process.env.API_BASE || "http://localhost:3000";

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
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
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function makeSampleXlsxBase64() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Báo giá test", "", "Ngày"],
    ["Khách hàng", "Giá", "Ghi chú"],
    ["SP A", 100, ""],
    ["SP B", 200, ""],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buf.toString("base64")}`;
}

async function main() {
  console.log("=== Test luồng Admin/Quản lý ===\n");
  const health = await api("/api/health");
  assert(health.ok, "health");
  ok("Server health OK");

  const adminLogin = await api("/api/login", {
    method: "POST",
    body: { username: "admin", password: "password" },
  });
  assert(adminLogin.token, "admin token");
  const adminToken = adminLogin.token;
  ok(`Đăng nhập admin (${adminLogin.role})`);

  const activeUsers = await api("/api/users/active", { token: adminToken });
  assert(Array.isArray(activeUsers) && activeUsers.length > 0, "active users");
  const staff = activeUsers.find((u) => u.username === "user") || activeUsers[0];
  ok(`Nhân viên test: ${staff.username} (${staff.id})`);

  const fileBase64 = makeSampleXlsxBase64();
  const testName = `E2E-Admin-${Date.now()}.xlsx`;
  const created = await api("/api/projects", {
    method: "POST",
    token: adminToken,
    body: {
      name: testName,
      fileBase64,
      sheets: ["Sheet1"],
      soBaoGia: "BG-E2E-001",
      tenKhachHang: "Khách E2E",
      trangThai: "nhap",
    },
  });
  assert(created.id && created.fileBase64, "project created");
  assert(created.trangThai === "nhap", "initial status nhap");
  ok(`Upload Excel → project ${created.id}, trạng thái: ${created.trangThai}`);

  const ranges = { Sheet1: "C3:C4" };
  const withRanges = await api(`/api/projects/${created.id}/ranges`, {
    method: "PUT",
    token: adminToken,
    body: { editableRanges: ranges },
  });
  assert(withRanges.editableRanges?.Sheet1 === "C3:C4", "ranges saved");
  ok("Vùng sửa Sheet1!C3:C4 đã lưu");

  const assigned = await api(`/api/projects/${created.id}`, {
    method: "PATCH",
    token: adminToken,
    body: {
      nguoiPhuTrachId: staff.id,
      memberIds: [staff.id],
      ghiChu: "Gán E2E",
    },
  });
  assert(assigned.nguoiPhuTrachId === staff.id, "assignee");
  assert(assigned.memberIds?.includes(staff.id), "members");
  ok("Gán người phụ trách + thành viên");

  const status1 = await api(`/api/projects/${created.id}/status`, {
    method: "POST",
    token: adminToken,
    body: { trangThai: "dang_lam" },
  });
  assert(status1.trangThai === "dang_lam", "status dang_lam");
  ok("Admin chuyển trạng thái → đang điền");

  const pending = await api("/api/projects/pending-count", { token: adminToken });
  assert(typeof pending.count === "number" && pending.count >= 1, "pending count");
  ok(`Pending count (admin): ${pending.count}`);

  const userLogin = await api("/api/login", {
    method: "POST",
    body: { username: "user", password: "password" },
  });
  const userToken = userLogin.token;
  ok("Đăng nhập nhân viên user");

  const userProjects = await api("/api/projects", { token: userToken });
  const visible = userProjects.some((p) => p.id === created.id);
  assert(visible, "user sees assigned project");
  ok("Nhân viên thấy báo giá được gán");

  const detail = await api(`/api/projects/${created.id}`, { token: userToken });
  assert(detail.editableRanges?.Sheet1 === "C3:C4", "user sees ranges");
  ok("Nhân viên đọc đúng vùng editable");

  await api(`/api/projects/${created.id}/edits`, {
    method: "POST",
    token: userToken,
    body: {
      sheetName: "Sheet1",
      cell: "C3",
      oldValue: "100",
      newValue: "150",
    },
  });
  ok("Nhân viên ghi edit ô C3 (trong vùng cho phép)");

  const userStatus = await api(`/api/projects/${created.id}/status`, {
    method: "POST",
    token: userToken,
    body: { trangThai: "da_gui" },
  });
  assert(userStatus.trangThai === "da_gui", "da_gui");
  ok("Nhân viên chuyển → đã gửi khách");

  let locked = false;
  try {
    await api(`/api/projects/${created.id}/edits`, {
      method: "POST",
      token: userToken,
      body: {
        sheetName: "Sheet1",
        cell: "C4",
        oldValue: "200",
        newValue: "250",
      },
    });
  } catch (e) {
    if (String(e.message).includes("403") && (String(e.message).includes("locked") || String(e.message).includes("khóa"))) locked = true;
    else throw e;
  }
  assert(locked, "edit blocked when da_gui");
  ok("Khóa sửa khi đã gửi khách (403 Project is locked)");

  await api(`/api/projects/${created.id}`, {
    method: "DELETE",
    token: adminToken,
  });
  ok("Dọn dẹp: xóa project test");

  console.log("\n=== Tất cả bước PASS ===");
  console.log("\nKiểm tra UI thủ công: http://localhost:3000");
  console.log("  admin / password → kéo chọn vùng, ProjectMetaForm gán NV, StatusWorkflow");
}

main().catch((e) => {
  console.error("\n" + e.message);
  process.exit(1);
});

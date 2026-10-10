/**
 * Test các tình huống biên UC19 và UC07:
 * - UC19 Tình huống 3: Admin khóa tài khoản khi user đang mở spreadsheet -> Socket event "account.locked" & Chặn request tiếp theo
 * - UC19 Tình huống 5: Admin đổi role sang manager -> Socket event "account.role_updated" & Endpoint POST /api/auth/refresh cấp token mới
 * - UC07 Tình huống 3 & 7: Admin thay đổi danh sách phân công (bỏ B thêm C) -> Socket "project.membership_revoked" & Chặn truy cập file của B
 * - UC07 Tình huống 5: Realtime Presence & Active Cell Indicator (cell_focus / cell_blur / cell.updated)
 * - UC07 Tình huống 6: Hai nhân viên cùng sửa 1 ô -> Realtime sync alert trước khi lưu & OCC 409 Conflict
 */
import { io as ioClient } from "socket.io-client";

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
  console.log("KIỂM THỬ CÁC TÌNH HUỐNG NÂNG CAO UC19 & UC07");
  console.log("==================================================\n");

  // Đăng nhập Admin
  const adminRes = await api("/api/login", {
    method: "POST",
    body: { username: "admin", password: "password" },
  });
  assert(adminRes.ok && adminRes.data?.token, "Đăng nhập Admin thất bại");
  const adminToken = adminRes.data.token;
  ok("Admin đăng nhập thành công");

  // -------------------------------------------------------------------------
  // 1. UC19 - Tình huống 3: Admin khóa tài khoản khi user đang mở spreadsheet
  // -------------------------------------------------------------------------
  console.log("\n--- [UC19 - Tình huống 3] Admin khóa tài khoản nhân viên đang sửa file ---");
  const ts = Date.now();
  const uLockedName = `nv_lock_${ts}`;
  const crUserRes = await api("/api/users", {
    method: "POST",
    token: adminToken,
    body: { username: uLockedName, password: "password123", role: "user" },
  });
  assert(crUserRes.ok, "Tạo user kiểm thử thất bại");
  const lockedUserId = crUserRes.data.id;

  // Nhân viên đăng nhập và kết nối Socket
  const uLoginRes = await api("/api/login", {
    method: "POST",
    body: { username: uLockedName, password: "password123" },
  });
  assert(uLoginRes.ok && uLoginRes.data?.token, "Nhân viên đăng nhập thất bại");
  const uLockedToken = uLoginRes.data.token;

  const socketUser = ioClient(BASE, { auth: { token: uLockedToken }, transports: ["websocket"] });
  await new Promise((resolve) => socketUser.on("connect", resolve));
  socketUser.emit("identify_user", lockedUserId);

  let lockEventReceived = false;
  socketUser.on("account.locked", (payload) => {
    if (payload.userId === lockedUserId) {
      lockEventReceived = true;
    }
  });

  // Admin tiến hành khóa tài khoản
  const lockRes = await api(`/api/users/${lockedUserId}`, {
    method: "PATCH",
    token: adminToken,
    body: { active: 0 },
  });
  assert(lockRes.ok && (lockRes.data.active === 0 || lockRes.data.active === false), `Khóa user ở Admin thất bại: ${JSON.stringify(lockRes.data)}`);

  // Chờ socket nhận sự kiện
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert(lockEventReceived, "Không nhận được sự kiện Socket account.locked khi Admin khóa tài khoản");
  ok("Nhận sự kiện Socket realtime 'account.locked' thành công");

  // Kiểm tra request tiếp theo của nhân viên bị từ chối 401 với ACCOUNT_LOCKED
  const reqAfterLock = await api("/api/me", { token: uLockedToken });
  assert(
    reqAfterLock.status === 401 && (reqAfterLock.data?.code === "ACCOUNT_LOCKED" || reqAfterLock.data?.error?.includes("khóa")),
    `Request tiếp theo của tài khoản bị khóa không bị từ chối đúng chuẩn (status: ${reqAfterLock.status})`
  );
  ok("Request tiếp theo bị từ chối chính xác: 401 ACCOUNT_LOCKED");
  socketUser.disconnect();

  // -------------------------------------------------------------------------
  // 2. UC19 - Tình huống 5: Admin đổi role sang manager & Refresh Token
  // -------------------------------------------------------------------------
  console.log("\n--- [UC19 - Tình huống 5] Admin đổi role sang manager & Refresh Token ---");
  const uRoleName = `nv_role_${ts}`;
  const crUserRoleRes = await api("/api/users", {
    method: "POST",
    token: adminToken,
    body: { username: uRoleName, password: "password123", role: "user" },
  });
  assert(crUserRoleRes.ok, "Tạo user đổi role thất bại");
  const roleUserId = crUserRoleRes.data.id;

  const roleLoginRes = await api("/api/login", {
    method: "POST",
    body: { username: uRoleName, password: "password123" },
  });
  assert(roleLoginRes.ok && roleLoginRes.data.role === "user", "Đăng nhập ban đầu không mang role user");
  const oldRoleToken = roleLoginRes.data.token;

  const socketRoleUser = ioClient(BASE, { auth: { token: oldRoleToken }, transports: ["websocket"] });
  await new Promise((resolve) => socketRoleUser.on("connect", resolve));
  socketRoleUser.emit("identify_user", roleUserId);

  let roleEventReceived = false;
  socketRoleUser.on("account.role_updated", (payload) => {
    if (payload.userId === roleUserId && payload.newRole === "manager") {
      roleEventReceived = true;
    }
  });

  // Admin thăng chức cho user lên "manager" (Kế toán)
  const updateRoleRes = await api(`/api/users/${roleUserId}`, {
    method: "PATCH",
    token: adminToken,
    body: { role: "manager" },
  });
  assert(updateRoleRes.ok && updateRoleRes.data.role === "manager", "Đổi role ở Admin thất bại");

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert(roleEventReceived, "Không nhận được sự kiện Socket account.role_updated");
  ok("Nhận sự kiện Socket realtime 'account.role_updated' { newRole: 'manager' } thành công");

  // Client gọi API POST /api/auth/refresh để lấy token mới
  const refreshRes = await api("/api/auth/refresh", {
    method: "POST",
    token: oldRoleToken,
  });
  assert(refreshRes.ok && refreshRes.data?.token, "API /api/auth/refresh thất bại");
  assert(refreshRes.data.user?.role === "manager", "Token mới không cập nhật role manager từ DB");
  const newRefreshedToken = refreshRes.data.token;
  ok("Luồng Refresh Token thành công: Cấp lại access token mới mang vai trò 'manager' từ database");

  // Thử dùng token mới gọi /api/me
  const meRes = await api("/api/me", { token: newRefreshedToken });
  assert(meRes.ok && meRes.data.role === "manager", "Quyền mới chưa có hiệu lực trên token mới");
  ok("Quyền 'manager' có hiệu lực ngay lập tức với token mới mà không cần đăng nhập lại!");
  socketRoleUser.disconnect();

  // -------------------------------------------------------------------------
  // 3. UC07 - Tình huống 3 & 7: Admin thay đổi danh sách phân công (Bỏ B, thêm C)
  // -------------------------------------------------------------------------
  console.log("\n--- [UC07 - Tình huống 3 & 7] Admin thay đổi phân công, thu hồi quyền nhân viên B ---");
  // Tạo user A và user B
  const crA = await api("/api/users", { method: "POST", token: adminToken, body: { username: `nv_A_${ts}`, password: "password123", role: "user" } });
  const crB = await api("/api/users", { method: "POST", token: adminToken, body: { username: `nv_B_${ts}`, password: "password123", role: "user" } });
  const crC = await api("/api/users", { method: "POST", token: adminToken, body: { username: `nv_C_${ts}`, password: "password123", role: "user" } });
  const userA = crA.data;
  const userB = crB.data;
  const userC = crC.data;

  // Tạo báo giá
  const prjRes = await api("/api/projects", {
    method: "POST",
    token: adminToken,
    body: {
      name: `Báo Giá Test Phân Công ${ts}`,
      mode: "blank",
      sheets: ["BaoGia"],
      editableRanges: { BaoGia: "A1:D20" },
    },
  });
  assert(prjRes.ok, "Tạo dự án thất bại");
  const prjId = prjRes.data.id;

  // Admin phân công [userA, userB] và chuyển trạng thái "dang_lam"
  await api(`/api/projects/${prjId}/members`, {
    method: "PUT",
    token: adminToken,
    body: { memberIds: [userA.id, userB.id], nguoiPhuTrachId: userA.id },
  });
  await api(`/api/projects/${prjId}/status`, {
    method: "POST",
    token: adminToken,
    body: { trangThai: "dang_lam" },
  });

  // Nhân viên B đăng nhập và kết nối Socket
  const loginB = await api("/api/login", { method: "POST", body: { username: userB.username, password: "password123" } });
  const tokenB = loginB.data.token;
  const socketB = ioClient(BASE, { auth: { token: tokenB }, transports: ["websocket"] });
  await new Promise((resolve) => socketB.on("connect", resolve));
  socketB.emit("identify_user", userB.id);
  socketB.emit("join_project", prjId);

  let membershipRevokedReceived = false;
  socketB.on("project.membership_revoked", (payload) => {
    if (payload.projectId === prjId && (payload.userId === userB.id || payload.removedUserIds?.includes(userB.id))) {
      membershipRevokedReceived = true;
    }
  });

  // Trước khi bị gỡ: Nhân viên B sửa thử ô A1 hợp lệ
  const editBeforeRevoke = await api(`/api/projects/${prjId}/edits`, {
    method: "POST",
    token: tokenB,
    body: { sheetName: "BaoGia", cell: "A1", newValue: "Gia tri tu B", expectedRevision: 0 },
  });
  assert(editBeforeRevoke.ok, "Nhân viên B không sửa được ô A1 trước khi bị gỡ phân công");
  ok("Nhân viên B sửa ô A1 thành công khi đang được phân công");

  // Admin thay đổi phân công: Gỡ B, gán [userA, userC]
  const updateMembersRes = await api(`/api/projects/${prjId}/members`, {
    method: "PUT",
    token: adminToken,
    body: { memberIds: [userA.id, userC.id] },
  });
  assert(updateMembersRes.ok, "Admin cập nhật danh sách phân công thất bại");

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert(membershipRevokedReceived, "Nhân viên B không nhận được sự kiện Socket project.membership_revoked");
  ok("Nhận sự kiện Socket 'project.membership_revoked' khi Admin gỡ nhân viên B khỏi báo giá");

  // Sau khi bị gỡ: Nhân viên B cố sửa tiếp ô A2 -> Bị từ chối 403 Forbidden
  const editAfterRevoke = await api(`/api/projects/${prjId}/edits`, {
    method: "POST",
    token: tokenB,
    body: { sheetName: "BaoGia", cell: "A2", newValue: "Gia tri sua lén", expectedRevision: 0 },
  });
  assert(
    editAfterRevoke.status === 403,
    `Nhân viên B sau khi bị thu hồi phân công vẫn sửa được ô! (status: ${editAfterRevoke.status})`
  );
  ok("Backend từ chối 403 Forbidden đối với mọi thao tác sửa tiếp theo của nhân viên B!");
  socketB.disconnect();

  // -------------------------------------------------------------------------
  // 4. UC07 - Tình huống 5 & 6: Concurrency & Realtime Presence Sync
  // -------------------------------------------------------------------------
  console.log("\n--- [UC07 - Tình huống 5 & 6] Realtime Collaborative Presence & Conflict Prevention ---");
  const loginA = await api("/api/login", { method: "POST", body: { username: userA.username, password: "password123" } });
  const tokenA = loginA.data.token;
  const loginC = await api("/api/login", { method: "POST", body: { username: userC.username, password: "password123" } });
  const tokenC = loginC.data.token;

  const socketA = ioClient(BASE, { auth: { token: tokenA }, transports: ["websocket"] });
  const socketC = ioClient(BASE, { auth: { token: tokenC }, transports: ["websocket"] });
  await Promise.all([
    new Promise((resolve) => socketA.on("connect", resolve)),
    new Promise((resolve) => socketC.on("connect", resolve)),
  ]);
  socketA.emit("join_project", prjId);
  socketC.emit("join_project", prjId);
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Tình huống 5: A focus vào ô D10 -> C nhận event cell_focused
  let cReceivedFocus = null;
  socketC.on("cell_focused", (data) => {
    cReceivedFocus = data;
  });

  socketA.emit("cell_focus", {
    projectId: prjId,
    sheetName: "BaoGia",
    r: 9,
    c: 3,
    cell: "D10",
    user: { id: userA.id, username: userA.username, color: "#6366f1" },
  });

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert(cReceivedFocus && cReceivedFocus.cell === "D10", "Nhân viên C không nhận được presence focus của A tại D10");
  ok("Nhân viên C nhận realtime presence indicator ô D10 của nhân viên A đang chỉnh sửa");

  // Tình huống 6: Hai người cùng sửa ô D10. A lưu trước. C lưu sau với expectedRevision cũ
  let cReceivedCellUpdate = null;
  socketC.on("cell.updated", (data) => {
    cReceivedCellUpdate = data;
  });

  // A lưu trước ô D10
  const aSaveD10 = await api(`/api/projects/${prjId}/edits`, {
    method: "POST",
    token: tokenA,
    body: { sheetName: "BaoGia", cell: "D10", newValue: "1000000", expectedRevision: 0 },
  });
  assert(aSaveD10.ok && aSaveD10.data.revision === 1, "A lưu ô D10 thất bại");
  ok("Nhân viên A lưu thành công ô D10 (revision 1)");

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert(
    cReceivedCellUpdate && cReceivedCellUpdate.cell === "D10" && cReceivedCellUpdate.newValue === "1000000",
    "C không nhận được realtime cell.updated khi A vừa lưu ô D10"
  );
  ok("Nhân viên C nhận thông báo realtime giá trị mới '1000000' của ô D10 trước khi gửi request của mình");

  // C bấm lưu sau với expectedRevision = 0 (cũ) -> Hệ thống từ chối với 409 Conflict
  const cSaveConflict = await api(`/api/projects/${prjId}/edits`, {
    method: "POST",
    token: tokenC,
    body: { sheetName: "BaoGia", cell: "D10", newValue: "2000000", expectedRevision: 0 },
  });
  assert(
    cSaveConflict.status === 409 && cSaveConflict.data?.conflict === true,
    `Không phát hiện xung đột đồng thời 409 khi C ghi đè ô D10! (status: ${cSaveConflict.status})`
  );
  assert(cSaveConflict.data.latestValue === "1000000", "Không trả về latestValue chính xác trong conflict payload");
  ok("OCC 409 Conflict ngăn chặn thành công việc C ghi đè âm thầm dữ liệu của A tại ô D10!");

  // Dọn dẹp
  socketA.disconnect();
  socketC.disconnect();
  await api(`/api/projects/${prjId}`, { method: "DELETE", token: adminToken });
  ok("Dọn dẹp dự án kiểm thử thành công");

  console.log("\n==================================================");
  console.log("🎉 TOÀN BỘ CÁC TÌNH HUỐNG UC19 VÀ UC07 ĐÃ PASS 100%!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Lỗi kịch bản kiểm thử:", err);
  process.exit(1);
});

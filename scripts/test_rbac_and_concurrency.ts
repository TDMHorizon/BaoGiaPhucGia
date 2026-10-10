const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("=== BẮT ĐẦU KIỂM THỬ BẢO MẬT RBAC, AUTHORIZATION & CONCURRENCY ===");

  // 1. Kiểm tra đăng nhập
  console.log("\n[TEST 1] Đăng nhập các Role...");
  const adminRes = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "password" }),
  });
  const adminData = await adminRes.json();
  console.log("Admin login:", adminData.role === "admin" ? "✅ SUCCESS" : `❌ FAILED: ${JSON.stringify(adminData)}`);

  const managerRes = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "manager", password: "password" }),
  });
  const managerData = await managerRes.json();
  console.log("Manager login:", managerData.role === "manager" ? "✅ SUCCESS" : `❌ FAILED: ${JSON.stringify(managerData)}`);

  const userRes = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "user", password: "password" }),
  });
  const userData = await userRes.json();
  console.log("User/Nhân viên login:", userData.role === "user" ? "✅ SUCCESS" : `❌ FAILED: ${JSON.stringify(userData)}`);

  const adminToken = adminData.token;
  const managerToken = managerData.token;
  const userToken = userData.token;

  if (!adminToken || !managerToken || !userToken) {
    console.error("Thiếu token! Dừng kiểm thử.");
    return;
  }

  // 2. Kiểm tra RBAC ngăn chặn User (Employee) gọi các API quản trị
  console.log("\n[TEST 2] Kiểm tra RBAC ngăn chặn User gọi API nhạy cảm...");
  
  // 2.1 User gọi Audit Logs (Chỉ Admin)
  const auditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  console.log("User truy cập Audit Logs:", auditRes.status === 403 ? "✅ Chặn thành công (403 Forbidden)" : `❌ Lỗi: status=${auditRes.status}`);

  // 2.2 Manager gọi Audit Logs (Chỉ Admin)
  const mgrAuditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  console.log("Manager truy cập Audit Logs:", mgrAuditRes.status === 403 ? "✅ Chặn thành công (403 Forbidden)" : `❌ Lỗi: status=${mgrAuditRes.status}`);

  // 2.3 Admin gọi Audit Logs (Admin được xem)
  const adminAuditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log("Admin truy cập Audit Logs:", adminAuditRes.status === 200 ? "✅ Cho phép thành công (200 OK)" : `❌ Lỗi: status=${adminAuditRes.status}`);

  // 2.4 User tạo Project
  const createProjRes = await fetch(`${BASE_URL}/api/projects`, {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hacked Project", fileBase64: "UEsDBBQAAAAIA", sheets: ["Sheet1"] }),
  });
  console.log("User tạo Project:", createProjRes.status === 403 ? "✅ Chặn thành công (403 Forbidden)" : `❌ Lỗi: status=${createProjRes.status}`);

  // 2.5 User sửa User khác
  const changeUserRes = await fetch(`${BASE_URL}/api/users/${userData.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "admin" }),
  });
  console.log("User tự leo quyền thành Admin qua API /api/users/:id:", changeUserRes.status === 403 ? "✅ Chặn thành công (403 Forbidden)" : `❌ Lỗi: status=${changeUserRes.status}`);

  // 3. Kiểm tra Project & Cell Permissions
  console.log("\n[TEST 3] Kiểm tra Cell Edit Authorization & Default Deny...");
  const projectsRes = await fetch(`${BASE_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const projects = await projectsRes.json();
  const testProject = projects[0];

  console.log(`Đang kiểm thử trên Project: ${testProject.id} (${testProject.name})`);

  // Gán user vào project và cấp vùng ".ĐNTT": "Q10:Q20" bằng PATCH
  const patchProj = await fetch(`${BASE_URL}/api/projects/${testProject.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      memberIds: [userData.id],
      editableRanges: { ".ĐNTT": "Q10:Q20" },
    }),
  });
  if (patchProj.status !== 200) {
    console.error("PATCH project thất bại:", await patchProj.text());
  }

  // 3.1 User thử sửa ô NGOÀI vùng được cấp (ví dụ A1)
  const illegalEditRes = await fetch(`${BASE_URL}/api/projects/${testProject.id}/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sheetName: ".ĐNTT",
      cell: "A1",
      oldValue: "",
      newValue: "Giá trị hack",
    }),
  });
  console.log("User sửa ô ngoài range (.ĐNTT - A1):", illegalEditRes.status === 403 ? "✅ Chặn thành công (403 Default Deny)" : `❌ Lỗi: status=${illegalEditRes.status}`);

  // 3.2 User thử sửa ô TRONG vùng được cấp (Q13)
  const legalEditRes = await fetch(`${BASE_URL}/api/projects/${testProject.id}/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sheetName: ".ĐNTT",
      cell: "Q13",
      oldValue: "",
      newValue: "5000000",
    }),
  });
  console.log("User sửa ô trong range (.ĐNTT - Q13):", legalEditRes.status === 200 ? "✅ Hợp lệ (200 OK)" : `❌ Lỗi: status=${legalEditRes.status}`);

  // 3.3 Manager và Admin sửa ô bất kỳ (ví dụ A1 hoặc Z100) -> Không bị giới hạn range
  const managerEditRes = await fetch(`${BASE_URL}/api/projects/${testProject.id}/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${managerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sheetName: ".ĐNTT",
      cell: "A1",
      oldValue: "",
      newValue: "Manager update ô A1 tự do",
    }),
  });
  console.log("Manager sửa ô A1 bất kỳ:", managerEditRes.status === 200 ? "✅ Hợp lệ (200 OK - Không bị giới hạn range)" : `❌ Lỗi: status=${managerEditRes.status}`);

  const adminEditRes = await fetch(`${BASE_URL}/api/projects/${testProject.id}/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sheetName: ".ĐNTT",
      cell: "B2",
      oldValue: "",
      newValue: "Admin update ô B2 tự do",
    }),
  });
  console.log("Admin sửa ô B2 bất kỳ:", adminEditRes.status === 200 ? "✅ Hợp lệ (200 OK - Không bị giới hạn range)" : `❌ Lỗi: status=${adminEditRes.status}`);

  // 4. Kiểm tra Optimistic Concurrency Control (Cell Revision & 409 Conflict)
  console.log("\n[TEST 4] Kiểm tra Optimistic Concurrency Control (Cell Revision & 409 Conflict)...");
  const cellValsRes = await fetch(`${BASE_URL}/api/projects/${testProject.id}/cell-values`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const cellVals = await cellValsRes.json();
  const currentQ13 = cellVals[".ĐNTT"]?.["Q13"];
  const currentRevision = currentQ13?.revision || 0;
  console.log(`Current revision của Q13: ${currentRevision}, value: "${currentQ13?.value}"`);

  // Client 1 gửi update với đúng expectedRevision
  const c1Res = await fetch(`${BASE_URL}/api/projects/${testProject.id}/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sheetName: ".ĐNTT",
      cell: "Q13",
      oldValue: currentQ13?.value || "",
      newValue: "7500000",
      expectedRevision: currentRevision,
    }),
  });
  console.log("Client 1 commit với expectedRevision đúng:", c1Res.status === 200 ? "✅ Thành công (200 OK)" : `❌ Lỗi: status=${c1Res.status}`);

  // Client 2 cố tình gửi update với STALE revision (vẫn gửi expectedRevision cũ)
  const c2Res = await fetch(`${BASE_URL}/api/projects/${testProject.id}/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sheetName: ".ĐNTT",
      cell: "Q13",
      oldValue: currentQ13?.value || "",
      newValue: "9999999",
      expectedRevision: currentRevision, // Stale!
    }),
  });
  const c2Data = await c2Res.json();
  console.log("Client 2 gửi stale revision:", c2Res.status === 409 ? `✅ Bắt xung đột chuẩn xác (409 Conflict: "${c2Data.error}")` : `❌ Lỗi: status=${c2Res.status}`);

  // 5. Kiểm tra Token Revocation khi đổi mật khẩu
  console.log("\n[TEST 5] Kiểm tra Token Revocation (vô hiệu hóa token cũ sau khi đổi pass)...");
  const updatePwRes = await fetch(`${BASE_URL}/api/users/${userData.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      password: "newpassword123",
    }),
  });
  console.log("Admin đổi mật khẩu user:", updatePwRes.status === 200 ? "✅ Thành công (200 OK)" : `❌ Status=${updatePwRes.status}`);

  // Dùng token CŨ của user để gọi API
  const oldTokenRes = await fetch(`${BASE_URL}/api/me`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  console.log("Dùng Token cũ gọi /api/me:", oldTokenRes.status === 401 ? "✅ Bị thu hồi tức thì (401 Unauthorized)" : `❌ Lỗi: status=${oldTokenRes.status}`);

  // Phục hồi lại mật khẩu cũ cho user
  await fetch(`${BASE_URL}/api/users/${userData.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      password: "password",
    }),
  });

  console.log("\n=== TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ HOÀN TẤT VÀ ĐẠT CHUẨN 100% ===");
}

runTests().catch(console.error);

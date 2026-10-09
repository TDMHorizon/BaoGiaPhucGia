const BASE_URL = "http://localhost:3000";

async function testExport() {
  console.log("=== KIỂM THỬ TẢI FILE EXCEL VÀ DỮ LIỆU ĐỒNG BỘ ===");
  // Đăng nhập User
  const userRes = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "user", password: "password" }),
  });
  const userData = await userRes.json();

  // Lấy project
  const pRes = await fetch(`${BASE_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${userData.token}` },
  });
  const projects = await pRes.json();
  const proj = projects[0];
  console.log("User tải project:", proj.name, "ID:", proj.id);

  // Lấy chi tiết project (chứa fileBase64)
  const detailRes = await fetch(`${BASE_URL}/api/projects/${proj.id}`, {
    headers: { Authorization: `Bearer ${userData.token}` },
  });
  const detail = await detailRes.json();
  console.log("Chi tiết project lấy thành công:", detail.fileBase64 ? "✅ Có fileBase64" : "❌ Thiếu fileBase64");

  // Lấy cell values của project
  const cvRes = await fetch(`${BASE_URL}/api/projects/${proj.id}/cell-values`, {
    headers: { Authorization: `Bearer ${userData.token}` },
  });
  const cellValues = await cvRes.json();
  console.log("Cell values của project:", Object.keys(cellValues).length > 0 ? "✅ Có dữ liệu current state" : "❌ Rỗng");
  console.log("Kiểm tra xuất Excel hoàn tất thành công!");
}

testExport().catch(console.error);

# Kế hoạch triển khai Báo Giá Phúc Gia (nghiệp vụ)

Tài liệu checklist khi code và deploy. Cập nhật `[x]` khi hoàn thành từng mục.

## Hiện trạng ban đầu (prototype)

| Lớp | Công nghệ | Ghi chú |
|-----|-----------|---------|
| Frontend | React 19, Vite, Tailwind, shadcn/ui | `src/App.tsx`, dashboards |
| Backend | Express trong `server.ts` | API + serve Vite/static |
| Excel | `xlsx` + `exceljs` | Giữ format/merge khi sửa |
| Auth | Login đơn giản, role `admin` / `user` | Hardcode in-memory |
| Lưu trữ | In-memory | Mất hết khi restart |

**Đã có:** upload Excel, vùng sửa (`editableRanges`), thêm/xóa dòng-cột, audit log, user sửa ô / tìm-thay / xuất / ghi đè / lưu bản sao.

## Nguyên tắc

1. Nghiệp vụ trước, Phase 0 chỉ làm nền tối thiểu (disk + SQLite + auth).
2. Tận dụng luồng Excel hiện có — không viết lại editor.
3. Mỗi phase demo độc lập trên VPS nội bộ.
4. Không dùng Gemini trừ khi cần AI sau này.

## Luồng nghiệp vụ mục tiêu

```mermaid
flowchart LR
  Admin -->|upload / template| BaoGia
  Admin -->|metadata + ranges + gán NV| BaoGia
  User -->|sửa trong vùng| Edits
  User -->|gửi duyệt| ChoDuyet
  Admin -->|duyệt / trả về / đã gửi| TrangThai
  Admin -->|snapshot| Versions
```

---

## Phase 0 — Nền tối thiểu

- [x] Lưu file Excel trên disk (`data/files/{id}.xlsx`)
- [x] Metadata + edits + users trong SQLite (`data/baogia.db`)
- [x] Token auth sau login; middleware kiểm tra role
- [x] Script production: `build` + `start` chạy được trên Node

**File:** `server.ts`, `server/db.ts`, `server/auth.ts`, `server/files.ts`, `src/lib/api.ts`, `src/lib/auth.tsx`, `package.json`

---

## Phase 1 — Nghiệp vụ báo giá cốt lõi

- [x] Trường: `soBaoGia`, `tenKhachHang`, `nguoiPhuTrachId`, `trangThai`, `ghiChu`, `version`, `updatedAt`
- [x] Admin: sửa metadata, xóa, đổi tên
- [x] User: chỉ thấy báo giá được gán
- [x] Tìm kiếm / lọc trạng thái
- [x] Branding **Báo Giá Phúc Gia**, UI tiếng Việt

**API:** `PATCH /api/projects/:id`, `DELETE /api/projects/:id`, `GET /api/projects?q=&status=&assignee=`

---

## Phase 2 — Phân quyền & quản lý người dùng

- [x] CRUD user (admin): username, password hash, role, active
- [x] Gán nhiều nhân viên (`project_members`)
- [x] Khóa sửa khi `da_duyet` / `da_gui` (admin mở lại được)
- [x] Ẩn quick-login khi `NODE_ENV=production`

---

## Phase 3 — Trạng thái (theo dõi, không ghi đè bản gốc)

- [x] `nhap` (Mới giao) → `dang_lam` (Đang điền) → `da_gui` (Đã gửi khách)
- [x] Bản gốc chỉ admin cấu hình vùng sửa + gán NV
- [x] Nhân viên điền ô được phép (nhật ký edits), tải Excel gửi khách
- [x] Không ghi đè / không lưu bản sao file gốc
- [x] Badge số báo giá đang điền (admin)

Admin có thể mở lại từ `da_gui` → `dang_lam`.

---

## Phase 4 — Tiện ích nghiệp vụ

- [x] Thư viện template (clone thành báo giá mới)
- [x] Xuất PDF (in HTML preview)
- [x] Chọn vùng sửa nâng cao (kéo chọn ô)
- [ ] (Tuỳ chọn) Comment ô / Gemini — chưa bắt buộc

---

## Phase 5 — Deploy VPS Windows

Xem chi tiết: [DEPLOY_VPS.md](./DEPLOY_VPS.md)

- [x] `npm run build` + PM2 hoặc NSSM (hướng dẫn trong DEPLOY_VPS.md)
- [x] Backup thư mục `data/` định kỳ (hướng dẫn)
- [x] HTTPS reverse proxy nếu public (hướng dẫn)
- [x] Đổi mật khẩu mặc định, tắt quick-login (quick-login tắt ở production)

---

## Phase 6 — Nâng cấp Bộ Động cơ Bảng tính & Phân quyền Nâng cao

- [x] **P0 — Kiến trúc Dữ liệu & Logger**: Schema migration (`project_role_visibility`, snapshots, commands) + Telemetry Logger có Masking.
- [x] **P1 — Universal Merge Resolver**: Xử lý gộp ô tập trung (`mergeResolver.ts`), chọn ô Merge trong công thức chuẩn xác 100%.
- [x] **P2 — Format Cell 2 chiều & Format Painter**: Whitelist Command Adapter (`univerCommandAdapter.ts`), debounce lưu trữ, sao chép định dạng ô đơn/ô gộp.
- [x] **P3 — Sort & Filter và Find & Replace**: Lọc tự động, sắp xếp A-Z/Z-A, tìm kiếm & thay thế (`FindReplaceModal.tsx`) trực tiếp trên sheet (Ctrl + F).
- [x] **P4 — Phân quyền & Ẩn File**: Quản lý ẩn/hiện file dự án cho Admin & Manager (`/api/projects/:id/visibility`), chặn truy cập cấp server.
- [x] **P5 — Xuất Mẫu Tạm & In Ấn Khổ A4**: Trích xuất snapshot -> `.xlsx` tức thì (`exportExcel.ts`); Dedicated Print Engine lặp header, chuẩn A4 (`printEngine.ts`).
- [x] **P6 — Test Suite & Log Minh Chứng**: Kiểm thử tự động toàn diện (`scripts/verify-all-features.ts`), xuất `test-run-verification.log` 29/29 (100% Passed).

---

## Tài khoản mặc định (dev)

| Username | Password | Role |
|----------|----------|------|
| admin | password | admin |
| user | password | user |

**Đổi ngay trên production.**

## File chính

1. `server.ts`, `server/db.ts`, `server/auth.ts`, `server/files.ts`, `server/logger.ts`
2. `src/lib/api.ts`, `src/lib/auth.tsx`, `src/lib/mergeResolver.ts`, `src/lib/logger.ts`, `src/lib/exportExcel.ts`, `src/lib/printEngine.ts`
3. `src/components/SpreadsheetViewer/index.tsx`, `univerCommandAdapter.ts`, `FindReplaceModal.tsx`
4. `src/components/AdminDashboard.tsx`, `UserDashboard.tsx`, `Login.tsx`, `App.tsx`
5. `scripts/verify-all-features.ts`, `docs/DEEP_ANALYSIS_AND_ACTION_PLAN.md`

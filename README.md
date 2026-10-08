# Hệ Thống Quản Lý Báo Giá - Phúc Gia

Hệ thống quản lý báo giá và tạo form nhập liệu Excel nội bộ.

## Chức Năng Chính
- Đăng nhập và phân quyền người dùng (Admin, Manager, User).
- Quản lý danh sách dự án, báo giá.
- Hỗ trợ tạo và chỉnh sửa form điền liệu Excel trực tiếp.
- Lưu trữ lịch sử chỉnh sửa và tải về file báo giá hoàn thiện.

## Cài Đặt & Khởi Chạy (Local)

**Yêu cầu:** Node.js

1. Cài đặt các thư viện cần thiết:
   ```bash
   npm install
   ```

2. Khởi chạy dự án:
   ```bash
   npm run dev
   ```

Dự án sẽ tự động chạy song song Backend (API) và Frontend tại địa chỉ http://localhost:3000.

ADMIN / MANAGER
       │
       ▼
Tạo / Upload file Excel
       │
       ▼
Tạo Project Báo Giá
       │
       ├── số báo giá
       ├── khách hàng
       ├── người phụ trách
       ├── thành viên
       ├── ghi chú
       │
       ▼
Admin / Manager chỉ định
những ô / cột được phép sửa
       │
       ▼
editableRanges
       │
       ▼
Giao Project cho nhân viên
       │
       ▼
nhap = Mới giao
       │
       ▼
Nhân viên bắt đầu
       │
       ▼
dang_lam
       │
       ▼
Nhân viên sửa các ô được phép
       │
       ├───────────────┐
       │               │
       ▼               ▼
Hiển thị mới       INSERT edits
trên browser       vào database
                       │
                       ├── ai sửa
                       ├── sheet nào
                       ├── ô nào
                       ├── giá trị cũ
                       ├── giá trị mới
                       └── thời gian
       │
       │
       ▼
File Excel gốc trên server
VẪN KHÔNG THAY ĐỔI
       │
       ▼
Nhân viên hoàn thành
       │
       ▼
File gốc + Edit Log
       │
       ▼
Sinh Workbook hoàn chỉnh
       │
       ▼
Download Excel
       │
       ▼
Gửi khách
       │
       ▼
da_gui
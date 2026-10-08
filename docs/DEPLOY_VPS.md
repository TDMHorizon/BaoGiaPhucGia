# Deploy Báo Giá Phúc Gia lên VPS Windows

## Yêu cầu

- Node.js 20+ (khuyến nghị 22 LTS)
- Quyền ghi thư mục ứng dụng (tạo `data/`)

## Cài đặt lần đầu

```powershell
cd D:\path\to\BaoGiaPhucGia
npm install
npm run build
```

Tạo file `.env` (hoặc biến môi trường hệ thống):

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=doi-chuoi-bi-mat-dai-va-ngau-nhien
```

## Chạy production

```powershell
npm start
```

Ứng dụng lắng nghe `http://0.0.0.0:3000`.

## PM2 (khuyến nghị)

```powershell
npm install -g pm2
pm2 start npm --name baogia -- start
pm2 save
pm2 startup
```

## NSSM (Windows Service)

1. Cài [NSSM](https://nssm.cc/)
2. `nssm install BaoGiaPhucGia`
3. Path: đường dẫn `node.exe` hoặc `npx.cmd`
4. Arguments: `tsx server.ts` (hoặc `npm start`)
5. AppDirectory: thư mục project
6. Environment: `NODE_ENV=production`, `JWT_SECRET=...`, `PORT=3000`

## Dữ liệu & backup

| Đường dẫn | Nội dung |
|-----------|----------|
| `data/baogia.db` | SQLite (users, projects, edits, versions, templates) |
| `data/files/` | File Excel hiện tại |
| `data/versions/` | Snapshot khi duyệt |
| `data/templates/` | File template |

Backup định kỳ cả thư mục `data/` (Task Scheduler copy sang ổ khác mỗi ngày).

## Bảo mật

1. Đổi mật khẩu `admin` / `user` ngay sau khi lên production.
2. Quick-login **tự tắt** khi `NODE_ENV=production`.
3. Đặt `JWT_SECRET` mạnh, không commit vào git.
4. Nếu public internet: đặt reverse proxy HTTPS (IIS / Caddy / nginx) trước cổng 3000.
5. Chỉ mở firewall cho cổng proxy (443), không mở thẳng 3000 nếu không cần.

## Cập nhật phiên bản mới

```powershell
cd D:\path\to\BaoGiaPhucGia
git pull
npm install
npm run build
pm2 restart baogia
```

Thư mục `data/` giữ nguyên — không xóa khi deploy.

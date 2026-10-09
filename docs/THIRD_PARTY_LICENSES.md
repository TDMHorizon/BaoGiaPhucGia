# Quyết định giấy phép phần mềm bên thứ ba

Tài liệu này ghi nhận các quyết định đã được duyệt cho dependency của dự án.
Việc ghi nhận không thay thế việc kiểm tra giấy phép và dependency bắc cầu khi
nâng cấp phiên bản.

## Giấy phép được chấp nhận

Các nhóm giấy phép được chấp nhận theo quyết định hiện tại:

- MIT
- Apache-2.0
- BSD (các biến thể BSD)
- ISC
- 0BSD
- Unlicense
- CC0

Các giấy phép sau được chấp nhận theo điều kiện đã duyệt:

| Package/nhóm | Giấy phép | Điều kiện/quyết định |
| --- | --- | --- |
| `lightningcss` | MPL-2.0 | Chấp nhận vì chỉ là công cụ build; không sửa mã nguồn của package. |
| `@fontsource-variable/*` và font liên quan | OFL-1.1 | Chấp nhận theo quyết định của dự án. |
| `caniuse-lite` | CC-BY-4.0 | Chấp nhận theo quyết định của dự án. |
| `@blueoak` packages | BlueOak-1.0.0 | Chấp nhận theo quyết định của dự án. |
| `pako` | Zlib | Chấp nhận theo quyết định của dự án. |
| `jszip` | MIT | Chọn nhánh/bản phát hành mang giấy phép MIT. |
| `expand-template` | MIT | Chọn nhánh/bản phát hành mang giấy phép MIT. |
| `vitest@3.2.7` và dependency bắc cầu được khóa trong `package-lock.json` | MIT, Apache-2.0, ISC, BSD-3-Clause | Đã rà dependency tree của Vitest; các giấy phép phát hiện đều thuộc nhóm được chấp nhận. |

## Dependency cần theo dõi

| Package | Tình trạng | Hành động |
| --- | --- | --- |
| `buffers@0.1.1` | Chưa xác định giấy phép; tạm chấp nhận theo quyết định của dự án do chưa thấy trong bundle chạy phía trình duyệt. | Kiểm tra lại dependency tree, repo gốc và giấy phép khi nâng cấp `exceljs`; không coi tình trạng này là đã xác minh giấy phép. |
| `xlsx@0.18.5` | Có CVE-2023-30533 đã được báo cáo; phương án xử lý đang chờ người dùng duyệt. | Chưa thay phiên bản hoặc parser cho đến khi có quyết định riêng. |

## Không chấp nhận

Không thêm dependency có giấy phép GPL, AGPL, SSPL, BUSL hoặc giấy phép
phi thương mại. MPL-2.0, LGPL, OFL, CC-BY và BlueOak chỉ được chấp nhận theo
điều kiện/duyệt riêng đã nêu, không được hiểu là chấp thuận chung cho mọi
dependency dùng các giấy phép này.

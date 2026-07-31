# Hướng Dẫn Tùy Chỉnh Giao Diện Bảng Tính (Dành cho UI Developer)

Thư mục này (`SpreadsheetViewer`) chứa toàn bộ mã nguồn giao diện của bảng tính. Các thành phần logic kết nối API và xử lý quyền đã được tách rời hoàn toàn ra bên ngoài (ở `UserDashboard` và `AdminDashboard`).

Có thể tự do thay đổi cấu trúc HTML (`div`, `span`, `table`) và các class Tailwind bên trong thư mục này. Tuy nhiên, **TUYỆT ĐỐI KHÔNG ĐƯỢC** đổi tên, xóa, hoặc thay đổi kiểu dữ liệu của các Props dưới đây để tránh làm gãy kết nối với hệ thống lõi.

---

## 1. Props đầu vào (Dữ liệu từ Server chảy vào UI)

Dữ liệu được truyền vào thông qua `SpreadsheetViewerProps` ở file `index.tsx`.

```typescript
export interface SpreadsheetViewerProps {
  // 1. Dữ liệu lõi (Không được can thiệp sửa đổi trực tiếp)
  workbook: XLSX.WorkBook | null;           // Chứa định dạng chuẩn của thư viện SheetJS
  exceljsWorkbook: ExcelJS.Workbook | null; // Chứa định dạng style của thư viện ExcelJS
  sheetData: any[][];                       // Mảng 2 chiều chứa giá trị text/số của từng ô
  activeSheet: string;                      // Tên của sheet đang mở (VD: "BaoGia")

  // 2. Trạng thái hiển thị & Phân quyền
  mode: 'user' | 'admin';         // Nếu 'user' -> Mở chế độ nhập liệu; Nếu 'admin' -> Mở chế độ kéo thả bôi đen
  locked?: boolean;               // (Chỉ dùng cho user) Báo giá đã bị khóa chưa? Nếu true -> Cấm mọi thao tác sửa.
  editableRange?: string;         // Chuỗi tọa độ các ô được phép sửa (VD: "B5:D10, F2:F20")
  
  // 3. Trạng thái lựa chọn hiện hành
  selectedRange?: string;         // (Chỉ dùng cho admin) Vùng đang được kéo bôi đen
  selectedColumn?: number | null; // (Chỉ dùng cho user) Cột đang được click chọn (index 0, 1, 2...)
  previewLimit?: number;          // Giới hạn số dòng hiển thị để tránh lag
}
```

## 2. Các hàm Callbacks (Giao tiếp từ UI gửi ngược về Server)

Mỗi khi người dùng tương tác trên UI, giao diện **phải gọi đúng** các hàm này để hệ thống lõi lưu vào Database:

```typescript
  // 1. Khi người dùng click vào chữ cái tiêu đề cột (A, B, C...)
  onColumnClick?: (colIndex: number) => void;

  // 2. [QUAN TRỌNG NHẤT] Khi người dùng gõ xong dữ liệu vào 1 ô và ấn Enter / Click ra ngoài
  // r: Hàng (bắt đầu từ 0)
  // c: Cột (bắt đầu từ 0)
  // newValue: Giá trị chữ mới vừa nhập
  onCellEdit?: (r: number, c: number, newValue: string) => void;

  // 3. Các hàm phục vụ cho tính năng Kéo-Thả vùng chọn của Admin
  onCellMouseDown?: (r: number, c: number) => void; // Khi bấm chuột xuống 1 ô
  onCellMouseEnter?: (r: number, c: number) => void; // Khi rê chuột ngang qua 1 ô
```

## 3. Quản lý State Nội bộ trong `Cell.tsx`

Khi thiết kế lại ô nhập liệu (Textarea/Input), hãy chú ý file `Cell.tsx` sử dụng state nội bộ để giới hạn phạm vi re-render (tránh lag toàn bộ bảng):

```typescript
const [isEditing, setIsEditing] = useState(false); // Đang bật chế độ gõ chữ hay không?
const [editValue, setEditValue] = useState(value); // Giá trị chữ đang gõ tạm thời
```

- **Khi `isEditing === true`**: Hiển thị thẻ `<textarea>` hoặc `<input>`.
- **Khi `isEditing === false`**: Hiển thị thẻ `<span>` chứa giá trị tĩnh.
- Khi sự kiện `onBlur` (mất focus) hoặc ấn phím `Enter` xảy ra, **bắt buộc** phải gọi hàm `handleSave()` bên trong file đó để kích hoạt callback `onCellEdit`.

## 4. Quản lý Màu sắc và CSS Phức tạp

Toàn bộ các quy tắc tính toán màu nền (VD: màu xanh cho ô được quyền sửa), gộp ô (merge cells), in đậm/nghiêng từ file Excel sang CSS web được xử lý tại:
 `utils/styleCalculator.ts`

Nếu bạn muốn thay đổi màu sắc hệ thống (ví dụ đổi mã màu xanh `#ecfdf5` thành màu khác), hãy sửa trực tiếp trong file này.

---
 **Lời khuyên**: Nếu dự án muốn chuyển sang sử dụng các thư viện bảng tính nâng cao (như `ag-grid`, `react-data-grid`, hay `handsontable`) thay thế cho thẻ `<table>` truyền thống, bạn chỉ cần cấu hình các Props và Callbacks kể trên khớp với API của thư viện mới. Kiến trúc hệ thống sẽ không bị ảnh hưởng!

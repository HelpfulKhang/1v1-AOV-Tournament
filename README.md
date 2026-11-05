# AOV Solo 1v1

Website hỗ trợ tổ chức và điều khiển các trận solo 1v1 Liên Quân Mobile,
bao gồm chọn Pool tướng, random tướng theo thể thức BO7, hiển thị
gameplay từ điện thoại và ghi hình trận đấu bằng OBS.

## 1. Yêu cầu

-   Node.js (khuyến nghị bản LTS).
-   npm.
-   Trình duyệt Chrome hoặc trình duyệt Chromium tương thích.
-   OBS Studio và ApowerMirror nếu muốn hiển thị, ghi hình gameplay từ
    điện thoại.

## 2. Cài đặt và chạy dự án

Clone repository về máy:

``` bash
git clone <repository-url>
cd <repository-folder>
```

Cài đặt các thư viện:

``` bash
npm install
```

Khởi chạy môi trường phát triển:

``` bash
npm run dev
```

Mở địa chỉ Local mà Vite hiển thị trong terminal (thường là
`http://localhost:5173`).

> Nếu repository sử dụng scripts hoặc cấu hình npm khác, hãy kiểm tra
> mục `scripts` trong `package.json`.

## 3. Cập nhật asset tướng

Khi cần đồng bộ hoặc cập nhật hình ảnh/dữ liệu tướng, chạy script
`syncHeroes.js` nằm trong thư mục `scripts`:

``` bash
node scripts/syncHeroes.js
```

**Cách thực hiện:**

1.  Mở terminal tại thư mục gốc của repository (thư mục chứa
    `package.json`).
2.  Đảm bảo đã cài dependencies bằng `npm install`.
3.  Chạy lệnh `node scripts/syncHeroes.js`.
4.  Chờ script chạy hoàn tất và kiểm tra các asset/dữ liệu tướng được
    cập nhật trong thư mục mà script cấu hình.
5.  Chạy lại hoặc tải lại website để kiểm tra danh sách và hình ảnh
    tướng.

Nên chạy script này khi muốn làm mới asset tướng hoặc sau khi cập nhật
mã nguồn liên quan đến dữ liệu tướng. Nếu script báo lỗi, kiểm tra thông
báo trong terminal, kết nối mạng (nếu script cần tải dữ liệu) và quyền
ghi vào thư mục asset.

> Lưu ý: Hãy chạy lệnh từ thư mục gốc của project để các đường dẫn tương
> đối trong script được xác định đúng. Không nên tự ý đổi tên hoặc di
> chuyển thư mục asset nếu chưa cập nhật các đường dẫn mà ứng dụng đang
> sử dụng.

## 4. Sử dụng website

1.  Mở website bằng địa chỉ local do Vite cung cấp.
2.  Mỗi tuyển thủ chọn Pool gồm 5 tướng theo giao diện.
3.  Bắt đầu trận và thực hiện các bước tung đồng xu/random tướng theo
    hướng dẫn trên màn hình.
4.  Sử dụng nút **Luật thi đấu** để xem thể thức và quy định.
5.  Sau mỗi ván, nhập kết quả để hệ thống xác định lượt random tiếp
    theo.

### Thể thức BO7

-   Ván 1: Tung đồng xu để xác định tuyển thủ được random trước.
-   Ván 2--6: Người thua ván trước được random một tướng từ Pool của
    mình.
-   Ván 7 (chỉ khi tỷ số hòa 3--3): Gộp các tướng còn lại của hai Pool
    thành một Pool chung để random.
-   Tuyển thủ đạt 4 ván thắng trước sẽ thắng trận.

## 5. Hiển thị điện thoại trong website

Để đưa màn hình điện thoại vào khung gameplay trên website:

1.  Dùng ApowerMirror để chiếu điện thoại Android lên máy tính.
2.  Trong OBS, tạo một scene riêng (ví dụ `PHONE`).
3.  Thêm **Window Capture** và chọn cửa sổ ApowerMirror.
4.  Nhấn **Start Virtual Camera** trong OBS.
5.  Quay lại website, mở màn hình gameplay và nhấn nút kết nối **OBS
    Virtual Camera**.
6.  Cho phép trình duyệt truy cập camera nếu được hỏi.

Nếu trình duyệt không tìm thấy OBS Virtual Camera, hãy kiểm tra OBS
Virtual Camera đã khởi động chưa và trình duyệt có quyền truy cập camera
không. Truy cập camera thường cần chạy website trên `localhost` hoặc
HTTPS.

## 6. Ghi hình website bằng OBS

Để ghi cả giao diện website lẫn màn hình điện thoại đang hiển thị bên
trong website:

1.  Giữ OBS Virtual Camera hoạt động từ scene `PHONE`.
2.  Tạo scene OBS khác (ví dụ `RECORD WEB`).
3.  Thêm **Window Capture** và chọn cửa sổ trình duyệt đang mở website.
4.  Thiết lập độ phân giải Canvas và Output là `1920×1080` trong
    **Settings → Video**.
5.  Chọn scene `RECORD WEB` và nhấn **Start Recording**.

Scene `PHONE` chỉ nên capture cửa sổ ApowerMirror. Không đưa cửa sổ
trình duyệt vào scene cấp Virtual Camera để tránh hiệu ứng lặp hình
(feedback loop). Khi chuyển sang scene `RECORD WEB`, không cần tắt
Virtual Camera.

## 7. Cấu trúc thư mục tham khảo

``` text
project/
├─ public/
│  └─ assets/
│     └─ heroes/
├─ scripts/
│  └─ syncHeroes.js
├─ src/
│  ├─ App.jsx
│  └─ App.css
├─ package.json
└─ README.md
```

Cấu trúc thực tế có thể khác tùy phiên bản repository. Hãy giữ nguyên
các đường dẫn asset mà ứng dụng và script đang sử dụng.

## 8. Một số lỗi thường gặp

-   **Không tải được hình tướng:** chạy lại
    `node scripts/syncHeroes.js`, kiểm tra thư mục asset và tải lại
    website.
-   **Không kết nối được OBS Virtual Camera:** kiểm tra Virtual Camera
    đã được bật, cấp quyền camera cho trình duyệt và thử tải lại trang.
-   **Không thấy hình điện thoại:** kiểm tra ApowerMirror đang chiếu,
    OBS đang capture đúng cửa sổ và scene Virtual Camera không bị thay
    đổi.
-   **Lệnh npm không chạy:** kiểm tra đã cài Node.js/npm và đang đứng ở
    thư mục gốc của repository.

------------------------------------------------------------------------

Dự án được xây dựng bằng React và Vite. Chúc bạn có những trận solo vui
vẻ!

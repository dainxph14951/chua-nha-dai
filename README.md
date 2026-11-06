# 🪷 Chùa Hà Online 3D · Cầu duyên

Đi chùa Hà online trong chánh điện 3D. Chọn pháp danh và màu áo, đi lại giữa các hàng bồ đoàn, rồi:

- 🙇 **Lạy Phật**: 3 lạy, kèm tiếng chuông
- 📿 **Tràng hạt**: lần đủ 108 hạt, có chế độ tự lần
- 🪘 **Tụng kinh**: gõ mõ, chữ "Nam mô A Di Đà Phật" bay lên
- 🧘 **Thiền**: ngồi bồ đoàn, quanh người có vầng hào quang
- 🪷 **Dâng lễ**: hoa sen, mâm quả, hương, nến hiện lên bàn thờ
- 🎋 **Cầu duyên**: viết sớ khấn, xin quẻ duyên (14 quẻ), gieo âm dương
- 💼 **Quẻ công việc**: chọn tab Công việc trong mục Cầu duyên, rút một trong 30 quẻ có thơ, lời giải, gợi ý hành động và thời điểm, có nút sao chép kết quả.

Rút quẻ cầu duyên yêu cầu **đủ 50 công đức**, không trừ điểm. Khi chưa đủ, bấm tab Cầu duyên hoặc nút rút quẻ sẽ hiện thông báo ngang màn hình, kèm điểm hiện có và điểm còn thiếu. Khấn và quẻ công việc vẫn dùng được khi chưa đủ 50 công đức.

Làm thêm việc gì cũng được cộng công đức. Đủ công đức thì thăng cấp "Hạt sen · bậc N". Mọi người kết nối cùng máy chủ đều vào **một phòng chung**: thấy nhân vật của nhau, đồng bộ vị trí, trang phục, trạng thái ngồi/lạy/thiền và trò chuyện qua nút 💬. Số người trong chùa là số kết nối thật. Có thêm 10 phật tử mô phỏng đi lại, tụng kinh, khấn bái và 3 ni cô cầm chổi quét dọn; họ có nhãn “Mô phỏng”, không tham gia chat, không tính vào số online hay bảng công đức. Các nhân vật mô phỏng hoạt động riêng trên từng trình duyệt.

**Bảng công đức** nằm bên trái cạnh ban thờ: xếp hạng 5 người đang trong phòng có công đức cao nhất, hiển thị tên và số công đức. Bảng tự cập nhật khi điểm thay đổi hoặc có người vào/rời phòng; dòng của bạn được tô sáng nếu vào top 5. Công đức vẫn lấy từ dữ liệu lưu trên trình duyệt, chưa có xác thực chống gian lận điểm.

**Bảng cột mốc** nằm bên phải cạnh ban thờ, đánh dấu những mốc bạn đã đạt. Bấm 🏅 để xem tiến độ và sử dụng phần thưởng:

| Công đức | Danh hiệu | Phần thưởng cộng dồn |
|---|---|---|
| 1.000 | Tâm An | Áo sen ngọc, cánh sen bay khi lạy, huy hiệu dưới tên |
| 2.000 | Duyên Lành | Hào quang nhẹ và động tác chắp tay chào |
| 3.000 | Thiện Tâm | Viết lời nguyện và thả hoa đăng trên hồ sen bên phải cuối chùa |
| 4.000 | Sen Vàng | Áo sen vàng, hào quang hoa sen và nghi thức dâng đèn trước Phật |

Mở khóa không trừ điểm. Mốc đã đạt lưu riêng trên trình duyệt và được giữ khi tải lại trang. Xóa dữ liệu trình duyệt hoặc chuyển thiết bị sẽ không mang theo phần thưởng; hiện chưa có tài khoản để đồng bộ lâu dài. Áo, danh hiệu, hào quang và lời chào được đồng bộ cho người trong phòng. Hoa đăng/lễ đèn hiển thị chung trong 90 giây, giới hạn 20 lễ vật; máy chủ giữ các nghi thức gần nhất để người mới vào vẫn thấy, và giới hạn một nghi thức mỗi 10 giây cho mỗi phiên. Lời nguyện đi kèm hoa đăng là công khai trong phòng.

## Chạy

Cần **Node.js 20 trở lên**, không cần cài thư viện hay build:

```bash
npm start
# mở http://localhost:8000
```

Mở hai tab, nhập tên khác nhau và bấm **Vào chùa** để thử gặp nhau và gửi tin nhắn bằng nút 💬. Trên điện thoại/máy khác cùng Wi-Fi, mở `http://<IP-LAN-của-máy-chủ>:8000` (cho phép cổng này qua tường lửa nếu cần). Tất cả phải truy cập cùng máy chủ.

Nếu cổng 8000 đang được dùng:

```bash
PORT=8001 npm start
```

Để dùng qua Internet, triển khai toàn bộ dự án trên hosting chạy được Node.js, chạy `npm start`, đặt biến `PORT` theo hosting. Chạy **một tiến trình máy chủ** để mọi người ở cùng phòng; dữ liệu phòng hiện nằm trong bộ nhớ của tiến trình. Proxy cần cho phép kết nối SSE lâu dài, tắt buffering cho `/api/events` và đặt thời gian chờ lớn hơn 15 giây. **GitHub Pages và `python3 -m http.server` chỉ phục vụ trang tĩnh, không hỗ trợ phòng chung/chat này.**

Máy chủ phát trạng thái phòng tối đa 10 lần/giây, giữ 50 tin gần nhất để người mới vào đọc, giới hạn lời nhắn 240 ký tự và một tin/giây cho mỗi phiên. Mất mạng sẽ tự kết nối lại; tin chưa gửi vẫn nằm trong ô nhập. Tin nhắn và trạng thái phòng mất khi khởi động lại máy chủ, còn công đức lưu riêng trên trình duyệt. Chưa có đăng nhập hoặc chat riêng.

Kiểm tra máy chủ (hai kết nối thật, đồng bộ, chat, kết nối lại và kiểm tra dữ liệu):

```bash
npm test
```

## Điều khiển

| | Máy tính | Điện thoại |
|---|---|---|
| Đi | W A S D / mũi tên | Cần điều khiển góc trái |
| Xoay camera | Kéo chuột | Vuốt màn hình |
| Zoom | Con lăn | Chụm 2 ngón / nút ＋ － |
| Ngồi / đứng | E | Nút "Ngồi xuống" |
| Lần hạt | Space | Nút "Lần hạt" |

## Cấu trúc

- `index.html`: giao diện và các hộp thoại
- `style.css`: giao diện HUD
- `game.js`: cảnh 3D (Three.js), nhân vật chibi, người chơi từ xa, giao diện chat, âm thanh và logic công đức/quẻ
- `room.js`: kết nối phòng chung, đồng bộ và tự kết nối lại
- `milestones.js`: bốn cột mốc, điều kiện mở khóa trang phục và nghi thức
- `server.mjs`: máy chủ HTTP, phòng chung realtime qua SSE, API cập nhật nhân vật và chat
- `server.test.mjs`: kiểm thử tích hợp máy chủ
- `lib/`: Three.js r160, để sẵn trong repo nên không phụ thuộc CDN

Mọi mô hình đều dựng từ khối hình học trong code, không có file 3D hay ảnh nào bên ngoài.

## Hướng phát triển

- Lưu lịch sử chat lâu dài, đăng nhập và công cụ quản lý phòng.
- Đồng bộ phòng qua kho dữ liệu chung khi cần chạy nhiều tiến trình/máy chủ.
- Sân chùa ngoài trời, linh thú, cửa hàng vật phẩm, bảng vàng công đức.

> Trang mang tính giải trí. Muốn linh hơn thì ghé chùa Hà thật ở phố Chùa Hà, Cầu Giấy, Hà Nội 🙏

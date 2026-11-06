# 🪷 Chùa Hà Online 3D · Cầu duyên

Đi chùa Hà online trong chánh điện 3D. Chọn pháp danh và màu áo, đi lại giữa các hàng bồ đoàn, rồi:

- 🙇 **Lạy Phật**: 3 lạy, kèm tiếng chuông
- 📿 **Tràng hạt**: lần đủ 108 hạt, có chế độ tự lần
- 🪘 **Tụng kinh**: gõ mõ, chữ "Nam mô A Di Đà Phật" bay lên
- 🧘 **Thiền**: ngồi bồ đoàn, quanh người có vầng hào quang
- 🪷 **Dâng lễ**: hoa sen, mâm quả, hương, nến hiện lên bàn thờ
- 🎋 **Cầu duyên**: viết sớ khấn, xin quẻ duyên (14 quẻ), gieo âm dương

Làm thêm việc gì cũng được cộng công đức. Đủ công đức thì thăng cấp "Hạt sen · bậc N". Mọi người kết nối cùng máy chủ đều vào **một phòng chung**: thấy nhân vật của nhau, đồng bộ vị trí, trang phục, trạng thái ngồi/lạy/thiền và trò chuyện qua nút 💬. Số người trong chùa là số kết nối thật, không có bot mô phỏng.

**Bảng công đức** nằm bên trái cạnh ban thờ: xếp hạng 5 người đang trong phòng có công đức cao nhất, hiển thị tên và số công đức. Bảng tự cập nhật khi điểm thay đổi hoặc có người vào/rời phòng; dòng của bạn được tô sáng nếu vào top 5. Công đức vẫn lấy từ dữ liệu lưu trên trình duyệt, chưa có xác thực chống gian lận điểm.

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
- `server.mjs`: máy chủ HTTP, phòng chung realtime qua SSE, API cập nhật nhân vật và chat
- `server.test.mjs`: kiểm thử tích hợp máy chủ
- `lib/`: Three.js r160, để sẵn trong repo nên không phụ thuộc CDN

Mọi mô hình đều dựng từ khối hình học trong code, không có file 3D hay ảnh nào bên ngoài.

## Hướng phát triển

- Lưu lịch sử chat lâu dài, đăng nhập và công cụ quản lý phòng.
- Đồng bộ phòng qua kho dữ liệu chung khi cần chạy nhiều tiến trình/máy chủ.
- Sân chùa ngoài trời, linh thú, cửa hàng vật phẩm, bảng vàng công đức.

> Trang mang tính giải trí. Muốn linh hơn thì ghé chùa Hà thật ở phố Chùa Hà, Cầu Giấy, Hà Nội 🙏

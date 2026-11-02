# 🪷 Chùa Hà Online 3D · Cầu duyên

Đi chùa Hà online trong chánh điện 3D. Chọn pháp danh và màu áo, đi lại giữa các hàng bồ đoàn, rồi:

- 🙇 **Lạy Phật**: 3 lạy, kèm tiếng chuông
- 📿 **Tràng hạt**: lần đủ 108 hạt, có chế độ tự lần
- 🪘 **Tụng kinh**: gõ mõ, chữ "Nam mô A Di Đà Phật" bay lên
- 🧘 **Thiền**: ngồi bồ đoàn, quanh người có vầng hào quang
- 🪷 **Dâng lễ**: hoa sen, mâm quả, hương, nến hiện lên bàn thờ
- 🎋 **Cầu duyên**: viết sớ khấn, xin quẻ duyên (14 quẻ), gieo âm dương

Làm thêm việc gì cũng được cộng công đức. Đủ công đức thì thăng cấp "Hạt sen · bậc N". Trong chùa có khoảng 60 phật tử là bot: họ lạy, thiền, đi lại, và bảng tin chạy liên tục.

## Chạy

Web tĩnh, không cần build. Chạy thử trên máy:

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```

Muốn deploy thì bật GitHub Pages (Settings → Pages → Branch `main`, thư mục `/`).

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
- `game.js`: cảnh 3D (Three.js), nhân vật chibi, bot, âm thanh tạo bằng WebAudio, logic công đức và quẻ
- `lib/`: Three.js r160, để sẵn trong repo nên không phụ thuộc CDN

Mọi mô hình đều dựng từ khối hình học trong code, không có file 3D hay ảnh nào bên ngoài.

## Hướng phát triển

- **Nhiều người chơi thật**: thêm backend realtime (Firebase Realtime DB, Supabase Realtime, Colyseus…) để đồng bộ vị trí, hành động và bảng tin. Lúc đó bot chỉ còn là phần lấp chỗ trống.
- Sân chùa ngoài trời, linh thú, cửa hàng vật phẩm, bảng vàng công đức.

> Trang mang tính giải trí. Muốn linh hơn thì ghé chùa Hà thật ở phố Chùa Hà, Cầu Giấy, Hà Nội 🙏

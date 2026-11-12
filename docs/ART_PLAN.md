# Kế hoạch art, nhạc, giao diện thật

Hiện tại: giao diện đã đổi sang bảng màu mực/xương/đỏ con dấu (v0.19), nhạc là synth tự sinh. Hai thứ không tự nâng lên được bằng code: **art nhân vật/quái/nền** và **nhạc thật**. Tôi (Claude) không có công cụ sinh ảnh/nhạc trong phiên này, nên cần bạn chạy các công cụ dưới đây rồi thả file vào `www/assets/`, hoặc đưa API key qua biến môi trường (không bao giờ commit key vào repo).

## Việc khó nhất: art
| Việc | Công cụ gợi ý | Ghi chú |
|---|---|---|
| Phong cách chung (style bible, 1 ảnh khóa) | Midjourney (mạnh về phong cách) hoặc Gemini/ChatGPT ảnh | Chốt MỘT phong cách trước khi làm 24 tướng + 36 quái: tranh mực + mảng đỏ/vàng, chân dung nửa người |
| 24 chân dung tướng (Form 1) + 24 Form 2 | Model ảnh có "tham chiếu nhân vật" (Gemini ảnh, ChatGPT ảnh, Flux Kontext) | Dùng ảnh khóa làm tham chiếu để cả bộ đồng nhất; Form 2 = sinh từ Form 1 với lệnh "bản thức tỉnh, giữ khuôn mặt/trang phục" |
| Quái 6 khu x (thường, elite, boss) | Cùng quy trình, nền trong suốt | Xuất PNG/WebP 512px, nền trong suốt |
| Nền hub và nền trận | Midjourney/Flux | 1080x1920, sau đó tôi phối màu cho khớp UI |
| Ngọc 6 hệ, icon | Tôi vẽ bằng SVG được (đã có), hoặc nhờ model ảnh | Giữ hình khác nhau cho người mù màu |
| Dọn nền, nén ảnh | Tôi làm bằng script (rembg + cwebp) | Bạn chỉ cần đưa ảnh gốc |

Giấy phép: kiểm điều khoản thương mại của từng công cụ trước khi lên CH Play, lưu lại bằng chứng (gói trả phí, ngày sinh ảnh).

## Nhạc và âm thanh thật
| Việc | Công cụ gợi ý |
|---|---|
| 3 bài nền (hub/battle/boss) + 1 bài thắng | Suno hoặc Udio (gói trả phí có quyền thương mại), hoặc tự phối bằng giọng hát/đàn của bạn rồi tôi ghép loop |
| SFX nâng cấp (đã có bộ CC0) | ElevenLabs Sound Effects hoặc giữ CC0 |

File nhạc đặt `www/assets/audio/music/*.mp3` (loop, 128kbps); tôi sẽ nối vào `audio.js` thay synth.

## Tôi làm được ngay khi có file
Gắn asset vào game, nén, đo dung lượng, cân màu UI theo art, thêm vào precache, kiểm trên điện thoại giả lập.

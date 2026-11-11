# Thiên Tháp Dị Điểm (EN: Rift Spire: Pantheon)

Puzzle RPG kéo ngọc leo tháp. Web thuần (Canvas + JS ES modules, không bundler), sau này đóng gói Capacitor ra .aab.
Nguồn sự thật về thiết kế: `docs/GDD.md` (bản đầy đủ nằm trong Claude Docs, xem link trong file đó).
Khi GDD và prompt mâu thuẫn, hoặc gặp quyết định thiết kế chưa có trong GDD: dừng lại, nêu phương án, hỏi Duy.

## Quy tắc cứng
1. `www/js/core/*` là hàm thuần, xác định: KHÔNG `Math.random`, `Date.now`, DOM. Mọi ngẫu nhiên đi qua `core/rng.js` (seed), trạng thái RNG nằm trong `state.rng`. Có test quét tự động.
2. Số liệu cân bằng, nhân vật, kỹ năng, Duo, khu vực, tỉ lệ rớt nằm trong `www/js/data/*.json`, không viết cứng trong code.
3. Mọi chuỗi hiển thị qua i18n (`www/js/i18n/vi.json`, `en.json`), hai file luôn cùng bộ key.
4. 12 từ khóa hiệu ứng là khóa cứng: Bỏng, Độc, Choáng, Đóng băng, Khiên, Hồi máu, Tăng công, Giảm công, Phản đòn, Xuyên giáp, Khóa ngọc, Miễn nhiễm. Không thêm từ khóa mới.
5. Không trang bị, không rune. Một trục tiến hóa: Level + Thức tỉnh.
6. Không dùng tên, art, âm thanh, code của Tower of Saviors hay game khác. Asset tạm là hình khối màu.
7. Mỗi mốc xong: `npm test` xanh, README cập nhật, commit rõ ràng.
8. Làm từng bước nhỏ, chạy test sau mỗi bước.
9. Không thêm tính năng ngoài phạm vi mốc đang làm.
10. Không đưa keystore, mật khẩu, khóa API vào repo.

## Cấu trúc
- `www/` web app (webDir của Capacitor): `js/core` logic thuần, `js/data` JSON, `js/i18n`, `js/ui` canvas + nhập liệu, `js/save`, `assets/`
- `tests/` node:test, `tools/` script (serve, sau này balance-sim, check-assets), `docs/`

## Lệnh
- `npm test` chạy toàn bộ test
- `npm run serve [cổng]` mở `www/` tại http://localhost:8080

## Mốc
P0 khung dự án (xong) · M1 lõi chiến đấu (xong) · M2 tháp/khu/ải/loot/lưu game (xong) · M3 nhân vật, kỹ năng, Duo, 12 hiệu ứng, Thức tỉnh (xong) · M4 triệu hồi, Tín Vật, onboarding (xong) · M5 art, âm thanh, cân bằng (làm sau) · M6 Capacitor, gói ủng hộ, CH Play (làm sau)

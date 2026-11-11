# Thiên Tháp Dị Điểm

Puzzle RPG kéo ngọc leo tháp (web, sẽ đóng gói Android bằng Capacitor).

## Chạy thử
```
npm run serve      # mở http://localhost:8080 (trên điện thoại: dùng IP máy cùng wifi)
npm test           # test lõi, schema, i18n, fuzz 1000 trận, replay
```
Cần Node 20 trở lên. Không có phụ thuộc ngoài.

## Trạng thái: M1 (lõi chiến đấu)
Chơi được một trận: đội 5 nhân vật mẫu đấu 3 quái. Kéo ngọc trên bàn 6x5 (~5 giây), combo, khắc hệ, hồi máu, kỹ năng chủ động có hồi chiêu (chạm thẻ nhân vật khi hiện "Sẵn sàng").

- Logic thuần, xác định theo seed: `www/js/core` (`battle.js`, `match.js`, `damage.js`, `replay.js`...)
- Mọi trận ghi lại `(seed, danh sách hành động)` và phát lại ra đúng trạng thái cuối (`core/replay.js`)
- Cân bằng chỉnh trong `www/js/data/config.json`, không cần sửa code
- Ô nhập seed ở menu để chơi lại đúng một ván

## Công thức sát thương (M1, chỉnh trong config.json)
`ATK × yếu tố nhóm × hệ số combo × khắc hệ`
- hệ số combo = 1 + 0,25 × (n − 1), n tính theo thứ tự combo trong cả lượt (kể cả cascade)
- yếu tố nhóm = (1 + 0,25 × (số ngọc − 3)) × (1 + 0,25 × số ngọc cường hóa) × (1,5 nếu nhóm ≥ 4 ngọc)
- khắc hệ: Thủy > Hỏa > Mộc > Thủy, Quang ⇄ Ám: ×1,5 / ×0,5
- Tim: hồi = tổng chỉ số hồi của đội × cùng các hệ số nhóm và combo
- Nhóm ≥ 5 ngọc để lại một ngọc cường hóa

Xem `docs/SCHEMA.md` cho cấu trúc dữ liệu, `CLAUDE.md` cho quy tắc dự án.

## M2: tháp, khu vực, ải, loot, lưu game
- Cupola (hub) → chọn khu → chuyến 3–5 ải (2 cửa/ải, ải cuối Elite/Boss) → loot → lưu tự động.
- Lõi: `core/run.js` (máy trạng thái chuyến, replay bằng `playRun`), `core/loot.js`, `core/progress.js`; lưu: `save/` (checksum, bản dự phòng, migrate, xuất/nhập).
- Dữ liệu: `data/zones.json`, `events.json`, `config.json` (run, loot).
- Mô phỏng loot: `node tools/loot-sim.js [N]`.
- Gỡ lỗi: mở `?debug` để dùng `window.__debugWin()`; ô Seed trong "Tùy chọn gỡ lỗi".
- Tạm thời: Khiên là cơ chế riêng cho vật phẩm (M3 thay bằng hiệu ứng Khiên); đội và quái là bản demo; chuyến chưa lưu giữa chừng.

## M3: nhân vật, kỹ năng, Duo, hiệu ứng, Thức tỉnh
- 24 nhân vật (`data/characters.json`), 15 Duo (`data/duos.json`), 12 hiệu ứng (`docs/EFFECTS.md`, `core/effects.js`).
- Leader = ô 1, 4 khuôn mẫu cố định (`atk_element`, `hp_element`, `heal_boost`, `start_cd`). Duo: hai nhân vật liền ô thuộc một cặp.
- Level (Tinh Hoa) và Thức tỉnh 5 bậc (`core/upgrade.js`, chi phí ở `config.upgrade`); ngân sách chỉ số ở `config.budget`, có test.
- Save v3 (thêm `characters`); migrate v2→v3 chuyển đội mẫu cũ sang đội khởi đầu (5 nhân vật 3★).
- UI: Cupola có Bộ sưu tập, chi tiết nhân vật (nâng cấp), Đội hình, Từ khóa; trận có nút Duo, biểu tượng hiệu ứng, ô khóa.
- Cân bằng: `node tools/balance-sim.js [đội/khu] [lượt/đội] [level] [thức tỉnh] [đường thử] [seed]`. Độ khó theo khu ở `config.run.zoneScale`.
- Đã đổi so với M2: Bùa Khiên tạo bể chắn 25% máu đội (thay vì chặn N đòn).

## M4 — Triệu hồi, Tín Vật, onboarding
- `core/summon.js`: rút seed; 5★ 2% / 4★ 13% / 3★ 85%, bảo đảm 5★ ở lượt 60, ≥1 4★ mỗi 10 lượt, rate-up banner văn hóa 50%, trùng → Mảnh, đổi 200 Mảnh lấy nhân vật chưa có. Tỉ lệ thực (tính cả bảo đảm): 5★ 3.15%, 4★ 15.93%, 3★ 80.91% — UI hiện cả hai.
- Tín Vật: lượt đầu bắt buộc 4★ đúng văn hóa đã chọn, không tính vào pity.
- `core/onboarding.js`: tạo phi hành gia (tên, biệt danh, quê tùy chọn, 8 avatar tạm), tặng 1000 Linh Thạch, hướng dẫn trận đầu (bỏ qua được).
- Màn: Nghi Thức Triệu Hồi (xác nhận trước khi tiêu, lịch sử, đổi Mảnh), Nhật ký (7 mục, mở theo khu đã vượt), Cài đặt (ngôn ngữ, âm lượng, xuất/nhập, xóa dữ liệu).
- Save v4 (migrate từ v3). Data mới: `banners.json`, `story.json`.
- E2E: `NODE_PATH=$(npm root -g) node tests/e2e/m4-newplayer.cjs` (cần `npm run serve`).

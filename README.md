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

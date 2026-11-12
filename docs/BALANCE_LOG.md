# BALANCE_LOG

Công cụ: `node tools/balance-sim.js --targets [đội=60] [lượt/đội=2] [đường thử=10] [seed=1]` (máy chơi tham lam: mỗi lượt thử K đường kéo, chọn đường tốt nhất; dùng kỹ năng/Duo khi sẵn sàng). Dải mục tiêu và thời gian chuyến nằm trong `config.json → balance`. Thời gian chuyến = số lượt × 8 giây/lượt (ước lượng người chơi thật), mục tiêu 8–15 phút.

## 2026-11-12 — M5, lần chỉnh đầu
Mục tiêu theo sức mạnh dự kiến mỗi khu (Level/Thức tỉnh đội mẫu 5 nhân vật ngẫu nhiên):

| Khu | Lv/Thức tỉnh | Dải thắng | Trước chỉnh | Sau chỉnh (seed 1 / seed 7, 100 đội) |
|---|---|---|---|---|
| Nước | 1/0 | 85–100% | 100% | 100% / 100% |
| Lửa | 5/0 | 70–90% | 83% | 83% / 89% |
| Mộc | 10/1 | 65–85% | 95% | 79% / 83% |
| Quang | 15/2 | 60–80% | 91% | 73% / 77% |
| Ám | 20/3 | 55–80% | 99% | 69% / 78% |
| Tim | 30/5 | 50–75% | 97% | 68% / 74% |

Thay đổi `run.zoneScale`:
- hp: [1, 1.1, 1.3, 1.55, 1.85, 2.2] → [1, 1.1, 1.8, 2.1, 3.0, 3.3]
- atk: [1, 1.25, 1.5, 1.8, 2.15, 2.5] → [1, 1.25, 2.0, 2.5, 4.1, 5.0]

Thời gian chuyến mô phỏng: 7,0 / 9,0 / 10,4 / 12,8 / 10,5 / 14,6 phút (khu 1 hơi ngắn, chấp nhận vì là khu mở đầu).

### Còn lại / theo dõi
- Hệ Tim (hồi máu) xuất hiện nhiều nhất trong đội thắng khi người chơi chưa nâng cấp (≈43% so với 12–22% các hệ khác); Quang và Ám thấp nhất. Chưa chỉnh: cần dữ liệu người chơi thật, bot tham lam đánh giá hồi máu cao.
- Đội ngẫu nhiên chưa tối ưu; người chơi giỏi sẽ thắng nhiều hơn bot ở khu sau. Cần Duy chơi thử rồi báo cảm giác.
- Chưa chỉnh số mảnh/chi phí Thức tỉnh (loot-sim vẫn đạt 1–2 chuyến/bậc từ M2).

## Cho phép kéo ngọc đi chéo (allowDiagonal = true)
- Duy yêu cầu. Bot mô phỏng giờ cũng đi chéo. Đi chéo làm thắng nhiều hơn: khu Hỏa 83% -> 91%, Mộc 79% -> 84%.
- Chỉnh run.zoneScale.atk: Hỏa 1.25 -> 1.38, Mộc 2.0 -> 2.1. Kết quả: Thủy 100 / Hỏa 88 / Mộc 82 / Quang 74 / Ám 70 / Tim 71 (đều trong dải).

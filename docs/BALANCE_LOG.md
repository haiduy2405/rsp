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

## 2026-11-12: combo kiểu ToS
- `combo.step` 0.25 → 0.5: nhóm thứ n trong một nước kéo nhân (1 + 0,5 × (n − 1)); tổng hệ số của n combo = n + 0,25·n·(n − 1), bằng cách tính "tổng combo × hệ số" của ToS nhưng vẫn tăng dần theo từng nhóm để số đếm nhảy lên mượt.
- Bù lại: `run.zoneScale.hp` [1, 1.1, 1.8, 2.1, 3, 3.3] → [1.2, 1.25, 2.2, 2.6, 3.2, 3.5].
- Kết quả `--targets`: water 100, fire 86, wood 81, light 75, dark 76, heart 73 (cả sáu khu trong dải).

## v0.11: 3 độ khó, 5 tầng, Boss mọi khu
Bố cục mới dài hơn (nhiều trận hơn mỗi chuyến) nên giảm `floorScale` (hp 0.12, atk 0.08) và `zoneScale` (hp [1.15,1.15,1.45,1.85,2.3,2.6], atk [1,1.3,1.6,2.1,3.1,4.2]). Độ khó: Vừa hp×1.2 atk×1.35, Khó hp×1.4 atk×1.65 (sim: đội cộng +4/+8 Level, +1 Thức tỉnh).
Dễ (40 đội x2, K=8): Thủy 99%, Hỏa 74%, Mộc 65%, Quang 75%, Ám 69%, Tim 70%, ~11-15 phút/chuyến, đều trong dải. Vừa/Khó: phần lớn trong dải; Thủy dễ hơn dải (tầng đầu), Khó khu Ám/Tim hơi thấp (~25-30%) vì đội đã chạm trần Level 30/Thức tỉnh 5. Chấp nhận, hiệu chỉnh lại khi có art/chỉ số thật.


## v0.15: Di Vật, bố cục xen kẽ
Nguyên tắc cân bằng (Duy chốt): **làm tính năng thật phê trước, rồi mới chỉnh quái/chỉ số cho hợp. Không nerf để tránh "OP" làm game nhạt.** Hệ quả: Di Vật, kỹ năng bị động, kỹ năng có cấp làm đội mạnh lên rõ rệt, nên mức khó phải tăng ở phía quái.
- Chạy `DIFF=easy node tools/balance-sim.js --targets 24 2 8` sau v0.15: tỉ lệ thắng cao hơn dải mục tiêu ở các khu 2-5 (Hỏa 98%, Mộc 85%, Quang 92%, Ám 83%, Tim 77%), thời gian 8.6-10.4 phút. Việc cần làm ở v0.16: nâng `zoneScale`/quái theo từng khu thay vì giảm sức người chơi.

## v0.16: Đặc tính quái + khó lên
Theo nguyên tắc "buff quái, không nerf người chơi": quái có thêm **đặc tính** (`config.affix`), cuộn khi sinh cửa nên hiện trước ở danh sách cửa và ngay trên quái trong trận.
- 8 đặc tính, mở dần theo khu (`minZone`): Cứng cáp (máu ×1.3), Cuồng nộ (công ×1.3), Giáp Khiên (Khiên 15%), Gai nhọn (Phản đòn 20%), Tái sinh (Hồi máu 2%/lượt), Xuyên giáp (khu 3+), Nhanh nhẹn (đánh sớm 1 lượt, công ×0.85, khu 3+), Bất khuất (Miễn nhiễm, khu 4+). Chỉ dùng 12 từ khóa hiệu ứng sẵn có.
- Xác suất: quái thường 0 + 7%/khu, Bầy 4%/khu, Elite 50% + 6%/khu (tối đa 2), Boss luôn có (tối đa 3); độ khó cộng thêm +12% (Vừa) / +25% (Khó).
- Bài học chỉnh: hồi máu theo % máu tối đa của quái cực mạnh vì mỗi lượt đội chỉ gây ~10% máu tổng. Tái sinh 6% làm chuyến dài gấp 3 (~28 phút), hạ xuống 2% thì về ~10 phút. Khiên 25% cũng hạ 15%.
- `zoneScale`: hp [1.35,1.35,1.5,1.7,2.3,2.6], atk [1.15,1.3,1.5,2.1,3.1,3.8] (Thủy khó hơn, Mộc/Quang/Tim dịu lại để bù đặc tính).
- Kết quả sim (24 đội ×2, K=8): Dễ 98/81/65/75/60/65%, Vừa 96/69/63/63/50/46%, Khó 88/60/50/46/35/31%, đa số trong dải. Còn lệch: Thủy Vừa/Khó hơi dễ, thời gian khu Quang/Tim Vừa-Khó ~19-22 phút (quái nhiều máu + đặc tính).

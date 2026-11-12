# Nhịp tiến triển: tân thủ, trung kỳ, hậu kỳ

Nguyên tắc: tính năng phải đã trước, cân bằng sau (đẩy độ khó lên phía quái, không nerf người chơi). Con số dưới đây là mục tiêu, kiểm bằng `tools/balance-sim.js` và `tools/loot-sim.js`.

| Giai đoạn | Việc chính | Độ khó / khu | Level, Form | Mục tiêu |
|---|---|---|---|---|
| Tân thủ (giờ chơi 0-3) | Học kéo ngọc, đội 3★ khởi đầu, triệu hồi đầu, Tiểu Linh ăn EXP | Dễ, khu Thủy → Hỏa → Mộc | Lv 1-25, Form 1 | Thắng 65-100%, mỗi chuyến 8-15 phút, có Di Vật đầu tiên |
| Trung kỳ (giờ 3-20) | Thức tỉnh Form 2 các tướng chính, nâng kỹ năng bằng Lễ Vật, Duo, đủ 5 hệ | Dễ khu cuối + Vừa | Lv 25-50, Form 2 | Form 2 tướng 3★ sau 3-10 chuyến, 5★ sau 8-24 chuyến (Dễ/Vừa); thắng 45-75% |
| Hậu kỳ (giờ 20+) | Kỹ năng tối đa, đội trưởng chuyên biệt, xây Di Vật, Khó khu Ám/Tim | Khó | Lv 50, Form 2, kỹ năng cấp cao | Thắng 30-60%, Elite/Boss với 2-3 đặc tính, farm Lễ Vật bậc cao (`offeringTier`) |

## Vòng lặp farm
1. Vào khu, chọn đường (3 cửa mỗi tầng, thấy trước quái và đặc tính).
2. Nhặt Vàng, Tinh Hoa, Mảnh, Tinh Thạch, Tiểu Linh, Lễ Vật; Thương nhân/Đền thờ/Elite cho Di Vật (chỉ trong chuyến).
3. Chi tiêu: Tinh Hoa → Level; Mảnh + Tinh Thạch Hiếm + Vàng → Form 2; Lễ Vật + Vàng → cấp kỹ năng.
4. Độ khó cao hơn: quái mạnh và nhiều đặc tính hơn, thưởng nhiều hơn (`difficulty.gold/drop`), nên nâng đội nhanh hơn.

## Công cụ kiểm
- `DIFF=easy|normal|hard node tools/balance-sim.js --targets 24 2 8`: tỉ lệ thắng và thời gian theo bảng `config.balance.targets`.
- `node tools/loot-sim.js [số chuyến]`: số chuyến để đủ nguyên liệu Form 2 (mục tiêu `config.balance.pacing`).
- Hậu kỳ chưa có mốc dữ liệu thật: chỉnh tiếp sau khi Duy chơi thử.

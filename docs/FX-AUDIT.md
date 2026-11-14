# Đánh giá hiệu ứng & animation (v0.119 → v0.120)

## TL;DR
Chiến đấu và các khoảnh khắc "ăn tiền" (triệu hồi, mở rương, nhận thưởng) đã tốt. Chỗ yếu là phần **chuyển màn và giao diện menu**: màn mới hiện cứng, số tiền nhảy giật, nhiều màn không có nhịp xuất hiện. Đợt này sửa nhóm đó bằng code thuần; hiệu ứng chiến đấu giữ nguyên.

## Tốt (giữ)
- **Chiến đấu (canvas):** đạn có vệt sáng, tia/vòng sốc, vết chém theo hệ (Ánh sáng, Bóng tối có dấu riêng), vuốt quái, hit-stop khi hạ quái cuối, slow-motion khi người chơi trúng đòn, rung màn, flash trắng, hạt theo hệ, rung điện thoại theo mức độ.
- **Triệu hồi:** nghi thức pháp trận, lật thẻ theo độ hiếm, flash cho 4-5★, rung riêng 5★.
- **Rương/thưởng:** rương rơi, lắc, mở nắp, tia sáng xoay, số đếm lên từng dòng, pháo giấy/pháo hoa (`fxlayer.js`, `rewardfx.js`).
- **Hub:** tầng cảnh tách lớp, animation chỉ dùng transform/opacity (chạy compositor, không giật).
- **Âm thanh:** có biến thể ngẫu nhiên giảm lặp; nhạc theo cảnh.
- **Hỗ trợ giảm chuyển động:** có ở hầu hết các khối CSS (44 chỗ).

## Chưa tốt (đã xác minh trong code)
| # | Vấn đề | Mức | Xử lý |
|---|--------|-----|-------|
| 1 | `screen()` chỉ thêm class `show`; màn đã hiện thì animation CSS `enter` **không chạy lại**. Từ Hub sang Cửa hàng, Hồ sơ, Chọn khu... đều đổi cứng. | Cao | Đã sửa v0.120: khối xuất hiện lần lượt (mờ → trượt lên, so le 40ms), chỉ khi đổi màn (vẽ lại cùng màn thì không chạy, tránh nháy khi đổi tab). |
| 2 | Số tiền ở Hub nhảy thẳng sang giá trị mới (chỉ có hiệu ứng phóng to). | Trung bình | Đã sửa: số chạy dần 0,7s. |
| 3 | Các màn tự làm lại gần đây (Hồ sơ, Chọn ải, Thống kê) chưa có nhịp vào. | Trung bình | Gộp vào mục 1. |
| 4 | Còn CSS chết từ các màn cũ (`.sk-*`, `duoAskCard`). | Thấp | Dọn dần khi sửa từng màn. |

## Đề xuất đợt sau (chưa làm, cần Duy duyệt hướng)
1. **Mốc "lên tầng/qua ải" trong chuyến leo:** hiện chuyển cửa → trận khá phẳng. Thêm cú chuyển cảnh có hướng (cổng mở, tối dần).
2. **Âm thanh UI:** phân tầng độ lớn (nút chính nhấn mạnh hơn nút phụ).
3. **Nhân vật trong trận:** idle thở nhẹ cho tướng đội (đang tĩnh), chỉ cần scale/translate vài px.
4. **Art thật:** hiệu ứng hạt/viền đã đủ bằng code. Ảnh sinh bằng AI chỉ nên dùng cho nền/emblem khi Duy cấp, và phải tuân quy tắc 6 (không dùng art/tên game khác). Tôi không có khóa API dịch vụ sinh ảnh trong môi trường này, và quy tắc 10 cấm đưa khóa vào repo.

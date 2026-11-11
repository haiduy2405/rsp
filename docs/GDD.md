# GDD: Thiên Tháp Dị Điểm (tóm tắt trong repo)

> Bản đầy đủ và mới nhất nằm trong Claude Docs: https://claude.ai/artifact/JXHBGKhjwfdPvTQzqonyuR
> Hãy xuất tab "Tab 1" ra Markdown và ghi đè file này khi muốn có bản đầy đủ trong repo.
> Dưới đây là tóm tắt các quyết định đã chốt, đủ để làm M1 đến M4.

## Tầm nhìn
Puzzle RPG kéo ngọc leo tháp, đội 5 nhân vật, thần thoại và dân gian công cộng (Việt, Hy Lạp, Bắc Âu, Ai Cập...). Thiết kế gốc, không dùng tên/art/code game khác. Tone nghiêm túc, 16+. Tên: VN "Thiên Tháp Dị Điểm", EN "Rift Spire: Pantheon". v1 offline, v2 mới có server (Supabase).

## Chiến đấu
- Bàn 6 cột × 5 hàng, 6 loại ngọc: Thủy, Hỏa, Mộc, Quang, Ám, Tim (hồi máu). Kéo ~5 giây, hoán đổi dọc đường kéo.
- Combo: hệ số = 1 + 0,25 × (n − 1). Nhóm 4 ngọc tăng sức mạnh nhân vật cùng hệ; nhóm 5 tạo ngọc cường hóa.
- Khắc hệ: Thủy > Hỏa > Mộc > Thủy; Quang ⇄ Ám. ×1,5 / ×0,5.
- Đội 5, máu đội chung. Kỹ năng chủ động có hồi chiêu; leader skill từ khuôn mẫu cố định; Duo = cặp đứng cạnh nhau kích hoạt kỹ năng ghép (15 cặp). Không thể lực ở v1.
- 12 từ khóa hiệu ứng (khóa cứng): Bỏng, Độc, Choáng, Đóng băng, Khiên, Hồi máu, Tăng công, Giảm công, Phản đòn, Xuyên giáp, Khóa ngọc, Miễn nhiễm.
- Trận đấu phải xác định được (hàm thuần + seed) để sau này server phát lại chống gian lận và PvP bất đồng bộ.

## Tháp
6 khu (mỗi hệ một khu) × 5 ải = 30 ải mỗi mùa. Một chuyến = một khu, 3 đến 5 ải. Máu đội giữ qua các ải trong chuyến, hồi đầy khi bắt đầu chuyến mới. Mỗi ải 2 cánh cửa (Quái thường, Elite, Rương, Nghỉ, Sự kiện bí ẩn, Shop), trừ ải cuối: Boss (khu 2, 4, 6) hoặc Elite (khu 1, 3, 5). Thua: giữ loot đã nhặt, mất phần thưởng hoàn thành. Loot ngẫu nhiên có bảo hiểm xui cho Tinh Thạch Hiếm.

## Nhân vật và tiến hóa
24 nhân vật (6×5★, 8×4★, 10×3★), 6 hệ. Chống power creep: ngân sách chỉ số theo độ hiếm; nhân vật mới là sidegrade; tối đa 12 từ khóa; một trục Level + Thức tỉnh (5 bậc: bậc 1, 2, 4 tăng chỉ số; bậc 3, 5 giảm hồi chiêu); leader skill theo khuôn mẫu; mở rộng bằng khu/event mới. Nhịp ra nhân vật ≤ 1 đến 2 mỗi tháng.

## Tiền tệ
Vàng (shop, phí Thức tỉnh), Linh Thạch (triệu hồi, 100 = 1 lượt), Mảnh Linh Hồn (trùng nhân vật tự đổi; 200 mảnh = chọn bất kỳ), Tinh Thạch (6 hệ, Thường/Hiếm), Tinh Hoa (Level).

## Triệu hồi và kiếm tiền
Tỉ lệ công khai: 5★ 2%, 4★ 13%, 3★ 85%. Pity 60 cho 5★; 10 lượt đảm bảo ≥1 4★; 1 lượt miễn phí/ngày. Tín Vật: lượt đầu đảm bảo 1 nhân vật 4★ của nền văn hóa chọn. v1 chỉ dùng tiền trong game.
Kiếm tiền công bằng, không pay-to-win: 3 gói ủng hộ 50k/200k/500k VND (không tiêu thụ; Linh Thạch 1.000/4.500/12.000; 1/2/3 nhân vật 4★ tự chọn, không độc quyền, không 5★; khung/avatar/nền Cupola), thời trang, tiện ích, pass theo mùa (M9). Banner tiền thật chỉ quyết ở M9.

## Cốt truyện
Sự kiện "Dị Điểm": Tòa Tháp xuất hiện giữa hư không. Người chơi là phi hành gia, hub là module Cupola, không có chỉ số chiến đấu (chỉ Cấp Neo). Kết thật "Viên Ngọc Thứ Bảy": Tòa Tháp là viên ngọc thứ bảy trong tủ trưng bày, Trái Đất cũng là một viên ngọc, một bàn tay đưa vào. Dòng cuối: "Có ai đó đang chơi ván này." Thực thể "Chủ Nhân Bộ Sưu Tập" không tên, không gọi là thần. Mỗi mùa mở một lớp (Mùa 1: Việt + Hy Lạp).

## Pháp lý
Chỉ dùng thần thoại/dân gian công cộng, thiết kế gốc. Tránh anh hùng sử Việt có thật, thần của tôn giáo đang sống, "Isis" (dùng Aset), Liễu Hạnh. Công khai tỉ lệ gacha. IARC 16+, privacy policy. Kiểm tra trademark tên game trước khi đăng. Rủi ro bằng sáng chế thao tác kéo ngọc.

## Lộ trình
M1 lõi chiến đấu · M2 tháp/khu/ải/loot/lưu · M3 nhân vật/Duo/hiệu ứng/Thức tỉnh · M4 triệu hồi/Tín Vật/onboarding · M5 art/âm thanh/cân bằng · M6 Capacitor/gói ủng hộ/CH Play · M7 leaderboard (Supabase) · M8 PvP bất đồng bộ · M9 gacha tiền thật/battle pass. Không bắt đầu M7 trước khi M6 lên CH Play.

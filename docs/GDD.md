# Thiên Tháp Dị Điểm — Game Design Document

2026-11-11 · Duy

Thiên Tháp Dị Điểm (EN: Rift Spire: Pantheon) là puzzle RPG kéo ngọc leo tháp, làm bằng web và đóng gói Capacitor lên CH Play; v1 chạy offline, v2 thêm server.

## Tầm nhìn

- **Thể loại**: puzzle RPG kéo ngọc, leo tháp, đội 5 nhân vật. Lấy cảm hứng từ luật chơi chung của các game kéo ngọc (như Tower of Saviors bản đầu), không dùng tên, art, âm thanh hay code của họ.
- **Tên**: Thiên Tháp Dị Điểm (VN), Rift Spire: Pantheon (EN).
- **Tagline**: "Leo tháp, gom các vị thần của mọi nền văn hóa về một đội."
- **Đối tượng**: người chơi mobile phổ thông 16+, thích sưu tầm nhân vật thần thoại và chơi từng ván ngắn.
- **Tone**: fantasy thần thoại nghiêm túc, sáng sủa, dễ tiếp cận; không hài bựa.
- **Nền tảng**: web (HTML5 Canvas/JS), đóng gói Capacitor ra .aab cho CH Play.
- **Ngôn ngữ**: VI + EN ngay từ v1.
- **Phạm vi v0.1**: 6 hệ ngọc, 24 nhân vật, 6 khu vực (30 ải), 3 boss, 15 cặp Duo, offline, 3 gói ủng hộ. Không PvP, không bảng xếp hạng online, không gacha tiền thật.
- **Nguyên tắc dẫn dắt**: giữ game gọn. Cắt thứ gây phình (ra quá nhiều tướng, tiến hóa nhiều tầng, hiệu ứng rườm rà, power creep). Giữ và làm tốt tính năng, QoL, trải nghiệm, event và PvP ở giai đoạn sau.

## Cốt truyện

**Dị Điểm**: một sự cố không thể xảy ra đã xảy ra, như một lỗi của vũ trụ. Nhiều thế giới thần thoại bị xé ra và nhân vật của chúng bị cuốn vào một **Tòa Tháp** giữa hư không.

**Người chơi** là phi hành gia trên trạm vũ trụ quốc tế (hư cấu). Khi Dị Điểm xảy ra, module quan sát **Cupola** tách khỏi trạm và trôi vào một "khoảng giữa": nhìn thấy Tháp nhưng không bị hút vào. Cupola là hub của game.

Logic cơ chế:

- Phương trình của Tháp không chứa phi hành gia, nên chỉ người đó mới neo được nhân vật ra khỏi Tháp. Đó là triệu hồi.
- Ngọc là các mảnh năng lượng nhiễu động. Kéo thả ngọc là chỉnh tần số từ bảng điều khiển để nhân vật chiến đấu.
- Quái trong Tháp là các "Bóng": bản sao méo mó của sinh vật bị hút vào.

Nhân vật gốc ở v1: phi hành gia (người chơi), phi hành đoàn mất tích (móc câu xuyên suốt), AI của trạm (người hướng dẫn) và Kẻ Quan Sát (bóng bí ẩn).

### Kết thúc thật: Viên Ngọc Thứ Bảy (không công bố)

Người chơi đã kéo 6 loại ngọc mỗi ngày, mỗi viên là một thế giới thu nhỏ. **Tòa Tháp là viên ngọc thứ bảy.** Cả bảy viên nằm trong một chiếc hộp trưng bày, và hư không chính là bên trong hộp. Dị Điểm chỉ là một cú va: viên thứ bảy rơi khỏi ô của nó và nứt. **Trái Đất cũng là một viên ngọc trong cùng hộp.** Cupola luôn nằm ở mép viên Trái Đất, sát cạnh Tháp, nên không bị hút vào.

- **Kẻ Quan Sát**: Người Giữ Hộp, không phải trùm. Anh/cô ta liên tục "vá" viên thứ bảy bằng cách giữ nhân vật ổn định, nên phá trùm giả là phá lớp vá.
- **Trùm giả mỗi mùa**: phản ứng miễn dịch của chính Tháp, không phải kẻ ác.
- **Chủ Nhân Bộ Sưu Tập**: người đặt chiếc hộp ở đó. Không ác, chỉ không biết các ngọc đang sống. Giữ là một sinh thể không rõ bản chất, không gọi là thần.
- **Lựa chọn cuối**: người chơi chạm vào mặt kính. Cứu viên ngọc thứ bảy mà không phá hộp; các nhân vật về thế giới gốc, phi hành đoàn được tìm thấy.
- **Cảnh cuối**: máy quay lùi ra từ Cupola, sang Trái Đất, ra khỏi viên ngọc, thấy cả chiếc hộp trên một cái kệ, rồi một bàn tay đưa vào. Dòng cuối: "Có ai đó đang chơi ván này."

Tránh hình ảnh đặc trưng của phim Men in Black (viên bi, dải thiên hà trên vòng cổ, trẻ con chơi đùa).

Mầm cài sẵn ở v1: bàn ngọc 6×5 trông như khay chia ô; thoại về "cái kính" bị mờ trên bảng điều khiển; Cupola thỉnh thoảng rung theo nhịp lạ; Kẻ Quan Sát từng nói "Tôi đang giữ nó khỏi rơi."

### Nhịp các mùa

Mỗi mùa gồm 6 khu vực (30 ải), 3 boss và 2–3 nhân vật mới gắn với một nền văn hóa. Mùa 1 là Việt + Hy Lạp. Mỗi mùa mở một lớp, nhưng cái kết đã cố định ngay từ đầu để cốt truyện không tự mâu thuẫn.

| Mùa | Lớp mở ra |
|---|---|
| 1 | Tháp có lớp vá, trùm không thật sự ác |
| 2 | Các thế giới khác cũng đang nứt |
| 3 | Kẻ Quan Sát không phải người của Tháp |
| 4 | Trái Đất xuất hiện trên một vết nứt |
| 5 | Lộ ra chiếc hộp |
| Cuối | Chủ Nhân Bộ Sưu Tập |

Giữ một sổ khoảng 10 câu hỏi mở: mỗi mùa trả lời 1 câu và đặt thêm 1 câu.

## Người chơi và tạo nhân vật

Người chơi là phi hành gia và **không có chỉ số chiến đấu**. Chỉ có **Cấp Neo** (cấp tài khoản), mở dần tính năng và giới hạn đội hình. Hợp lore (anh/cô ấy không đánh nhau) và không thêm hệ thống nào cần cân bằng.

Luồng tạo nhân vật, dưới 1 phút:

1. **Cảnh mở đầu**: báo động trên trạm, khoảng 15 giây, bỏ qua được.
2. **Quốc tịch**: chọn quốc kỳ làm huy hiệu tay áo. Chỉ để trang trí; NPC chào bằng ngôn ngữ tương ứng.
3. **Tín Vật**: vật kỷ niệm quê hương. Người chơi tự chọn 1 nền văn hóa đang có (Việt, Hy Lạp, Bắc Âu, Ai Cập). Vật này neo lượt triệu hồi đầu tiên: đảm bảo 4★ của nền văn hóa đó, không phải 5★.
4. **Ngoại hình**: khoảng 8 mẫu preset (nam/nữ, tông da, tóc) do AI tạo. Không có trình chỉnh sửa phức tạp.
5. **Tên và mã hiệu** (callsign).

Lý do thiết kế: tách quốc tịch khỏi nền văn hóa để tránh định kiến kiểu "người nước X chỉ được thần X" và để nước không có banner không bị thiệt.

Quyết định trước khi làm UI: danh sách quốc gia có vùng tranh chấp (Đài Loan, Palestine, Kosovo…) rất nhạy cảm. Dùng danh sách ISO phổ biến, hoặc cho nhập tên quê hương tự do kèm huy hiệu trung tính.

## Chiến đấu

**Bàn ngọc** 6 cột × 5 hàng, 6 hệ ngọc: Thủy, Hỏa, Mộc, Quang, Ám, Tim (hồi máu).

- **Kéo ngọc**: chạm giữ 1 ngọc và kéo qua các ô; ngọc đi qua bị đẩy nhường chỗ. Giới hạn thời gian kéo khoảng 5 giây, đồng hồ chạy từ lúc bắt đầu kéo. Thả tay là kết thúc lượt kéo.
- **Tiêu ngọc**: sau khi thả, mọi nhóm từ 3 ngọc cùng loại liền kề (hàng hoặc cột) biến mất, ngọc mới rơi xuống, rồi tiếp tục tiêu theo chuỗi. Mỗi nhóm tiêu được là 1 combo.
- **Sát thương**: công của nhân vật cùng hệ × hệ số nhóm ngọc × hệ số combo. Combo nhân sát thương lũy tiến (giá trị khởi điểm đề xuất: hệ số combo = 1 + 0,25 × (số combo − 1), chỉnh khi cân bằng).
- **Nhóm 4 ngọc**: tăng sức mạnh cho nhân vật cùng hệ. **Nhóm 5 ngọc**: tạo ngọc cường hóa.
- **Khắc hệ**: Thủy khắc Hỏa, Hỏa khắc Mộc, Mộc khắc Thủy; Quang và Ám khắc lẫn nhau. Giá trị khởi điểm đề xuất: ×1,5 khi khắc, ×0,5 khi bị khắc.
- **Đội 5 nhân vật**: mỗi người có hệ, máu, công, hồi, **kỹ năng chủ động** (có hồi chiêu) và **kỹ năng đội trưởng** (theo khuôn mẫu cố định, xem phần chống power creep). Máu đội là tổng máu 5 nhân vật; thua khi máu đội về 0.
- **Duo**: hai nhân vật đứng cạnh nhau và thuộc một cặp định sẵn thì mở kỹ năng ghép (xem phần Nhân vật).
- **Thể lực**: đề xuất bỏ ở v1 vì game offline.

Yêu cầu bắt buộc từ M1: **trận đấu phải xác định được**. Mọi yếu tố ngẫu nhiên đi qua một bộ sinh số có seed, nên cùng seed và cùng chuỗi nước kéo luôn cho cùng kết quả. Đây là nền tảng để kiểm chứng PvP bất đồng bộ ở M8.

## Tháp, khu vực và ải

Tòa Tháp chia thành **6 khu vực**, mỗi khu gắn với một hệ ngọc. Người chơi chọn khu trên bản đồ Tháp, đi **một chuyến** gồm **3 đến 5 ải**, rồi quay về Cupola. Mỗi khu là nơi farm vật liệu riêng, nên người chơi có lý do quay lại đúng khu mình cần. Mùa 1 có 6 khu, tổng cộng 30 ải.

| Khu | Rớt chính | Ải cuối |
|---|---|---|
| Khu Thủy | Tinh Thạch Thủy | Elite |
| Khu Hỏa | Tinh Thạch Hỏa | Boss |
| Khu Mộc | Tinh Thạch Mộc | Elite |
| Khu Quang | Tinh Thạch Quang | Boss |
| Khu Ám | Tinh Thạch Ám | Elite |
| Khu Tim | Tinh Thạch Tim | Boss |

Khu mở khóa theo thứ tự trong bảng. Tên và cảnh nền từng khu đặt theo địa danh thần thoại (cửa biển, núi lửa, rừng thiêng…), chốt ở M4.

### Luật một chuyến

- Một chuyến là một khu, gồm 3 đến 5 ải.
- **Máu đội giữ qua các ải trong chuyến**; vào chuyến mới thì đội hồi đầy. Máu hồi bằng ngọc Tim, cửa Nghỉ và vật phẩm.
- Trước mỗi ải (trừ ải cuối) hiện **2 cửa**, người chơi chọn 1. Ải cuối cố định.
- Thua thì giữ loot đã nhặt, mất thưởng hoàn thành chuyến.
- Không có thể lực: chơi lại bao nhiêu lần cũng được.

| Loại cửa | Nội dung |
|---|---|
| Quái thường | Trận đánh tiêu chuẩn, thưởng cơ bản |
| Elite | Khó hơn, tỉ lệ rớt đồ hiếm cao hơn |
| Rương | Phần thưởng, không phải đánh |
| Nghỉ | Hồi máu cho đội |
| Sự kiện bí ẩn | Lựa chọn có được hoặc mất, văn phong nghiêm túc kiểu "ngã ba số phận" |
| Shop | Mua vật phẩm bằng Vàng |

### Loot và chơi lại

- **Chắc chắn**: Vàng và Tinh Hoa sau mỗi ải; ải cuối rớt thêm.
- **Ngẫu nhiên**: Tinh Thạch của khu (số lượng ngẫu nhiên, có loại Thường và loại Hiếm), Mảnh Linh Hồn (hiếm), một ít Linh Thạch.
- Cửa Elite, Rương và ải cuối có tỉ lệ rớt đồ hiếm cao hơn.
- **Mục tiêu cân bằng**: một bậc Thức tỉnh cần lượng Tinh Thạch tương đương 1 đến 2 chuyến ở đúng khu, không cần chơi lại nhiều hơn.
- **Bảo hiểm xui** (đề xuất): nếu chuyến trước không rớt Tinh Thạch Hiếm của khu, chuyến kế tiếp ở khu đó chắc chắn rớt.

Mùa sau thêm khu mới nhưng không thêm loại vật liệu mới. Khu cũ vẫn là nơi farm, để tránh phình hệ thống.

## Nhân vật và Duo

Nhân vật lấy từ thần thoại, truyền thuyết và cổ tích thuộc phạm vi công cộng. Tên và tích truyện dùng tự do; **thiết kế hình ảnh phải là của riêng mình**, không bám art phim, game hay anime hiện đại.

### Roster ra mắt (24 nhân vật)

| Hệ | 5★ | 4★ | 3★ |
|---|---|---|---|
| Thủy | Thủy Tinh | Ran | Thetis, Cóc Kiện Trời |
| Hỏa | Thánh Gióng | Hephaestus, Surtr | Bennu |
| Mộc | Sơn Tinh | Mai An Tiêm, Artemis | Atalanta |
| Quang | Apollo | Ra | Eos, Heimdall |
| Ám | Hel | Loki | Nyx, Fenrir |
| Tim | Cô Tấm | Freyja | Eir, Orpheus |

Tổng cộng 6 nhân vật 5★, 8 nhân vật 4★ và 10 nhân vật 3★. Sơn Tinh + Thủy Tinh là Duo "tủ" của ngày ra mắt, mang đậm bản sắc Việt và dễ lan truyền ở thị trường nhà.

### Kho dự trữ theo hạng

Banner tiền thật chỉ có từ M9, nên giữ nhân vật nổi nhất đến lúc đó, đừng "đốt" khi chưa thu được tiền.

| Hạng | Nhân vật | Khi nào |
|---|---|---|
| I: Biểu tượng toàn cầu | Zeus, Odin, Tôn Ngộ Không, Anubis, Medusa, Arthur, Dracula, Thor | Chỉ sau khi M9 bật, khoảng 1 nhân vật mỗi 6 tuần, banner có thời hạn |
| II: Quen mặt | Poseidon, Athena, Hades, Ægir, Aset, Prometheus (khoảng 12 nhân vật) | Tháng 1 đến 6 sau ra mắt, giữ nhịp |
| III: Bản sắc Việt | Lạc Long Quân, Âu Cơ, Thạch Sanh, Chử Đồng Tử | Xen kẽ khi cần ra mắt nhanh ở VN; Lạc Long Quân là 5★ trên banner Thần Việt, ghép Duo với Âu Cơ |

Mỗi nhân vật Hạng I mới ghép Duo với một nhân vật đã có từ ngày ra mắt (ví dụ Zeus + Apollo, Odin + Loki). Người chơi cũ có lý do quay lại và không cần tăng chỉ số. Nhịp ra nhân vật: 1 đến 2 nhân vật mỗi tháng, khoảng 36 nhân vật trong 2 năm đầu, cộng 24 ban đầu là khoảng 60.

### Kỹ năng ghép (Duo): 15 cặp ở v1

| # | Cặp | Lý do (tích truyện) |
|---|---|---|
| 1 | Sơn Tinh + Thủy Tinh | Kỹ năng "Lũ Lụt Tình Địch" |
| 2 | Apollo + Artemis | Cặp song sinh |
| 3 | Hephaestus + Thetis | Thetis nhờ rèn áo giáp |
| 4 | Hel + Loki | Cha và con gái |
| 5 | Freyja + Hel | Cùng giữ linh hồn người chết |
| 6 | Thánh Gióng + Mai An Tiêm | Cùng thời Hùng Vương |
| 7 | Cô Tấm + Eir | Hồi sinh và chữa lành |
| 8 | Ra + Bennu | Chim lửa gắn với thần Mặt Trời |
| 9 | Apollo + Orpheus | Cha và con (theo một dị bản) |
| 10 | Artemis + Atalanta | Hai nữ thợ săn |
| 11 | Nyx + Eos | Đêm và bình minh |
| 12 | Heimdall + Loki | Đối thủ định mệnh |
| 13 | Mai An Tiêm + Cóc Kiện Trời | Hạn hán và mưa |
| 14 | Ran + Thủy Tinh | Hai chúa biển |
| 15 | Surtr + Fenrir | Hoàng hôn của các vị thần |

Mỗi nhân vật tối đa 2 đến 3 Duo. Cặp dựa trên dị bản (như #9) phải ghi nguồn trong data. Duo lưu trong một bảng dữ liệu, không cần hệ thống mới.

### Cần tránh

- **Isis**: trùng tên tổ chức khủng bố, dùng "Aset" hoặc bỏ.
- **Dracula, Thor, Arthur, Hades, Tôn Ngộ Không**: tên và nguyên tác dùng được, nhưng thiết kế phải riêng, tránh phim Universal, Marvel, game Hades của Supergiant, Dragon Ball.
- **Thánh Gióng, Sơn Tinh** thuộc tín ngưỡng dân gian "Tứ Bất Tử": thể hiện tôn trọng. **Liễu Hạnh** (tín ngưỡng Mẫu): tránh.
- Không dùng nhân vật lịch sử Việt thật (Trần Hưng Đạo, Hai Bà Trưng…) và thần của tôn giáo đang sống (Phật, Chúa, Allah, thần Hindu).

## Hiệu ứng và chống power creep

Sáu luật cứng, không phá, để game vẫn gọn sau nhiều năm:

1. **Ngân sách chỉ số theo độ hiếm**: 3★, 4★ và 5★ có tổng chỉ số tối đa cố định. Nhân vật mới không được vượt.
2. **Nhân vật mới là sidegrade**: có vai trò hoặc combo mới, không phải bản mạnh hơn của nhân vật cũ.
3. **Tối đa 12 từ khóa hiệu ứng**. Nhân vật mới chỉ tái dùng, không đẻ hiệu ứng mới.
4. **Chỉ một trục tiến hóa**: Level + Thức tỉnh (gồm cả nâng kỹ năng; dùng Mảnh Linh Hồn và Tinh Thạch). Không rune, không trang bị, không nhiều tầng tiến hóa.
5. **Leader skill dùng khuôn mẫu cố định** (ví dụ "+X% công cho hệ Y"), không tự do chế.
6. **Mở rộng bằng ****khu vực mới**** và event**, không bằng việc đẩy chỉ số lên.

Tốc độ ra nhân vật: tối đa 1 đến 2 mỗi tháng.

### 12 từ khóa hiệu ứng (khóa cứng)

Bỏng · Độc · Choáng · Đóng băng · Khiên · Hồi máu · Tăng công · Giảm công · Phản đòn · Xuyên giáp · Khóa ngọc · Miễn nhiễm

Mọi kỹ năng chỉ được ghép từ các từ khóa này. Thêm hoặc đổi một từ khóa cần lý do mạnh. Định nghĩa chi tiết từng hiệu ứng (thời gian, chồng hiệu ứng, thứ tự tính) viết ở M3.

## Triệu hồi và kiếm tiền

### Nghi Thức Triệu Hồi

Nhân vật thu thập qua loot. Tỉ lệ đề xuất, công khai trong game:

| Độ hiếm | Tỉ lệ |
|---|---|
| 5★ | 2% (thực tế, đã tính pity; tỉ lệ gốc 0.5%) |
| 4★ | ~16.4% (gốc 13%) |
| 3★ | ~81.6% (gốc 86.5%) |

- **Pity**: chắc chắn có 5★ sau 60 lượt; 10 lượt đảm bảo ít nhất 1 nhân vật 4★.
- **Nhân vật trùng** thành "Mảnh Linh Hồn". Đủ 200 mảnh thì đổi 1 nhân vật tự chọn, là đường lùi cho người xui.
- **Banner theo nền văn hóa** (Thần Việt, Olympus, Bắc Âu, Ai Cập…) tăng tỉ lệ nhân vật của nhóm đó.
- **1 lượt miễn phí mỗi ngày**, thưởng thêm lượt khi qua tầng.
- **Cảm giác hấp dẫn**: hiệu ứng ánh sáng theo độ hiếm, hoạt ảnh triệu hồi hoành tráng, bộ sưu tập có % hoàn thành.
- **v1 chỉ dùng tiền trong game.** Lượt đầu tiên neo theo Tín Vật (xem phần Người chơi).

### Kiếm tiền

| Lớp | Nội dung | Giai đoạn |
|---|---|---|
| **Gói ủng hộ** | 3 gói 50.000đ, 200.000đ, 500.000đ qua Google Play Billing; không bán sức mạnh độc quyền, quà lưu local | v1 (M6) |
| **Thời trang (nguồn thu chính)** | Skin nhân vật, khung thẻ, avatar, nền Cupola, hiệu ứng triệu hồi | Gói ủng hộ ở v1, shop skin sau v1 |
| **Tiện ích** | Thêm ô lưu đội, mở rộng kho, bỏ quảng cáo nếu có; không tăng sức mạnh | Sau v1 |
| **Pass theo mùa** | Thưởng thẩm mỹ và một ít Linh Thạch, doanh thu lặp lại | M9 |
| **Banner nhân vật (gacha tiền thật)** | Cần server giữ tài khoản và validate hóa đơn, tỉ lệ rơi công khai | M9, chỉ quyết định dựa trên dữ liệu người chơi thật |

Nguyên tắc đã chốt: fair, ai ủng hộ thì nhận quà, ai không mua cũng không thiệt. Nguồn thu chính là thời trang, tiện ích và pass; banner để M9 quyết định. Nếu bật banner, giữ pity, đổi Mảnh Linh Hồn lấy nhân vật tự chọn, và PvE không đòi nhân vật mới.

Giá 3 gói ủng hộ đã chốt; số lượng quà cụ thể cân bằng ở M5 đến M6. Khi bật gacha tiền thật, tỉ lệ rơi phải công khai theo yêu cầu của Google Play.

## Vật phẩm và tiền tệ

Luật 4 vẫn giữ: **không trang bị, không rune**. Vật phẩm không bao giờ tăng chỉ số vĩnh viễn; sức mạnh chỉ đến từ nhân vật, Level và Thức tỉnh. Danh sách vật phẩm giữ ngắn, dưới 10 loại ở v1. Mọi con số dưới đây là **đề xuất**, cân bằng ở M5 đến M6.

### Tiền tệ và nguyên liệu

| Loại | Dùng để | Kiếm từ |
|---|---|---|
| Vàng | Mua đồ ở Shop trong tháp, trả phí Thức tỉnh | Thắng trận, rương |
| Linh Thạch | Triệu hồi (đề xuất 100 Linh Thạch = 1 lượt) | Lượt miễn phí mỗi ngày, qua ải, nhiệm vụ, gói ủng hộ |
| Mảnh Linh Hồn | Thức tỉnh; đủ 200 thì đổi 1 nhân vật tự chọn | Nhân vật trùng tự đổi thành mảnh; rớt hiếm ở khu vực |
| Tinh Thạch (6 loại theo hệ, có Thường và Hiếm) | Thức tỉnh nhân vật cùng hệ | Khu vực cùng hệ |
| Tinh Hoa | Lên Level | Thắng trận, rương |

Đã chốt: bản trùng tự động thành Mảnh Linh Hồn, và Thức tỉnh tốn mảnh. Số mảnh theo độ hiếm cân bằng ở M5.

### Thức tỉnh và nâng kỹ năng

Thức tỉnh là **trục tiến hóa duy nhất ngoài Level** (luật 4), gồm 5 bậc. Nâng kỹ năng nằm trong Thức tỉnh, không phải một hệ thống riêng. Ngân sách chỉ số ở luật 1 tính tại bậc Thức tỉnh tối đa.

| Bậc | Hiệu quả | Tốn |
|---|---|---|
| 1 và 2 | Tăng chỉ số | Mảnh Linh Hồn, Tinh Thạch Thường cùng hệ, Vàng |
| 3 | Giảm hồi chiêu kỹ năng chủ động | Mảnh Linh Hồn, Tinh Thạch Thường cùng hệ, Vàng |
| 4 | Tăng chỉ số | Mảnh Linh Hồn, Tinh Thạch Hiếm cùng hệ, Vàng |
| 5 | Giảm hồi chiêu thêm một lần, đổi khung thẻ | Mảnh Linh Hồn, Tinh Thạch Hiếm cùng hệ, Vàng |

Số lượng từng bậc cân bằng ở M5, theo mục tiêu mỗi bậc cần khoảng 1 đến 2 chuyến ở đúng khu.

### Vật phẩm dùng trong chuyến

Chỉ dùng trong chuyến hiện tại, mua ở Shop hoặc nhặt từ rương và sự kiện:

| Vật phẩm | Tác dụng |
|---|---|
| Bình Hồi Phục | Hồi một phần máu đội (từ khóa Hồi máu) |
| Bùa Khiên | Khiên cho đội trong một trận (từ khóa Khiên) |
| Bùa Thời Gian | Kéo dài thời gian kéo ngọc trong một trận |

Bùa Thời Gian là chỉnh luật kéo, không nằm trong 12 từ khóa hiệu ứng. Nếu muốn giữ luật chặt thì bỏ vật phẩm này.

Vật phẩm trong chuyến mất khi chuyến kết thúc. Một chuyến là một khu vực gồm 3 đến 5 ải (xem phần Tháp, khu vực và ải).

### Vật phẩm thẩm mỹ

Skin nhân vật (biến thể art), avatar, khung thẻ, nền Cupola. Chỉ thẩm mỹ, không có chỉ số. Nguồn: gói ủng hộ, thành tích, event về sau.

### Ba gói ủng hộ

| Gói | Giá | Linh Thạch | Tướng khởi đầu | Thẩm mỹ |
|---|---|---|---|---|
| Ủng Hộ I | 50.000đ | 1.000 (10 lượt) | 1 tướng 4★ tự chọn | Khung "Ủng Hộ I" |
| Ủng Hộ II | 200.000đ | 4.500 (45 lượt) | 2 tướng 4★ tự chọn | Khung "Ủng Hộ II" + avatar |
| Ủng Hộ III | 500.000đ | 12.000 (120 lượt) | 3 tướng 4★ tự chọn | Khung "Ủng Hộ III" + avatar + nền Cupola |

Tỉ lệ Linh Thạch trên mỗi 1.000đ tăng nhẹ theo gói (20, 22,5 và 24), tức thưởng thêm khoảng 12% và 20% cho gói lớn. Tướng khởi đầu chọn trong danh sách 8 nhân vật 4★ của roster.

Quy tắc cho các gói:

1. Mỗi gói mua một lần (loại non-consumable) để Google Play khôi phục được khi cài lại.
2. Tướng quà **tối đa 4★ và không độc quyền** (vẫn kiếm được qua triệu hồi). Bán tướng mạnh nghĩa là bán lợi thế chiến đấu, dễ bị gọi là pay-to-win khi có bảng xếp hạng và PvP. Độc quyền chỉ nằm ở phần thẩm mỹ. Nguyên tắc chung (đã chốt): ai ủng hộ thì nhận quà, ai không mua cũng không thiệt.
3. Quà không ảnh hưởng đến bộ đếm pity.

Ghi chú kỹ thuật: v1 lưu local nên gỡ app là mất tiến trình dù Google Play khôi phục được gói đã mua. Đề xuất thử bật Android Auto Backup (cần kiểm tra khi build xem dữ liệu WebView có được sao lưu không) và thêm nút xuất/nhập file lưu ở M5. Sao lưu theo tài khoản ở M7.

## Art và âm thanh

**Style đã chọn**: anime fantasy, cel-shading, màu rực nhẹ. Thẻ nhân vật là portrait nửa người, khung viền đổi theo hệ và độ hiếm.

Quy trình tạo nhân vật bằng AI:

1. Tạo style guide và 1 ảnh tham chiếu chung.
2. Sinh từng nhân vật trên nền trơn.
3. Tách nền.
4. Xuất 1024×1536 (thẻ) và 512×512 (icon).

Mỗi nhân vật có 1 ảnh chính và 1 biến thể Thức tỉnh. Game dùng ảnh tĩnh và tween (thở nhẹ, tỏa sáng) trong Canvas, không animation từng khung.

**Rủi ro: mặt giống nhau hàng loạt.** Mỗi nhân vật cần một bảng mô tả riêng (tóc, mắt, trang phục, màu chủ đạo) để phân biệt.

Bản quyền art AI:

- Art thuần AI có thể không được bảo hộ bản quyền, nghĩa là người khác copy được. Chỉnh tay ít nhất phần mặt và chi tiết.
- Lưu prompt và file gốc của từng asset.
- Không dùng prompt "theo phong cách của họa sĩ X còn sống".
- Không bám thiết kế của phim, game hay anime hiện đại (Marvel, Fate, Saint Seiya…).

**Âm thanh**: nhạc và hiệu ứng dùng asset có giấy phép rõ ràng (CC0) hoặc tự làm; ghi lại nguồn từng file.

## Kỹ thuật

- **Nền tảng**: web (HTML5 Canvas + JavaScript), test trên trình duyệt, đóng gói bằng **Capacitor** ra file .aab cho CH Play. Một codebase duy nhất.
- **Lưu game**: localStorage hoặc IndexedDB. v1 không cần đăng nhập hay server.
- **Tách logic khỏi hiển thị**: logic trận đấu là hàm thuần (trạng thái, nước kéo) → trạng thái mới, không chạm vào Canvas. Nhờ vậy chạy được cả trên server để kiểm chứng PvP về sau.
- **Trận đấu xác định**: mọi ngẫu nhiên đi qua một bộ sinh số giả ngẫu nhiên có seed. Mỗi trận lưu seed và chuỗi nước kéo; cùng đầu vào phải cho cùng kết quả. Làm đúng từ M1, sửa lại về sau rất tốn công.
- **Data-driven**: nhân vật, kỹ năng, Duo, tầng tháp và banner nằm trong file JSON. Thêm nhân vật không cần sửa code. Về sau event nạp qua config từ xa (M8).
- **VI/EN**: toàn bộ chuỗi nằm trong file ngôn ngữ, không viết cứng trong code. Mặc định theo ngôn ngữ thiết bị. Chọn font hiển thị đúng dấu tiếng Việt.
- **Bảng xếp hạng**: v1 chỉ lưu tầng cao nhất cục bộ. Bảng xếp hạng online ở M7, dùng **Supabase** (free tier đủ lúc đầu).
- **Chống gian lận**: điểm do client gửi dễ bị làm giả. Tạm chấp nhận ở quy mô nhỏ; về sau server phát lại trận (seed + nước kéo) để kiểm chứng.
- **Thanh toán**: Google Play Billing cho 3 gói ủng hộ ở v1; validate hóa đơn phía server khi làm M9.

## Pháp lý và văn hóa

Phần này là ghi chú rủi ro, không phải tư vấn pháp lý. Nếu kiếm tiền nghiêm túc, hỏi luật sư sở hữu trí tuệ.

| Mục | An toàn | Không được |
|---|---|---|
| Cơ chế | Luật chơi và ý tưởng chung: kéo-thả ngọc, combo, khắc hệ, leader skill | Code, UI, icon, âm thanh, nhạc của game gốc |
| Tên và thương hiệu | Tên riêng của game mình | Tên, logo "Tower of Saviors" hoặc thương hiệu có sẵn |
| Nhân vật | Thần thoại, truyền thuyết, cổ tích ở phạm vi công cộng; tên và tích truyện gốc | Thiết kế cụ thể của anime, game, phim hiện đại (Marvel, Fate, Saint Seiya…) |
| Art | Tự vẽ, AI có chỉnh tay, asset CC0 có ghi nguồn | Art copy từ game khác; prompt theo họa sĩ còn sống |

Các rủi ro cần theo dõi:

- **Bằng sáng chế cơ chế kéo ngọc**: hãng game kéo-thả nổi tiếng có thông tin về bằng sáng chế ở một số vùng; phạm vi hiệu lực chưa rõ. Cách giảm rủi ro là có twist riêng (chọn đường, Duo), và hỏi luật sư trước khi kiếm tiền lớn.
- **Tên game**: web search chưa thấy game trùng "Thiên Tháp Dị Điểm" hay "Rift Spire", nhưng chưa phải tra cứu chính thức. Trước khi chốt, tra WIPO Global Brand Database, cơ sở dữ liệu của Cục Sở hữu trí tuệ VN (nhóm 9, 28, 41), Google Play, App Store, tên miền và mạng xã hội.
- **Gacha**: Google Play yêu cầu công khai tỉ lệ rơi. Gacha tiền thật để M9, khi đã có server giữ tài khoản.
- **Game online ở Việt Nam**: game online có tương tác giữa người chơi có thể cần giấy phép theo quy định hiện hành. Chưa chắc chi tiết, nên kiểm tra trước khi bật PvP hoặc bảng xếp hạng ở VN.
- **Xếp hạng nội dung**: khai báo IARC phù hợp 16+. Cần chính sách quyền riêng tư (privacy policy) khi lên store.
- **Nhạy cảm văn hóa**: xem danh sách nhân vật cần tránh ở phần Nhân vật. Kết thúc "Chủ Nhân Bộ Sưu Tập" giữ là sinh thể không rõ bản chất, không gọi là thần.

## Roadmap và phân công

| Mốc | Nội dung |
|---|---|
| M1 | Bàn ngọc: kéo, tiêu, rơi, combo; trận đấu xác định (seed + chuỗi nước kéo) |
| M2 | Trận đánh: quái, máu, sát thương, khắc hệ, 1 tầng chơi được |
| M3 | Đội 5 nhân vật, kỹ năng chủ động, leader skill, Duo, định nghĩa 12 hiệu ứng |
| M4 | 6 khu vực (30 ải), chuyến 3 đến 5 ải, chọn đường, bảng rớt đồ, 3 boss |
| M5 | Triệu hồi, thu thập, Thức tỉnh, lưu game, VI/EN, âm thanh |
| M6 | Menu, 3 gói ủng hộ, cân bằng, Capacitor → AAB, closed test, lên CH Play |
| M7 (v2) | Supabase: tài khoản, bảng xếp hạng tầng cao nhất |
| M8 | PvP bất đồng bộ, event qua config từ xa |
| M9 | Gacha tiền thật, battle pass |

**Quy tắc**: không bắt đầu M7 trước khi M6 đã lên CH Play. Live-service là nơi dev solo hay "chết" nhất.

**PvP bất đồng bộ**: người chơi không đánh trực tiếp với người đang online mà đánh **đội phòng thủ đã lưu** của người khác (do máy điều khiển). Hai bên không cần online cùng lúc; server chỉ lưu đội và điểm xếp hạng. PvP thời gian thực không đặt mục tiêu.

### Phân công

| Claude | Duy |
|---|---|
| Toàn bộ code game, data nhân vật và kỹ năng, cấu hình Capacitor, tích hợp billing, privacy policy, mô tả store | Tạo tài khoản Google Play Developer (khoảng 25 USD, xác minh danh tính) |
| Prompt art và style guide cho AI | Cài Node, Android Studio, JDK |
| Prompt từng mốc M1 đến M6 | Chạy lệnh build theo hướng dẫn; **tạo keystore và backup kỹ** (mất là không update app được nữa) |
| Hướng dẫn điền bảng IARC (16+) | Tìm tester cho closed test (số lượng và số ngày theo chính sách hiện hành, kiểm tra lại lúc gần xong) |
|  | Tạo ảnh bằng AI, duyệt art |

### Giả định đang dùng, cần Duy xác nhận

- Ngôn ngữ v1: VI + EN.
- Bảng xếp hạng online để M7; v1 chỉ lưu tầng cao nhất cục bộ.
- Không có thể lực ở v1.
- Máu đội giữ qua các tầng (đã chốt).
- Giá 3 gói ủng hộ: 50.000đ, 200.000đ, 500.000đ (đã chốt); quà cụ thể cân bằng ở M5 đến M6.

# ART_PROMPTS — chỉ dẫn art Thiên Tháp Dị Điểm

> Dành cho Duy dùng với công cụ AI + chỉnh tay. **Giữ lại prompt và file gốc** của từng asset (thư mục `art-src/`, không đưa lên repo nếu nặng).

## Quy tắc chung

- Phong cách: anime fantasy, cel-shading, màu rực nhẹ, viền mảnh. Portrait nửa người, nền trơn để tách.
- Thiết kế gốc dựa trên thần thoại/dân gian công khai. **Không** dùng phong cách họa sĩ còn sống; **không** bám thiết kế của Marvel, Fate, Saint Seiya, game Hades hay bất kỳ nhân vật thương hiệu nào.
- Mỗi nhân vật có bảng riêng (tóc, mắt, trang phục, màu chủ đạo) để tránh mặt giống nhau hàng loạt. Đổi dáng và biểu cảm, đừng chỉ đổi màu tóc.
- Chỉnh tay ít nhất phần mặt và chi tiết (art thuần AI có thể không được bảo hộ bản quyền).
- Xuất: thẻ `assets/characters/<id>_card.webp` 1024×1536 (≤ 600 KB), icon `assets/characters/<id>_icon.webp` 512×512 (cắt vuông phần mặt).
- Khung viền theo hệ/độ hiếm do game vẽ; **đừng** vẽ khung vào ảnh.
- Biến thể Thức tỉnh (v1.1): cùng nhân vật, thêm hào quang và chi tiết trang phục; tên file `<id>_card_a.webp` (chưa dùng trong manifest).
- Kiểm tra: `node tools/check-assets.js` liệt kê file thiếu/thừa; `--write` sinh lại manifest.

## Prompt mẫu (ghép bảng nhân vật vào)

```
half-body portrait, anime fantasy, cel-shaded, soft rim light, clean line art, plain flat background, 2:3 vertical, <MÔ TẢ NHÂN VẬT>, palette: <MÀU>, original character design, no text, no logo
```

## Ngọc (6) — `assets/orbs/orb0..5.webp`, 256×256, nền trong suốt

Mỗi ngọc là một **hình dạng khác nhau** (hỗ trợ mù màu), không chỉ khác màu: 0 Thủy tròn giọt nước xanh dương; 1 Hỏa tam giác ngọn lửa đỏ cam; 2 Mộc vuông bo góc, lá xanh; 3 Quang hình thoi, tinh thể vàng; 4 Ám lục giác, tím có xoáy tối; 5 Tim hình trái tim hồng. Ngọc phải đọc được khi chỉ cao 90 px.

## Nền và UI

- `assets/bg/hub.webp` 1080×1920: khoang Cupola trên trạm vũ trụ, nhìn ra Trái Đất, tông xanh sẫm; để trống phần giữa cho giao diện.
- `assets/bg/battle.webp` 1080×1920: phần trên (≈ 40%) là vùng dị điểm/tháp, phần dưới tối và phẳng cho bàn ngọc.
- `assets/ui/logo.webp` 1024×512: tên game, nền trong suốt.

## 24 nhân vật

### Thủy Tinh (`thuy_tinh`) — 5★, hệ Thủy (xanh dương #3b9cff), vai dps

- Thể hình/tư thế: Thủy thần nam trung niên, vai rộng, uy nghi
- Tóc: tóc dài xanh biển rẽ ngôi, vài lọn như sóng
- Mắt/biểu cảm: mắt xanh ngọc, nhìn thẳng, lạnh
- Trang phục/đạo cụ: áo choàng vảy cá xanh thẫm, vương miện san hô, tay cầm cây đinh ba bằng xương cá
- Bảng màu: xanh dương, trắng ngà, ngọc trai

### Ran (`ran`) — 4★, hệ Thủy (xanh dương #3b9cff), vai support

- Thể hình/tư thế: Nữ dân gian, thân hình thon, tư thế uốn lượn
- Tóc: tóc đen bện dài như thân rắn, điểm tia lam
- Mắt/biểu cảm: mắt dọc vàng nhạt, môi nhếch
- Trang phục/đạo cụ: váy vảy rắn xanh thẳm, vòng cổ nanh rắn, tay áo rộng như sóng
- Bảng màu: xanh dương đậm, đen, bạc

### Thetis (`thetis`) — 3★, hệ Thủy (xanh dương #3b9cff), vai tank

- Thể hình/tư thế: Nữ thần biển, dáng đứng vững như tấm khiên
- Tóc: tóc bạch kim búi cao, lọn rủ xuống vai
- Mắt/biểu cảm: mắt xanh nhạt, điềm tĩnh
- Trang phục/đạo cụ: giáp ngực vỏ sò, khiên tròn khắc sóng, váy lụa trắng xanh
- Bảng màu: xanh dương nhạt, trắng, vàng nhạt

### Cóc Kiện Trời (`coc_kien_troi`) — 3★, hệ Thủy (xanh dương #3b9cff), vai dps

- Thể hình/tư thế: Ếch/cóc nhân hình nhỏ nhắn, vui nhộn, kiểu truyện cổ tích
- Tóc: đầu trọc bóng, hai gò mắt lồi
- Mắt/biểu cảm: mắt tròn to màu vàng, miệng rộng cười
- Trang phục/đạo cụ: áo tơi lá sen, đội nón lá, tay cầm trống nhỏ báo mưa
- Bảng màu: xanh dương, xanh lục nhạt, nâu

### Thánh Gióng (`thanh_giong`) — 5★, hệ Hỏa (đỏ cam #ff5a3c), vai dps

- Thể hình/tư thế: Chiến binh nam trẻ cao lớn, thế đứng đạp đất
- Tóc: tóc đen buộc cao như đuôi ngựa, vài lọn bay
- Mắt/biểu cảm: mắt đen sáng, quyết liệt
- Trang phục/đạo cụ: giáp sắt màu đỏ rực đúc kiểu cổ, áo choàng đỏ, roi sắt vác vai
- Bảng màu: đỏ cam, đen, vàng đồng

### Hephaestus (`hephaestus`) — 4★, hệ Hỏa (đỏ cam #ff5a3c), vai tank

- Thể hình/tư thế: Thợ rèn thần, vạm vỡ, hơi cúi, tư thế đang đập búa
- Tóc: tóc xoăn đen cháy xém, râu ngắn
- Mắt/biểu cảm: mắt nâu lửa, một bên đeo kính thợ rèn
- Trang phục/đạo cụ: tạp dề da cháy, găng tay sắt, búa lớn tỏa than hồng
- Bảng màu: đỏ cam, đen, đồng

### Surtr (`surtr`) — 4★, hệ Hỏa (đỏ cam #ff5a3c), vai dps

- Thể hình/tư thế: Người khổng lồ lửa, to lớn, thân dày
- Tóc: tóc là ngọn lửa đỏ cam, không có tóc thật
- Mắt/biểu cảm: mắt trắng rực, vết nứt dung nham trên má
- Trang phục/đạo cụ: giáp đá núi lửa, kiếm rực lửa to bản
- Bảng màu: đỏ thẫm, cam, đen than

### Bennu (`bennu`) — 3★, hệ Hỏa (đỏ cam #ff5a3c), vai healer

- Thể hình/tư thế: Chim lửa cổ Ai Cập, nữ hình người có cánh
- Tóc: tóc lông vũ đỏ vàng
- Mắt/biểu cảm: mắt vàng kim, tinh nghịch
- Trang phục/đạo cụ: váy lông chim, vòng đầu hình mặt trời, đôi cánh rực lửa
- Bảng màu: đỏ cam, vàng, trắng nóng

### Sơn Tinh (`son_tinh`) — 5★, hệ Mộc (xanh lá #4cc46a), vai tank

- Thể hình/tư thế: Sơn thần nam, vạm vỡ như núi, vững như tảng đá
- Tóc: tóc nâu rậm xõa, vài sợi bện rêu
- Mắt/biểu cảm: mắt xanh rêu, trầm
- Trang phục/đạo cụ: áo choàng vỏ cây, giáp đá có rêu, trượng gỗ có linh chi
- Bảng màu: xanh lá đậm, nâu, xám đá

### Mai An Tiêm (`mai_an_tiem`) — 4★, hệ Mộc (xanh lá #4cc46a), vai healer

- Thể hình/tư thế: Nam trung niên nông dân khoẻ, thân thiện, ngồi nửa thân với quả dưa
- Tóc: tóc búi củ hành, khăn đóng nâu
- Mắt/biểu cảm: mắt đen hiền, nụ cười ấm
- Trang phục/đạo cụ: áo nâu sồng, nón lá, ôm quả dưa hấu xẻ lộ ruột đỏ
- Bảng màu: xanh lá, đỏ dưa, nâu

### Artemis (`artemis`) — 4★, hệ Mộc (xanh lá #4cc46a), vai dps

- Thể hình/tư thế: Nữ thợ săn, mảnh, tư thế giương cung
- Tóc: tóc nâu hạt dẻ buộc tết thấp, cài lá sồi
- Mắt/biểu cảm: mắt xanh lục bạc, sắc
- Trang phục/đạo cụ: áo da nai ngắn xanh rêu, mặt nạ nửa mặt, cung bạc
- Bảng màu: xanh lá, bạc, nâu da

### Atalanta (`atalanta`) — 3★, hệ Mộc (xanh lá #4cc46a), vai dps

- Thể hình/tư thế: Nữ vận động viên chạy, năng động, chân trần
- Tóc: tóc ngắn chấm vai màu đồng, băng đô lá
- Mắt/biểu cảm: mắt xanh hổ phách, cười tinh nghịch
- Trang phục/đạo cụ: áo chạy xanh lá ngắn, dây da quấn chân, quả táo vàng trên tay
- Bảng màu: xanh lá, vàng đồng, kem

### Apollo (`apollo`) — 5★, hệ Quang (vàng #ffd84a), vai support

- Thể hình/tư thế: Nam thần ánh sáng, cao, đẹp, đang gảy đàn lia
- Tóc: tóc vàng gợn sóng, vòng nguyệt quế
- Mắt/biểu cảm: mắt vàng ấm, nụ cười tự tin
- Trang phục/đạo cụ: áo choàng trắng viền vàng, đàn lia khắc mặt trời
- Bảng màu: vàng, trắng, cam nhạt

### Ra (`ra`) — 4★, hệ Quang (vàng #ffd84a), vai dps

- Thể hình/tư thế: Thần mặt trời Ai Cập, nam đầu chim ưng, đầu đội đĩa mặt trời
- Tóc: mũ đĩa mặt trời đỏ vàng, mỏ chim ưng vàng kim
- Mắt/biểu cảm: mắt Horus kẻ viền
- Trang phục/đạo cụ: giáp ngực vàng bản lớn, pháp trượng quyền năng, váy lụa trắng
- Bảng màu: vàng kim, đỏ, xanh ngọc

### Eos (`eos`) — 3★, hệ Quang (vàng #ffd84a), vai support

- Thể hình/tư thế: Nữ thần bình minh, dáng nhẹ như bay, cánh tay mở rộng
- Tóc: tóc hồng cam dài bồng, ngón tay hồng
- Mắt/biểu cảm: mắt cam đào, mơ màng
- Trang phục/đạo cụ: váy voan hồng cam nhiều tầng, trải sáng rạng đông
- Bảng màu: vàng nhạt, hồng cam, trắng

### Heimdall (`heimdall`) — 3★, hệ Quang (vàng #ffd84a), vai tank

- Thể hình/tư thế: Người gác cổng nam, đứng thẳng như tượng, thổi tù và
- Tóc: tóc trắng bạc cắt gọn, ria
- Mắt/biểu cảm: mắt vàng nhìn xa, đồng tử sáng
- Trang phục/đạo cụ: giáp trắng và vàng, tù và sừng, kiếm đặt trước người
- Bảng màu: vàng, trắng, xanh trời

### Hel (`hel`) — 5★, hệ Ám (tím #9a5cff), vai dps

- Thể hình/tư thế: Nữ chúa u minh, nửa người sáng nửa người xám tử thi
- Tóc: tóc đen dài, nửa mái trắng bạc
- Mắt/biểu cảm: mắt tím nhạt, buồn lạnh, một bên mờ như sương
- Trang phục/đạo cụ: áo choàng nhung tím đen, xương sườn lộ bên trái, vương miện sương
- Bảng màu: tím, đen, xám xanh

### Loki (`loki`) — 4★, hệ Ám (tím #9a5cff), vai support

- Thể hình/tư thế: Nam kẻ lừa đảo, dáng nghiêng, cười nhếch, bóng phân thân
- Tóc: tóc đen vuốt ngược, một lọn xanh lá
- Mắt/biểu cảm: mắt tím xanh, nháy
- Trang phục/đạo cụ: áo choàng tím lục, dao găm cong, mặt nạ nửa mặt cười
- Bảng màu: tím, xanh lục, đen

### Nyx (`nyx`) — 3★, hệ Ám (tím #9a5cff), vai support

- Thể hình/tư thế: Nữ thần đêm, cao, uy nghi, áo choàng như trời sao
- Tóc: tóc đen thẫm điểm sao như dải ngân hà
- Mắt/biểu cảm: mắt tím sâu, lặng
- Trang phục/đạo cụ: áo choàng bầu trời đêm, trăng lưỡi liềm, vòng cổ sao
- Bảng màu: tím, xanh đêm, bạc

### Fenrir (`fenrir`) — 3★, hệ Ám (tím #9a5cff), vai dps

- Thể hình/tư thế: Sói khổng lồ hình người thú, dữ tợn, xích đứt
- Tóc: bờm xám bạc rối, tai sói
- Mắt/biểu cảm: mắt tím vàng, hung hãn
- Trang phục/đạo cụ: giáp lông, xích đứt quanh cổ tay, răng nanh
- Bảng màu: tím, xám sói, đen

### Cô Tấm (`co_tam`) — 5★, hệ Tim (hồng #ff7fb0), vai healer

- Thể hình/tư thế: Cô gái dân gian trẻ, hiền, tóc dài, đứng với bông sen
- Tóc: tóc đen dài xõa, cài trâm hoa sen hồng
- Mắt/biểu cảm: mắt đen long lanh, ngấn lệ nhẹ
- Trang phục/đạo cụ: áo tứ thân nâu hồng nhạt, yếm đào, bông sen phát sáng
- Bảng màu: hồng, trắng sen, xanh lá nhạt

### Freyja (`freyja`) — 4★, hệ Tim (hồng #ff7fb0), vai healer

- Thể hình/tư thế: Nữ thần tình yêu và chiến tranh, vừa quyến rũ vừa dũng mãnh
- Tóc: tóc vàng đỏ bện, vòng hoa hồng
- Mắt/biểu cảm: mắt hổ phách sáng
- Trang phục/đạo cụ: giáp nhẹ hồng vàng, chiếc vòng cổ ánh kim, mèo thần bên cạnh
- Bảng màu: hồng, vàng đồng, kem

### Eir (`eir`) — 3★, hệ Tim (hồng #ff7fb0), vai healer

- Thể hình/tư thế: Nữ y sĩ trầm tĩnh, đang rải thuốc
- Tóc: tóc nâu sáng bện vòng, khăn xanh
- Mắt/biểu cảm: mắt nâu xanh, nhìn chăm chú
- Trang phục/đạo cụ: áo choàng thầy thuốc hồng nhạt, túi cỏ thuốc, bình thủy tinh
- Bảng màu: hồng nhạt, xanh lá, trắng

### Orpheus (`orpheus`) — 3★, hệ Tim (hồng #ff7fb0), vai support

- Thể hình/tư thế: Nhạc công nam trẻ, thanh mảnh, đứng nhắm mắt khi gảy đàn
- Tóc: tóc nâu xoăn nhẹ, vòng nguyệt quế héo
- Mắt/biểu cảm: mắt nhắm / mi dài, mặt buồn
- Trang phục/đạo cụ: áo choàng hồng nhạt sờn, đàn lia, nốt nhạc bay
- Bảng màu: hồng, nâu, xanh đêm

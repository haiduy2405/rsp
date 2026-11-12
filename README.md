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
- `core/summon.js`: rút seed; tỉ lệ gốc 5★ 0.5% / 4★ 13% / 3★ 86.5%, bảo đảm 5★ ở lượt 60, ≥1 4★ mỗi 10 lượt, rate-up banner văn hóa 50%, trùng → Mảnh, đổi 200 Mảnh lấy nhân vật chưa có. Tỉ lệ thực (tính cả bảo đảm): 5★ 2.00%, 4★ 16.44%, 3★ 81.57% — UI hiện cả hai; 5★ thực = 2% theo GDD.
- Tín Vật: lượt đầu bắt buộc 4★ đúng văn hóa đã chọn, không tính vào pity.
- `core/onboarding.js`: tạo phi hành gia (tên, biệt danh, quê tùy chọn, 8 avatar tạm), tặng 10 Vé Triệu Hồi, hướng dẫn trận đầu (bỏ qua được).
- Màn: Nghi Thức Triệu Hồi (xác nhận trước khi tiêu, lịch sử, đổi Mảnh), Nhật ký (7 mục, mở theo khu đã vượt), Cài đặt (ngôn ngữ, âm lượng, xuất/nhập, xóa dữ liệu).
- Save v4 (migrate từ v3). Data mới: `banners.json`, `story.json`.
- E2E: `NODE_PATH=$(npm root -g) node tests/e2e/m4-newplayer.cjs` (cần `npm run serve`).

## M5 — Art, âm thanh, cân bằng, polish
- **Asset** (art tạm sinh bởi `tools/gen-art.py`, thay bằng cách ghi đè file): `www/assets/{characters,orbs,bg,ui}`; thả file theo tên trong `docs/ART_PROMPTS.md` rồi chạy `node tools/check-assets.js --write` (cập nhật manifest, in danh sách thiếu/thừa, cảnh báo file nặng). Thiếu file thì game tự vẽ hình khối; manifest chỉ chứa file có thật nên không bắn 404.
- **Âm thanh**: `ui/audio.js` tổng hợp bằng WebAudio, dữ liệu trong `data/audio.json` (3 bài nhạc hub/battle/boss, 16 SFX). Cài đặt: âm lượng, nhạc, SFX, rung. Tự dừng khi app ẩn. Nguồn: `docs/CREDITS.md`.
- **Cân bằng**: `node tools/balance-sim.js --targets [đội] [lượt] [đường thử] [seed]` so tỉ lệ thắng và thời gian chuyến với `config.balance`; nhật ký ở `docs/BALANCE_LOG.md`.
- **Polish**: particle khi xóa ngọc, rung khi bị đánh, nút Back (trong chuyến bị bỏ qua, màn khác về Hub), safe area, khóa dọc, vùng chạm ≥ 44 px.
- E2E: `tests/e2e/m5-*.cjs` (cần `npm run serve`).

### Polish đợt 2 (sau thử máy thật)
- Kéo ngọc: nội suy theo đoạn giữa hai điểm chạm nên kéo nhanh không mất ô.
- Chiến đấu: đòn bay từ nhân vật tới quái, chớp/rung quái, thanh máu mượt, số sát thương lớn, "Tổng N", vòng kỹ năng, viền đỏ khi bị đánh, báo "Không ai cùng hệ" khi ăn ngọc hệ đội không có.
- Hiệu ứng trạng thái trên quái: Bỏng, Độc, Choáng, Đóng băng, Khiên/Miễn nhiễm, Giảm công.
- Hướng dẫn trận đầu: bàn tay chỉ nước đi cụ thể (tìm bằng core).
- Menu: thẻ nhân vật có chân dung, hồ sơ phi hành gia ở Hub, khu có biểu tượng hệ, lật thẻ triệu hồi.
- Soak test: `NODE_PATH=$(npm root -g) node tests/e2e/m5-soak.cjs [phút]` (cần `npm run serve`).

## Polish đợt 3
- Kéo ngọc tự do: được đi lại ô đã qua (`cell_repeated` bỏ). Bắc cầu ô trung gian theo quỹ đạo ngón tay nên kéo vòng tròn nhanh, cắt góc không bị đứt; trễ nhẹ 6% ô chống rung ở biên.
- Viên bị đi qua trượt + nổi lên (có bóng), viên đang cầm luồn bên dưới; tiếng ngọc chạm nhau 3 cao độ.
- Nhấn giữ tướng/quái (450ms) trong trận: bảng chi tiết (chỉ số, kỹ năng, hiệu ứng đang có). Chạm nhanh vào tướng vẫn là dùng kỹ năng.
- Art quái procedural (24), `tools/gen-art.py`.
- e2e mới: flows, monkey, m5-inspect, m5-circle.

## Polish đợt 4
- Khóa mục tiêu: chạm quái = cả đội dồn đòn (action `target`, không tốn lượt); đi chéo được (`allowDiagonal`, đã cân lại).
- Nhịp thưởng: kéo xong → highlight mọi cụm ngọc vừa tạo → nổ từng combo (số tổng đếm tăng) → ngọc rơi → đòn bay. Quái cuối: slow-motion → pháo hoa → rương mở → từng món loot hiện ra.
- UI/UX mới: design system (kính + khung vàng), font tự host, app-like (chặn bôi chọn/menu giữ), PWA (nút cài, fullscreen), góc tiền tệ trên phải, màn Kho đồ, credit "made by duyluma" + version (`npm run stamp`).
- Đội hình: 3 đội lưu sẵn, đổi đội trưởng, màn chuẩn bị trước trận (chọn khu → chọn đội → Vào trận). Đội trưởng nổi bật trong trận (ô cao hơn, viền vàng, vương miện).
- Âm thanh: mẫu CC0 (`tools/build-audio.py`), cao độ combo tăng dần; synth dự phòng.

## Màn hình tải và dữ liệu offline (v0.10)
- `www/js/ui/loading.js`: màn hình tải (tháp sáng dần theo tiến độ, mẹo xoay vòng `load.tip.*`, "Chạm để vào" cũng mở khóa âm thanh). Thêm mẹo mới: thêm key `load.tip.N` ở cả hai file i18n và tăng `TIP_COUNT`.
- `www/js/ui/offline.js` + Cài đặt → "Dữ liệu offline": tải toàn bộ tệp liệt kê trong `www/precache.json` vào Cache Storage `rsp-v1` (cùng kho với `sw.js`). `precache.json` do `tools/gen-precache.js` sinh, tự chạy trong `npm run stamp`.
- Khi game nặng hơn (art/nhạc thật): không cần sửa code, chỉ stamp lại là nút tải tính đúng dung lượng.

## Ải 3 độ khó, đường đi roguelike (v0.11)
- Mỗi khu có 3 độ khó **Dễ → Vừa → Khó**, mở lần lượt (`core/stage.js`). Thắng Dễ mở khu kế; Vừa/Khó chỉ để farm nguyên liệu (rớt nhiều và ngon hơn: `config.difficulty.*.gold/drop`).
- Mọi ải cùng bố cục `config.run.layout` (5 tầng, 3 cửa mỗi tầng): 2 tầng toàn cửa đánh (thường, thỉnh thoảng Elite), 1 tầng tự do (rương/nghỉ/sự kiện/shop/trận), 1 tầng Elite bắt buộc, rồi Boss cuối ải. Mọi đường đều qua ít nhất 2 trận thường + 1 Elite + Boss. Mọi khu có Boss riêng.
- Chưa có năng lượng/stamina. Khi làm: thêm chi phí theo độ khó vào `config.difficulty` (Dễ ít, Khó nhiều) và trừ lúc `startRun` trong `main.js`.
- Save v5: `clears` theo độ khó `{ zoneId: { easy, normal, hard } }` (migrate v4 → v5 tự động).
- Cân bằng: `DIFF=hard node tools/balance-sim.js --targets` (đội mạnh hơn theo `difficulty.*.sim`).

## Hệ tướng v2, bước 1 (v0.12)
- **Tộc**: Thần / Nhân / Thú / Long / Linh (`race` trong characters.json, monsters.json; danh sách ở `config.races`).
- **Cấp 1–50**: EXP bằng Đan Tinh Hoa 3 cỡ (Giọt 100 / Bình 500 / Vạc 2500 EXP, `config.elixir`) hoặc cho ăn Tiểu Linh 1–2★ (`data/fodder.json`, rớt từ ải theo hệ khu và độ khó; cùng hệ ×1.5 EXP). Tiểu Linh bán được lấy Vàng ở màn Vật phẩm.
- **AOE**: xoay nhóm ngọc từ 5 viên (`config.group.aoeSize`) thì tướng đó đánh toàn bộ quái.
- **Thẻ tướng** kiểu ToS (`ui/hero-ui.js`): HP, ATK, Hồi, Tộc, hệ; dùng ở Bộ sưu tập và bảng thông tin trong trận.
- **Tạm dừng** trong trận: chỉnh âm thanh hoặc thoát. Thoát bỏ trận dở, giữ tiến trình các cửa đã xong (chơi lại từ lúc chọn cửa). Test: `tests/e2e/pause.cjs`.
- Lưu ý: save đã reset theo v6; thức tỉnh cũ vẫn tạm giữ cho tới v0.14 (Form 2).

## Đòn đánh theo từng tướng (v0.13)
Sau khi xoay ngọc: mỗi tướng nảy số sát thương của mình ngay trên ô tướng (màu theo hệ), giữ một nhịp, rồi lần lượt bay gộp vào ô tổng, tổng nổ to, rồi mới bắn từ tướng vào quái. Nhịp chỉnh ở `ANIM` (game.js), vẽ ở `render.js` (`view.pops`). Test thủ công: `tests/e2e/pause.cjs` cho tạm dừng; xem hiệu ứng bằng `?debug`.

## Cấp kỹ năng, Lễ Vật, bị động (v0.14)
- **Kỹ năng có cấp** (chủ động, đội trưởng, bị động): 3★ tối đa cấp 3, 4★ cấp 4, 5★ cấp 5. Mỗi cấp +10% sức mạnh (`config.skillUp.perLevel`); cấp tối đa giảm 1 hồi chiêu. Tính ở `core/kit.js` (`resolveKit`).
- **Lễ Vật** theo tộc, 3 bậc (`than_1`…`linh_3`): rớt theo tộc của quái trong trận, độ khó cao rớt bậc cao (`config.offeringTier`). Nâng kỹ năng tốn Lễ Vật đúng tộc của tướng + Vàng (`config.skillUp.cost`).
- **Bị động**: kiểu `stat` (tăng HP/ATK/Hồi cho bản thân, cả đội hoặc một hệ) hoặc kiểu `trigger` (đầu trận, hoặc mỗi N lượt chạy các đơn vị kỹ năng như kỹ năng chủ động). Dữ liệu ở `characters.json` (`passive`).
- Lưu game v7 (migrate thêm `skillLv`, `offerings`). Kỹ năng chủ động của 24 tướng giữ nguyên bản cũ, bản thiết kế mới đi cùng Form 2 (v0.15).

## Đường đi đa dạng, Di Vật, sự kiện (v0.15)
- **Bố cục 6 tầng** (`config.run.layout`): tầng đánh (toàn cửa chiến đấu) xen kẽ tầng sự kiện (toàn cửa phục vụ), rồi tầng Elite (đủ 3 cửa Elite), rồi Boss. Mọi đường đều qua đủ trận, không thể chỉ nhặt rương/nghỉ rồi tới Boss; các đường vẫn khác nhau vì loại cửa ngẫu nhiên và **quái xem trước ở từng cửa** (`run.preview`).
- **Cửa mới**: Bầy quái (3 quái yếu hơn, thưởng nhiều hơn), Đền thờ (chọn 1 trong 3 Di Vật miễn phí), Thương nhân (bán Di Vật theo độ hiếm và vật phẩm bằng Vàng trong chuyến).
- **Di Vật** (`data/relics.json`, `core/relic.js`): 29 món, 3 độ hiếm, chỉ có hiệu lực trong chuyến. Gồm tăng chỉ số, khiên/tăng công đầu trận, hút máu, hồi sinh một lần, đánh toàn bộ quái từ 4 ngọc (Lăng Kính), thêm sát thương combo, giảm hồi chiêu đầu trận, thêm Vàng/rớt đồ... Nguồn: chọn 1 trong 3 sau khi thắng Elite, Đền thờ, Thương nhân, sự kiện.
- **16 sự kiện** (`data/events.json`), thêm hiệu ứng `relic` (Di Vật ngẫu nhiên, có thể đòi bậc tối thiểu) và `maxHpPct` (máu tối đa của chuyến).
- Nhớ: bot của balance-sim chọn Di Vật hiếm nhất và mua Di Vật trước vật phẩm.

## Đặc tính quái, khó lên (v0.16)
- **Đặc tính quái** (`config.affix`, `core/affix.js`): 8 buff riêng của từng quái (Cứng cáp, Cuồng nộ, Giáp Khiên, Gai nhọn, Tái sinh, Xuyên giáp, Nhanh nhẹn, Bất khuất), mở dần theo khu và độ khó. Cuộn lúc sinh cửa nên hiện trước ở danh sách cửa (`[Cứng cáp, Cuồng nộ]`) và trên quái trong trận. Elite hay có, Boss luôn có 1-3.
- Hệ số khu `run.zoneScale` chỉnh lại; chi tiết số liệu ở `docs/BALANCE_LOG.md`.

## Form 2 (v0.17)
- Thức tỉnh một bậc: lên **Form 2** (chỉ số +20%, kỹ năng chủ động viết lại cho từng tướng trong `characters.json` > `form2`, đội trưởng mạnh hơn). Form 1 tối đa Level 30, Form 2 lên 50. `awaken` trong save là 0/1 (save v8, migrate từ bản cũ).
- Art Form 2 hiện dùng chung art Form 1 (asset tạm); Duy cấp art sau.
- Nhịp tiến triển ba giai đoạn (tân thủ/trung kỳ/hậu kỳ): `docs/PROGRESSION.md`; `tools/loot-sim.js` đo số chuyến để đủ Form 2 so với `config.balance.pacing`.

## Hiệu ứng trận, thông tin ải, nhạc mới (v0.18)
- **Hồi máu**: khi ngọc tim tan, mỗi tướng nảy số hồi (xanh) theo chỉ số Hồi, bay vào thanh máu đội và cộng máu lúc tới nơi; cả bàn sáng xanh với dải sáng quét lên, lá sáng bay từ ngọc tim.
- **Nhóm 4 ngọc**: nhân ×1.5 (hiện chữ + vòng sóng). **Nhóm 5+ ngọc**: sinh Ngọc Nâng Cấp (hiệu ứng hút hạt, ngọc nảy ra, vòng vàng + tia xoay); mỗi Ngọc Nâng Cấp nằm trong nhóm sau này cộng +25% sát thương/hồi (`group.enhancedBonus`).
- **Giữ vào độ khó** (chọn ải) hoặc chuột phải: bảng thông tin quái, đặc tính, bảng rớt và tỉ lệ (`core/stageinfo.js`).
- **Nhạc nền viết lại** (`ui/audio.js` + `data/audio.json`): hợp âm, pad vang, rải nốt, giai điệu 4 ô nhịp, bè trầm, trống; ba bài hub/battle/boss. Kiểm bằng `tests/e2e/music.cjs`.

## Giao diện mới (v0.19)
Bảng màu mực/xương/đỏ con dấu: đỏ chỉ cho hành động chính (nút BATTLE, Primary), vàng chỉ cho tiền tệ và độ hiếm. Tiêu đề dùng phông Fraunces (có tiếng Việt, tự host), thân chữ Be Vietnam Pro. Hub, bản đồ ải, HUD trận và nền trận đã phối lại. Kế hoạch art/nhạc thật: `docs/ART_PLAN.md`.

## Kinh tế mới (v0.20)
- **EXP sau trận**: mỗi trận thắng cộng EXP cố định cho cả đội, nhận khi chuyến kết thúc (cả khi thua); tăng theo khu và độ khó (`config.exp.battle`).
- **Đan Tinh Hoa** 3 cỡ thay Bánh EXP (rớt theo `config.loot.*.elixir`). **Vé Triệu Hồi**: 1 vé/lượt; Linh Thạch đổi vé (100 → 1, 900 → 10, `config.summon.ticketPacks`).
- **Vàng ×10** toàn hệ thống (loot, shop, Di Vật, kỹ năng, Thức tỉnh, bán Tiểu Linh) để dễ phân biệt với các tiền tệ khác. Save v9 tự đổi dữ liệu cũ.
- **Hòm đồ** (đổi tên từ Kho đồ): lưới ô icon theo độ hiếm, chạm xem chi tiết, tab lọc.
- Vuốt mép / nút Back của trình duyệt = nút mũi tên quay lại ở góc trái trên.

## Avatar (v0.21)
- 12 avatar phi hành gia vẽ SVG (`ui/avatar.js`): nam/nữ, trẻ/trung niên/già, 6 tông da. Người chơi cũng có thể tải ảnh riêng (cắt vuông, thu 128px JPEG, lưu trong save, giới hạn `config.onboarding.photoMax`).

## Linh Thạch chỉ từ lần clear đầu (v0.23)
- Loot thường không còn rớt Linh Thạch. Mỗi ải (khu × độ khó) tặng Linh Thạch một lần ở lần clear đầu (`config.firstClear`: Dễ 60 / Thường 100 / Khó 150, +10%/khu). Hiện trong thông tin ải và màn kết thúc.
- Nguồn Linh Thạch khác (nhiệm vụ ngày, mốc tiến trình, sự kiện, gói ủng hộ) sẽ thêm ở bản online.

## Tách main.js (v0.23.1)
- `ui/dom.js` (h, btn, $), `ui/icons.js` (icon vật phẩm), `ui/screen-items.js` (Hòm đồ, bách khoa), `ui/screen-summon.js` (triệu hồi), `ui/screen-profile.js` (hồ sơ, cài đặt, onboarding). Mỗi màn là `install(app)`; trạng thái dùng chung (progress, lang…) đi qua đối tượng `app`, màn gọi chéo qua `app.*`. main.js còn ~1250 dòng (chuyến leo, chọn đội, màn tướng).

## Mảnh ghép, Shop hằng ngày, Vé Triệu Linh (v0.24)
- **Mảnh riêng**: 3/4/5 mảnh của một tướng 3/4/5★ đổi đúng tướng đó. **Mảnh chung** theo sao: 6/8/10 mảnh đổi tướng ngẫu nhiên chưa có. Tướng trùng (triệu hồi hay mảnh của tướng đã có) tự đổi thành mảnh chung 3/4/5. Không có mảnh 1–2★ (`config.fragments`, `core/fragments.js`).
- **Nguồn mảnh**: ải rớt mảnh tướng 3★ theo hệ khu vực; shop bán mảnh 3–4★ (Linh Thạch); mảnh 5★ không rớt ải, không bán shop (chỉ qua mảnh chung từ tướng 5★ trùng; nguồn khó hơn sẽ thêm sau).
- **Vé Triệu Linh**: mỗi vé ra 1 Tiểu Linh 1★ (85%) / 2★ (15%) hệ ngẫu nhiên.
- **Shop hằng ngày** (`core/shop.js`, `config.shop.offers`): reset theo ngày; món đầu tiên miễn phí = 50 Linh Thạch; bán Đan, Vé Triệu Linh, Tinh Thạch, Lễ Vật, mảnh 3–4★. Save v10.

## v0.25.0 — art thật cho 24/24 tướng
- Toàn bộ 24 tướng có art thật (sinh bằng Gemini + ChatGPT), nhập bằng `tools/art-import.py <ảnh> <id>` (cắt watermark, 2:3, card 1024×1536 + icon 512).

## v0.25.1 — art thật cho 27/27 quái
- Toàn bộ 27 quái (512×512) dùng art thật, sinh bằng ChatGPT cùng phong cách viền mực đậm + tô phẳng. Còn lại: nền hub/battle và logo.

## v0.25.2 – Art nền và logo
- Thay `bg/battle.webp` (đang dùng trong trận), `bg/hub.webp` và `ui/logo.webp` bằng art thật.

## v0.26.0 – Hub và logo dùng art thật, quái trong suốt
- Màn chính: ảnh `bg/hub.webp` làm nền, ngọc khu đặt trên các đảo nổi (`pos` trong `hubScene`, `main.js`). Bỏ tháp/đảo/mây SVG cũ.
- Màn tải: logo `ui/logo.webp` thay chữ tiêu đề (tải lỗi thì giữ chữ).
- Quái và logo đã tách nền phẳng thành alpha bằng `tools/cut-bg.py <file.webp>...` (flood-fill từ viền, mép làm mềm). Ảnh quái chưa tách thì chạy lại công cụ này.

## v0.27.0 – Nâng cấp giao diện (mốc A + Triệu hồi)
- Bảng màu mới rút từ art (đêm tím chàm, vàng đồng, xanh ngọc) trong `:root` của `app.css`; panel kính tím, nút chính vàng đồng, nút phụ tím; nền các màn con là art hub tối đi; chuyển màn có trượt nhẹ.
- Triệu hồi: tab banner cuộn ngang, thẻ banner có chân dung tướng của văn hóa, thanh tiến độ bảo đảm, tỉ lệ thu gọn (`<details id="rates">`, vẫn đầy đủ), nút rút dính đáy, kết quả dạng lưới 3 cột với hiệu ứng lật thẻ và quầng sáng 5★.

## v0.27.1 – Giao diện: trận đấu và độ đọc
- Màu canvas trận (`render.js`) đổi sang bảng chàm/vàng cho khớp UI; tiêu đề màn con chừa chỗ cho nút Back; nền màn con tối hơn để chữ rõ.

## v0.27.2 – Mượt hơn khi khởi động
- Ảnh thẻ tướng giảm còn 768×1152 (3,5 MB thay vì 4,6 MB) và được tải nền sau khi vào game (`assets.js`), không chặn màn tải; chi tiết tướng dùng chân dung tạm cho tới khi ảnh thẻ về. Giảm RAM giải mã trên máy yếu.

## v0.28.0 – Art vẽ tay phẳng cho toàn bộ game
- Làm lại 24 tướng, 27 quái, nền hub, nền trận và logo theo phong cách minh họa phẳng vẽ tay (viền nâu đậm, mảng màu ấm, hạt giấy), bỏ vẻ "AI bóng loáng". Công cụ nhập: `tools/art-import2.py` (tướng, 2 tướng/ảnh), `tools/art-import-mon.py` (quái, lưới 3×2, tự tách nền kem), nền/logo cắt bằng cùng bộ hàm.
- UI đổi sang bảng nâu đất / kem giấy / vàng đồng khớp art (`:root` trong `app.css`, màu canvas `render.js`); ngọc khu trên hub đặt lại theo các đảo của nền mới.

## v0.28.2 – Cân bằng khu
- Theo lệnh Duy: Thủy khó hơn (HP ×1,4, ATK ×1,25), Hỏa nhẹ lên (×1,1/×1,08), Ám giảm nhẹ (×0,92), Tim dễ hơn (×0,78/×0,8). Máy chơi giả: thắng Thủy 99% · Hỏa 95% · Mộc 90% · Quang 81% · Ám 78% · Tim 70% (trước: 100/98/90/81/69/43), thời lượng chuyến Thủy 8,6→13,6 phút.
- Nguồn mảnh 5★: sẽ đến từ các sự kiện sau này (chưa làm gì ở bản này).

## v0.28.3 – Màu trận đấu theo art mới
- Bàn ngọc, thẻ tướng và chấm kỹ năng đổi từ chàm sang nâu đất; bỏ lớp khử bão hòa/phủ tối của nền trận cũ vì nền mới đã ấm sẵn.

## v0.29.0 – Giao diện: thẻ tướng, thẻ khu, màn kết quả
- Bộ sưu tập: mỗi thẻ tướng hiện HP/ATK (tính bằng `statsFor`, không viết cứng).
- Chọn khu: thẻ khu đổi nền nâu ấm và có ba nhãn Dễ/Thường/Khó, sáng vàng khi độ khó đó đã qua.
- Kết quả chuyến: tiêu đề "đóng dấu", đội hình hiện lần lượt, huy hiệu cấp mới bật lên kèm vòng sáng cho tướng lên cấp, khung loot trượt vào; tắt hết khi hệ thống bật giảm chuyển động.
- Chi tiết tướng: khung đầu đổi nền sang nâu ấm theo màu hệ.

## v0.30.0 – Icon vẽ tay và giao diện Triệu hồi mới
- Icon mới theo phong cách vẽ tay (sinh bằng ChatGPT, tách nền bằng `tools/art-import-icons.py`): 6 viên ngọc hệ/icon khu (`assets/orbs`), 6 icon nút (`assets/ui/icons`: đội hình, triệu hồi, cửa hàng, nhiệm vụ, trợ giúp, cài đặt), 15 icon tiền tệ/vật phẩm (`assets/ui/items`). Nút dock, pill tiền tệ, shop, hòm đồ, triệu hồi đều dùng ảnh; khóa nào chưa có art vẫn dùng SVG cũ (`IMG_KEYS` trong `icons.js`).
- Triệu hồi: ví vé/Linh Thạch dạng viên thuốc, thẻ tab banner bo tròn, sân khấu banner có vòng phép xoay chậm, ba thẻ tướng đại diện xòe hình quạt, ruy băng tên banner, thanh bảo đảm 5★ có mốc, hàng mua vé có icon, thanh rút dính đáy với icon vé và nút "miễn phí hôm nay" nhấp nháy nhẹ. Giữ nguyên các id để test.

## v0.30.1 – Nốt icon còn lại
- Thêm 6 icon vẽ tay (bộ sưu tập, từ điển, cốt truyện, hòm đồ, manh mối, quay lại); nút quay lại góc trái trên dùng icon mới. Chữ nút rút ở Triệu hồi nhỏ lại cho đỡ chật.

## v0.31.0 – Nút Chiến đấu mới và âm thanh trận
- Nút CHIẾN ĐẤU ở hub: huy hiệu men đỏ vẽ tay (`ui/icons/battle.webp`), hai kiếm chéo, nhãn nằm trên dải kem, nhấp nhô nhẹ (tắt khi giảm chuyển động); cỡ chữ riêng cho tiếng Việt.
- Âm ngọc nhỏ lại (chọn/kéo/thả/ghép/combo/xem trước giảm gain còn ~35–50% trong `audio.json#samples`).
- Âm đánh trúng, trúng đòn, hạ quái và kỹ năng làm lại bằng tổng hợp nhiều lớp (`tools/build-sfx.py`: thân tụt tần, tiếng chát, đuôi trầm; kỹ năng là gió tụ lực, chùm nốt lấp lánh rồi bùng nổ). `hit` có 3 biến thể và `skill` có 2 biến thể chọn ngẫu nhiên (`audio.json#variants`, `audio.js`).

## v0.32.0 — Icon 12 hiệu ứng
- 12 icon vẽ tay (`www/assets/ui/fx/<key>.webp`, manifest key `fx:<key>`): Bỏng, Độc, Choáng, Đóng băng, Giảm công, Khóa ngọc (tiêu cực, viền đỏ vuông) · Khiên, Hồi máu, Tăng công, Phản đòn, Xuyên giáp, Miễn nhiễm (tích cực, viền xanh tròn).
- Trong trận chỉ hiện icon + số lượt (Độc thêm ×tầng), không còn chữ. Bấm giữ quái/tướng xem tên + mô tả, kèm icon (cả chi tiết tướng).
- `game.refresh()` (đồng bộ view từ state) cho test; `tests/e2e/fxshot.cjs` chụp thử badge.

## v0.33.0 — 7 ải mỗi độ khó, icon vùng đất
- Mỗi khu có 3 độ khó (Dễ/Vừa/Khó) × 7 ải. Mỗi ải là một chuyến mini (3 tầng; ải 7 có thêm Elite + Boss, quái boss to hơn `kindScale.boss`). Ải 1–6 quái thường, ải 7 boss.
- Mở khóa tuần tự: qua ải n mở ải n+1; xong 7 ải Dễ thì mở 7 ải Vừa **và** mở khu kế; xong Vừa mở Khó. Quay lại ải nào cũng farm được.
- Độ khó chỉ khác chỉ số + thưởng + tỉ lệ rớt (`config.difficulty`); quái trong ải y như nhau. Đã **bỏ hẳn affix** (buff ngẫu nhiên lên quái).
- Chỉ số tăng dần theo ải (`run.stageScale` từ ải 1 đến ải 7), thưởng hoàn thành theo `run.stageReward` (ải boss nhiều nhất); Linh Thạch lần đầu chia theo ải (tổng 7 ải = `firstClear`).
- Save v11: thêm `stages[zone][diff]` (ải cao nhất đã qua); save cũ quy đổi: đã thắng độ khó nào thì coi như xong 7 ải độ khó đó.
- Màn chọn ải mới (3 tab độ khó, danh sách 7 ải, giữ để xem quái/bảng rớt), nút "Ải tiếp theo" ở màn kết quả.
- Icon 6 vùng vẽ tay (`assets/ui/zones/`, key `zone:<id>`) thay viên ngọc ở màn chính và danh sách vùng; vùng chưa mở xám + khóa.
- Cân bằng: ải 7 khớp dải thắng cũ (`STAGE=7 node tools/balance-sim.js --targets`), khu Ám/Tim tăng hệ số khu.

## v0.33.1
- Nút Install/Fullscreen dời xuống giữa màn chính, không che đảo; khu Tim tăng hệ số (mô phỏng ải 7: 70%, trong dải).

## v0.33.2
- Chi tiết tướng và Đội hình chuyển tông nâu ấm: header bớt ám màu hệ, nhãn Active hổ phách, viền 3★ đồng, ô chọn hổ phách.

## v0.33.3
- Nút Thức tỉnh to, vàng sáng khi đủ nguyên liệu (mờ khi thiếu); thẻ thưởng màn kết quả chuyển nâu ấm.

## v0.34.0 — Animation
- Quái thở nhẹ + lao tới khi tấn công; nút lún khi bấm; danh sách ải trượt vào, ải sẵn sàng nhấp nháy, boss phát lửa.
- Bảng/hộp thoại bật lên; chi tiết tướng vào sân; nút Thức tỉnh phát sáng khi đủ điều kiện; tiền tệ nảy khi đổi; đom đóm ở màn chính.
- Tôn trọng `prefers-reduced-motion`.

## v0.34.1 — Animation (phần 2)
- Ô tướng sẵn sàng kỹ năng: hào quang xanh dâng lên + hạt sáng bay.
- Cửa hàng: ưu đãi trượt vào lần lượt, nút lún. Triệu hồi: thẻ úp nhịp sáng tím.
- Số sát thương đã có bật/co sẵn (không đổi).

## v0.34.2
- Hào quang ô tướng sẵn sàng kỹ năng đậm hơn, 4 hạt sáng bay lên (đã kiểm bằng ảnh chụp).

## v0.34.3
- Trong trận: nhấn giữ icon buff của đội (trên thanh máu) hiện chi tiết từng hiệu ứng.

## v0.35.0 — Màn chọn cửa
- Tiêu đề có huy hiệu vùng, nhãn độ khó, chấm tầng (boss viền đỏ), thanh máu có tim.
- Bản đồ: trụ đá có lửa theo hệ của vùng, vòng viền vàng quanh cửa, mép mờ dần.
- Danh sách cửa: số hiệu, icon loại cửa, ảnh quái xem trước; vật phẩm mỗi loại một màu; nút thoát dạng viền.

## v0.35.1
- Bản đồ chọn cửa hiển thị kích thước thật, kéo cuộn dọc để xem các tầng trên; tự cuộn tới tầng đang chọn.

## v0.36.0
- Chọn cửa: thông tin quái + mô tả vật phẩm ẩn sau nút (i); bản đồ chiếm phần còn lại; vật phẩm gọn (icon + số lượng).
- Âm: thêm tick (tab/ải/ô đội hình/chip) và open (chọn cửa), âm bấm phủ thêm thẻ/hub/hộp thoại; tiếng kéo ngọc trầm và nhỏ hơn (rate ~-3 bán cung, gain 0.16 -> 0.12).

## v0.36.1
- Chọn cửa: nhấn giữ một cửa trên bản đồ xem chi tiết (mô tả, quái kèm hệ/nhịp đánh) rồi "Vào cửa này" hoặc đóng; thả tay không tự vào cửa.

## v0.37.0 — Gợi ý nhiều bước
- Gợi ý trong trận giờ là một đường kéo nhiều bước (tối đa 8) tạo nhiều combo nhất, dò bằng mô phỏng thật của lõi (beam search, ~30ms); hiện "tạo N combo", viên dẫn đường chạy hết đường; tự tính lại sau mỗi lượt khi gợi ý còn bật.
- Màn chọn cửa: dòng nhắc "Nhấn giữ một cửa để xem chi tiết".

## v0.37.1
- Ô đội hình trong trận: hiện icon tướng (viền theo hệ), icon hệ nhỏ ở góc ô; chưa có icon thì quay về viên ngọc hệ.

## v0.38.0 — Chọn quốc kỳ quê hương
- Mở đầu và màn Hồ sơ: thay ô gõ tên quê hương bằng lưới cờ tròn nhỏ (68 nước, bấm lại để bỏ chọn); lưu mã 2 chữ (VD VN) vào player.hometown, quê cũ dạng chữ vẫn giữ nguyên.
- Cờ: bộ circle-flags (MIT, github.com/HatScripts/circle-flags) trong www/assets/ui/flags; danh sách ở data/flags.json, tên nước qua i18n (flag.XX).

## v0.39.0
- Gợi ý đường kéo giờ kéo dài suốt cả chuyến đầu tiên (mọi trận), hiện lại nếu kéo hụt/không hợp lệ.
- Kéo chéo dễ hơn: ngón tay lệch >= 38% ô theo CẢ HAI trục so với tâm ô đang cầm thì tính là bước chéo (hằng DIAG_ASSIST trong ui/game.js); chỉ đổi cách nhận cử chỉ, luật chơi/lõi không đổi.

## v0.40.0 — 3 ván lưu
- Sau màn tải là màn chọn ván lưu: 3 ô, mỗi ô một tiến trình riêng (chơi, ván mới, đổi tên, xóa có xác nhận). Ô 1 dùng khóa cũ `rsp.save` nên save cũ thành ván 1; ô 2, 3 dùng `rsp.save.s2/.s3`; tên đặt riêng + lần chơi cuối ở `rsp.slots`.
- Cài đặt có nút "Đổi ván lưu". Chế độ `?debug` tự vào ván gần nhất (thêm `&slots` để xem màn chọn ván).
- Export/Import/Xóa dữ liệu trong Cài đặt áp dụng cho ván đang chơi.

## v0.40.1
- Gợi ý đường kéo: chỉ cho nước đi ĐẦU TIÊN của mỗi trận (mọi trận, mọi ải), không còn gợi ý các nước sau. Kéo hụt/không hợp lệ thì gợi ý hiện lại cho tới khi có nước đi hợp lệ đầu tiên.

## v0.40.2
- Slow-motion kết thúc trận chỉ bắt đầu từ đúng đòn làm quái CUỐI CÙNG chết; các đòn trước (kể cả giết quái khác trong cùng lượt) chạy tốc độ thường.

## v0.40.3
- Gợi ý nước đầu mỗi trận giới hạn tối đa 6 combo (`config.hint.maxCombos`, `maxSteps`), thực tế ra 4–6 combo; chọn đường nhiều combo nhất không vượt trần.

## v0.41.0 — Mở đầu mới
- Bỏ callsign và Tín Vật. Người chơi chỉ đặt tên, chọn ngoại hình, quốc kỳ (sửa lệch highlight).
- Cốt truyện: AIDA -> màn tutorial thật (đội mượn sẵn, 3 quái yếu, bong bóng chỉ dẫn từng nước, chơi lại nếu thua, `config.tutorial`).
- Quà tân thủ: 10 lượt triệu hồi miễn phí, chắc chắn 1×4★ + 9×3★, không 5★, không động pity (`starterSummon`, `config.summon.starter`). Muốn reroll tướng 4★: tạo slot lưu mới.
- Cutscene dùng chung một khuôn cho mọi tướng 4★ (thay chân dung/tên), rồi hiệu ứng vào màn chính. Hiệu ứng chỉ dùng transform/opacity cho mượt 60 fps.
- Save v12 (bỏ callsign/culture/firstDone, thêm `onboarding.starterDone`; save cũ coi như đã nhận).

## v0.41.1 — Tối ưu 60 fps
- Gợi ý nước đi tính theo lát ~4ms (`findHintAsync`), không còn khựng đầu trận (trước ~45ms/lần trên máy thường).
- Nhịp phát sáng (thẻ triệu hồi, ải, nút Thức tỉnh, ô đội hình) chuyển sang lớp `::after` chỉ đổi opacity; bỏ `backdrop-filter`; chữ viền trong canvas không dùng `shadowBlur`.
- Đo bằng `tests/e2e/perf60.cjs` (giảm tốc CPU 4x): p99 mỗi khung ~7ms, không còn long task trong lúc chơi.

## v0.42.0 — Dạo đầu, tutorial dễ hơn, HUD mới
- Cutscene dạo đầu (cổng Tháp mở, AIDA) trước màn tutorial.
- Gợi ý nước đầu mỗi ván ngắn và dễ: tối đa 3 ô, 3 combo (`config.hint`); tutorial 2 ô, 2 combo và gợi ý mọi nước (`config.tutorial.hint`). Quái tutorial yếu hơn.
- Nút bóng đèn trên đầu trận để người cũ tắt/bật gợi ý (lưu `settings.hint`). Nút tạm dừng vẽ lại, đặt góc phải.
- Tutorial dùng xác nhận kỹ năng như trận thật. Bong bóng hướng dẫn nhỏ, mờ, đặt sát dưới thanh đầu trận để không che quái.
- Thanh đầu trận mới: bảng "LƯỢT" số lớn và bảng "TẦNG" kèm chấm tiến độ.
- SFX Kenney CC0 bổ sung: tick, open, confirm, error, toggle, sting (xem docs/CREDITS.md).

## v0.43.0 — Thiết kế lại kỹ năng 24 tướng
- Mỗi tướng đúng 1 kỹ năng chủ động: sát thương, hồi máu, đổi ngọc sang hệ mình, buff/debuff, Ngọc Nâng Cấp, Dừng Thời Gian (nút "Tiêu").
- 12/24 tướng có kỹ năng đội trưởng (5★ 6/6, 4★ 4/8, 3★ 2/10): thêm thời gian kéo, hệ số combo, Cầu Vồng (cả đội khác hệ), sát thương/HP theo hệ hoặc cả đội, hồi máu.
- Bỏ bị động và Form 2 trong dữ liệu; Thức tỉnh chỉ tăng chỉ số. Bị động sẽ thêm sau.
- Chi tiết: docs/SKILLS_V2.md. Test e2e: tests/e2e/freeze.cjs.

## v0.43.1
- Màn tải: chạm hoặc nhấn phím bất kỳ để vào game và tự bật toàn màn hình (bỏ qua nếu đã cài app hoặc trình duyệt không hỗ trợ, như iOS Safari).

## v0.43.2
- Sửa màn nhập tên: nội dung vừa khít chiều ngang, không còn phải kéo sang phải (lưới avatar và ô tên co theo màn hình).

## v0.44.0 — Pháo hoa triệu hồi
- Triệu hồi x10: 10 viên pháo bay lên nổ đúng chỗ từng thẻ (màu theo độ hiếm) rồi thẻ hiện ra; x1: một viên pháo duy nhất. Chạm để bỏ qua hiệu ứng.
- Màn kết quả vừa một màn hình (lưới 5x2), nút Lật hết/Xong luôn thấy.
- Cutscene tướng 4★: dựng màn chính ngay dưới lớp cutscene rồi mới mờ đi, hết nháy.
- Nút gợi ý/tạm dừng trong trận cùng hàng với Lượt/Tầng (không cộng vùng an toàn).

## v0.45.0 — Tutorial có kịch bản
- 6 bài cố định (bàn, đội, quái, đường kéo nằm trong config.tutorial, mọi tài khoản giống nhau): kéo ngang, dọc, xa 3 ô, dùng kỹ năng, kéo chéo, combo nhiều cụm; sau đó tự do đến khi thắng.
- Phải kéo đúng đường chỉ định, sai thì trả bàn và nhắc kéo lại. Ô tiêu đề đổi thành "Bài n/6".
- Đội tutorial cố định: Kiện Lên Trời, Bennu, Fenrir, Heimdall, Eir. Test e2e: tests/e2e/tutorial.cjs.

## v0.46.0 — Quái phản diện thần thoại
- 27 quái đổi sang phản diện thần thoại/truyền thuyết (Kappa, Kraken, Leviathan, Typhon, Hydra, Sphinx, Cerberus, Cửu Vĩ Hồ...), art mới, tộc khớp lại. Chi tiết: docs/MONSTERS_V2.md.

## v0.46.1
- Tutorial: bàn bài 1 có sẵn từ khung hình đầu (hết giật do đổi bàn), các lần đổi bàn sau hiện dần. Ô tiêu đề chỉ ghi 1/6 đến 6/6, không chữ "Tầng".

## v0.46.2
- Tutorial: hết bài cứng thì chơi tự do, không gợi ý nữa. Khung chữ hướng dẫn nổi bật hơn: nền đậm, viền vàng phát sáng, tiêu đề to màu vàng + chỉ dẫn nhỏ, nảy lên mỗi khi đổi bài, mờ bớt sau 7 giây để thấy quái.

### v0.46.3
- Sửa giật tutorial: trước đây gợi ý tự động (đường kéo + chữ "tạo 2 combo") hiện trước rồi bị thay bằng bài 1 sau 400ms. Nay bài 1 áp dụng ngay khi vào trận, không còn gợi ý tự động.
- Màn loading đầu hiện số phiên bản + build ở cuối màn hình.

### v0.47.0
- Chữ hướng dẫn tutorial hiện giữa bàn ngọc, rồi mờ dần và trôi lên trên, ra khỏi bàn để người chơi xoay ngọc. Mỗi bài mới lặp lại như vậy; lời "Chơi tự do" mờ hẳn.

### v0.48.0
- Tutorial: dùng skill tướng cũng hỏi xác nhận như trận thường.
- Cửa hàng: chấm đỏ ở biểu tượng shop khi còn quà miễn phí chưa nhận hôm nay (`hasFreeOffer` trong core/shop.js, có test).
- Sửa nháy sau cutscene 4★ → màn chính: không gỡ class `hubin` bằng timer nữa (gỡ giữa chừng làm màn nháy 1 khung lộ bàn đấu bên dưới).

### v0.49.0
- Chuỗi chỉ tay tân thủ sau cutscene 4★ (`ui/guide.js`, bước lưu ở `progress.onboarding.guide`): Cửa hàng (chấm đỏ) → nhận quà → quay lại → Chiến đấu → khu đầu → ải 1 → Vào trận → bảng luật chọn đường → chạm cửa → xác nhận. Test: `tests/e2e/guide.cjs`.
- Chọn cửa trên bản đồ luôn có hộp xác nhận (chạm cửa mở chi tiết + nút "Vào cửa này"; chỉ khi còn đúng 1 cửa thì vào thẳng).
- Chấm đỏ ở nút Triệu hồi khi còn lượt miễn phí hôm nay.
- Tutorial bài 4: phải khóa mục tiêu vào quái ít máu nhất (mũi tên chỉ) rồi mới dùng skill.

### v0.50.0
- Xong tutorial: lời khích lệ + cutscene ngắn (`showTutorialDone`) rồi mới tới quà tân thủ.
- Triệu hồi do người chơi kích hoạt (`launchPad` trong screen-summon.js): kéo viên ngọc vào ống pháo (hoặc chạm ngọc) mới bắn pháo. Lúc chờ: khói lượn, ngọc "thở", ống pháo sáng, bàn tay chỉ kéo lặp. Test: `tests/e2e/summonfx.cjs`.
- Nút Triệu hồi ghi thêm giá quy đổi: x1 hoặc 100 Linh Thạch, x10 hoặc 900 Linh Thạch. Thiếu vé thì bấm sẽ hỏi trả bằng Linh Thạch (mua gói vé rồi triệu hồi).

### v0.50.1
- Chấm đỏ ở nút "Miễn phí hôm nay" trong màn Triệu hồi.

### v0.50.2
- Chữ hướng dẫn triệu hồi: "Đặt pháo vào ống pháo để bắn pháo!"; viên pháo có ngòi cháy.

### v0.50.3
- Thông báo ở màn chính hết bị lệch phải (width 100% + lề), và tự mờ rồi biến mất sau 4 giây.

### v0.51.0
- Lần đầu vào Đội hình: chỉ tay vào 1 tướng (nhấn giữ để xem chi tiết). Mở chi tiết lần đầu thì dẫn từng mục (tên/hệ/tộc, chỉ số, cấp, chủ động, đội trưởng, bị động, Duo, từ khóa, nâng cấp, nâng kỹ năng, thức tỉnh) bằng vòng sáng + chú thích, có nút Tiếp/Bỏ qua. Lưu ở `progress.onboarding.teamTour`. Test: `tests/e2e/herotour.cjs`.

### v0.51.1
- Thêm `docs/AUDIT_PROMPT.md` (prompt kiểm định tái dùng) và `docs/AUDIT_2026-11-12.md` (kết quả lần chạy đầu).
- `tools/balance-sim.js`: bot biết bấm Tiêu khi Dừng Thời Gian (trước đó kẹt, mỗi chuyến ~120 phút).

### v0.52.0
- **Nhiệm vụ hằng ngày** (`core/quests.js`, dữ liệu `config.quests`): 5 nhiệm vụ mỗi ngày (Vào game cố định + 4 trong 6 loại: thắng 5 trận, thắng 1 ải, triệu hồi, nhận quà shop, cho tướng lên cấp, nâng kỹ năng), nhận Linh Thạch, xong hết thì thêm 1 Vé + 20 Linh Thạch. Chấm đỏ ở nút Nhiệm vụ. Trường `progress.quests` tùy chọn nên không đổi version save. Tab Thành tựu vẫn "sắp có". Test: `tests/quests.test.js`, `tests/e2e/quests.cjs`.
- **Cân bằng đồng bộ với 7 ải:** `balance-sim.js --curve`, `run.stageScale.values` theo ải (ải Boss nhẹ hơn ải 6), chỉnh lại `zoneScale`. Chi tiết và chỗ còn lệch ở `docs/BALANCE_LOG.md`.

### v0.53.0
- **Thành tựu** nằm trong màn Nhiệm vụ (tab "Thành tựu"): 9 thành tựu, mỗi cái nhiều bậc, nhận Linh Thạch (bậc cuối có Vé Triệu Hồi). Đo từ tiến trình sẵn có: ải thắng, trận thắng (bộ đếm mới `stats.battles`), khu chinh phục Dễ/Khó, lần triệu hồi, số tướng, tướng 5★, cấp cao nhất, tướng Thức tỉnh.
- Logic thuần ở `core/achievements.js`; số liệu ở `config.achievements`; trạng thái `progress.achv` (tùy chọn, không đổi SAVE_VERSION).
- Chấm đỏ ở tab và nút Nhiệm vụ khi có thưởng chưa nhận.

### v0.54.0
- **Quái mới:** Slime (tộc Linh, trâu, đánh chậm) và Gnome (tộc Nhân, đánh nhanh) cho cả 6 hệ, 12 quái `slime_*`/`gnome_*`. Mỗi con áp một hiệu ứng nhẹ khi đánh (`onAttack`, chỉ dùng 12 từ khóa cũ). Quái thường của 6 khu giờ là slime/gnome cùng hệ; quái cũ `*_n1/_n2` vẫn nằm trong kho.
- Tutorial dùng `tut_slime_fire`, `tut_slime_water`, `tut_gnome_dark` (chỉ số y hệt quái cũ, không hiệu ứng) nên bài học không đổi.
- Schema cho phép quái hệ Tim (element 5). Chưa có art slime/gnome: hiện là hình khối màu.
- Cân bằng (sim `--curve`): Dễ 15/18, Vừa 13/18, Hard 10/18 ô trong dải (trước: 16/12/10). Quái Tim giảm 10% chỉ số.

### v0.55.0
- **Cầu nguyện (ước):** nút ở góc trên màn chính (chấm đỏ khi còn lượt). Mỗi ngày 1 lượt quay vòng xoay 12 ô, kết quả tính ở `core/wish.js` theo seed, tỉ lệ ở `config.wish.slices` (có bảng tỉ lệ trong màn).
- Phần thưởng và tỉ lệ: Vàng 600 (21%) / 2500 (14%); Linh Thạch 15 (17%) / 40 (10%); Mảnh Chung 3★×2 (10%) / 4★ (5%) / 5★ (1.5%); Mảnh tướng 3★ (7%) / 4★ (4%) / 5★ (1.5%) (tướng ngẫu nhiên, ưu tiên tướng chưa có); Vé Triệu Linh (5%); Vé Triệu Hồi (4%). Kỳ vọng nhỏ, không lấn thưởng nhiệm vụ.
- Trạng thái `progress.wish = { day, slice }` (tùy chọn, không đổi SAVE_VERSION). Test `tests/wish.test.js`, e2e `tests/e2e/wish.cjs`.

### v0.55.1
- Art thật cho Slime và Gnome (12 quái, sinh bằng ChatGPT cùng phong cách viền mực đậm + tô phẳng, nhập bằng `tools/art-import-mon.py`) và 3 quái tutorial (`tut_*` dùng lại art slime Hỏa, slime Thủy, gnome Ám). Manifest 117 mục.

### v0.55.2
- Nút triệu hồi gọn lại: tiêu đề "Triệu hồi ×1/×10" và giá bằng hai biểu tượng (vé / Linh Thạch), bỏ chữ "hoặc ... Linh Thạch". Chấm đỏ của "Miễn phí hôm nay" nằm trong nút nên không bị cắt góc che mất.

# Prompt kiểm định dự án (dùng lại được)

Dán nguyên khối dưới đây cho một AI có quyền đọc repo và chạy lệnh. Lần chạy gần nhất: xem `docs/AUDIT_2026-11-12.md`.

---

Bạn là producer kiêm game designer kiêm kỹ sư senior, đang kiểm định độc lập một game mobile do một dev solo làm. Hãy hoài nghi có căn cứ: mọi nhận định phải có bằng chứng (đường dẫn file:dòng, số đo, kết quả lệnh). Không khen chung chung, không bịa.

## Bối cảnh
Game: "Thiên Tháp Dị Điểm" (EN: Rift Spire: Pantheon), puzzle RPG kéo ngọc leo tháp, web thuần (Canvas + JS ES modules), sau này đóng gói Capacitor lên CH Play. Repo: thư mục hiện tại. Đọc trước: `CLAUDE.md` (quy tắc cứng), `docs/GDD.md` (nguồn sự thật thiết kế), `README.md` (nhật ký phiên bản), `docs/BALANCE_LOG.md`, `docs/ART_PLAN.md`, `package.json`.
Mục tiêu của chủ dự án: một game gọn, đẹp, chơi từng ván ngắn, có vòng lặp sưu tầm nhân vật thần thoại; v1 offline; không PvP, không gacha tiền thật ở v1.

## Việc cần làm
1. **Kiểm kê (đã làm được gì).** So từng mục trong GDD (mốc M1–M6, roster, hệ thống, UI, art, âm thanh, kỹ thuật, pháp lý) với code và dữ liệu thật. Mỗi mục gán một trạng thái: XONG / DỞ / CHƯA / LỆCH GDD. Đếm số liệu thật (nhân vật, quái, khu, ải, di vật, sự kiện, asset, dòng code, số test).
2. **Chạy kiểm chứng.** `npm test`; `node tools/balance-sim.js` (đọc cách dùng trong file); chạy thử luồng người chơi mới bằng Playwright nếu có (`tests/e2e/`, máy chủ `node tools/serve.js 8080`). Không tin README hay BALANCE_LOG nếu số đo không khớp: nêu rõ chỗ lệch.
3. **Làm tốt (điểm mạnh thật).** Chỉ nêu cái có bằng chứng, nói vì sao nó tốt cho người chơi hoặc cho dev solo.
4. **Chưa tốt.** Chia nhóm: (a) lỗi/rủi ro làm hỏng trải nghiệm, (b) nợ kỹ thuật (kiến trúc, test thiếu, tệp quá lớn, tài liệu lỗi thời), (c) cân bằng và độ khó, (d) onboarding và UX, (e) nội dung/art/âm thanh, (f) pháp lý, store, kiếm tiền. Mỗi mục: mô tả, bằng chứng, mức nghiêm trọng (Cao/Vừa/Thấp).
5. **Kiểm tra tuân thủ `CLAUDE.md`.** Quét: core có dùng `Math.random`/`Date.now`/DOM không; chuỗi viết cứng ngoài i18n; hai file i18n có cùng bộ key không; từ khóa hiệu ứng có đúng 12; có trang bị/rune không; có tên/art của game khác không; có bí mật trong repo không.
6. **Hướng phát triển tối ưu tiếp theo.** Xếp 8–12 việc theo thứ tự nên làm, mỗi việc có: lý do, tác động (người chơi/doanh thu/rủi ro), công sức ước lượng (S/M/L), phụ thuộc, và "xong khi nào". Tách rõ: chặn phát hành CH Play / tăng giữ chân / mở rộng nội dung / giảm nợ. Tôn trọng nguyên tắc GDD: giữ game gọn, không bắt đầu M7 trước khi M6 lên CH Play. Nêu 3 việc KHÔNG nên làm lúc này và vì sao.
7. **Câu hỏi cần chủ dự án quyết.** Liệt kê các quyết định thiết kế mà bạn không thể tự chốt.

## Quy tắc
- Chỉ đọc và chạy lệnh đo; không sửa code game. Nếu phải sửa công cụ đo để có số đúng, nói rõ đã sửa gì.
- Ngôn ngữ: tiếng Việt, ngắn gọn, mật độ thông tin cao, có bảng khi so sánh. Bắt đầu bằng TL;DR 5 dòng và một điểm số tổng (0–10) kèm lý do.
- Phân biệt rõ: sự thật đo được / suy luận / ý kiến.

## Đầu ra
Một tệp `docs/AUDIT_<ngày>.md` theo cấu trúc: TL;DR → Kiểm kê → Kiểm chứng → Điểm mạnh → Điểm yếu → Tuân thủ quy tắc → Lộ trình ưu tiên → Câu hỏi cho chủ dự án.

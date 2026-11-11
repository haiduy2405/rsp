# CREDITS

## Âm thanh
Toàn bộ nhạc nền và SFX hiện là **âm thanh tổng hợp bằng code** (WebAudio, `www/js/ui/audio.js` + `www/js/data/audio.json`), do dự án tự làm, không dùng file ngoài. Khi thêm file thật, ghi vào bảng:

| File | Nguồn (URL) | Tác giả | Giấy phép | Ngày lấy |
|---|---|---|---|---|

## Art
Chưa có art thật (hình khối màu). Khi thêm: lưu prompt + file gốc, ghi công cụ AI và phần chỉnh tay (xem `docs/ART_PROMPTS.md`).

## Art hiện tại (tạm)
57 asset trong `www/assets/` do `tools/gen-art.py` sinh bằng code (vector SVG → WebP), thiết kế gốc của dự án, không dùng ảnh hay phong cách của bên thứ ba. SVG gốc ở `art-src/`. Chạy lại: `python3 tools/gen-art.py && node tools/check-assets.js --write`. Đây là art tạm kiểu minh họa phẳng, không phải art anime AI như `docs/ART_PROMPTS.md`. Muốn thay: ghi đè file WebP cùng tên rồi chạy `node tools/check-assets.js --write`.

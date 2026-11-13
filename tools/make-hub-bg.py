# Dựng assets/bg/hub.webp (1080x1920) từ cảnh SVG ui/hub-art.js: dùng làm nền các màn phụ và màn tải.
# Cần: máy chủ `npm run serve` đang chạy ở cổng 8080, playwright + Chrome. Chạy: python3 tools/make-hub-bg.py
import io
from playwright.sync_api import sync_playwright
from PIL import Image
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 540, 'height': 960}, device_scale_factor=2)
    pg.goto('http://localhost:8080/index.html?debug')
    pg.wait_for_timeout(800)
    pg.evaluate("""async () => {
      const { hubSky } = await import('/js/ui/hub-art.js');
      document.body.innerHTML = '<div style="position:fixed;inset:0;background:#7ac8f8"><svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block" xmlns="http://www.w3.org/2000/svg">' + hubSky() + '</svg></div>';
    }""")
    pg.wait_for_timeout(400)
    png = pg.screenshot()
    b.close()
Image.open(io.BytesIO(png)).convert('RGB').save('www/assets/bg/hub.webp', 'WEBP', quality=82, method=6)
print('ok')

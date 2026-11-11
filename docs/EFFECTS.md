# Hiệu ứng (12 từ khóa, khóa cứng) — BẢN NHÁP CHỜ DUYỆT

Trạng thái: **chưa code**. Duy duyệt xong mới triển khai M3.

## 1. Khái niệm chung
- **Chủ thể (holder)**: *Đội* (một chủ thể duy nhất, máu chung) và từng *Quái*. Hiệu ứng nằm trên chủ thể, dạng `{key, turns, value}`.
- **Một lượt** = một nước kéo (hoặc dùng kỹ năng rồi kéo) + pha quái + cuối lượt.
- **Thời lượng** `turns = N`: hiệu ứng áp trong pha người chơi tính luôn lượt hiện tại (còn sống đến hết lượt thứ N). Hiệu ứng do quái áp trong pha quái bắt đầu tính từ lượt sau.
- **Chồng**: mỗi chủ thể chỉ có **một** bản của mỗi từ khóa. Áp lại = làm mới thời lượng (lấy số lớn hơn) và lấy `value` lớn hơn. Ngoại lệ duy nhất: **Độc** cộng dồn tầng.
- **Tiêu cực** (bị Miễn nhiễm chặn): Bỏng, Độc, Choáng, Đóng băng, Giảm công, Khóa ngọc. **Tích cực**: Khiên, Hồi máu, Tăng công, Phản đòn, Xuyên giáp, Miễn nhiễm.
- Tất cả `value` là tỉ lệ (0.2 = 20%) của **máu tối đa** chủ thể (hoặc của công, tùy từ khóa), nằm trong JSON kỹ năng.

## 2. Định nghĩa từng từ khóa
| Từ khóa | Tác dụng | Chồng / làm mới | Ghi chú |
|---|---|---|---|
| **Bỏng** | Cuối lượt mất `value` × máu tối đa | Làm mới, không cộng dồn | Không bị Khiên chặn. Dùng giá trị lớn, thời lượng ngắn (2–3) |
| **Độc** | Cuối lượt mất `value` × máu tối đa × số tầng | Cộng dồn tối đa 5 tầng, mỗi lần áp +1 tầng và làm mới thời lượng | Không bị Khiên chặn. Giá trị nhỏ, thời lượng dài (4–5) |
| **Choáng** | Quái: không hành động, bộ đếm tấn công đứng yên. Đội: nút kỹ năng bị khóa | Làm mới | Sau khi hết, chủ thể được 1 lượt **hồi phục** miễn Choáng/Đóng băng (chống khóa cứng vĩnh viễn) |
| **Đóng băng** | Như Choáng, thời lượng dài hơn (2–3). Tan ngay khi nhận sát thương **hệ Hỏa**, lần đó nhận +25% sát thương | Làm mới | Chung bộ đếm hồi phục với Choáng. Quái vừa Choáng vừa Đóng băng vẫn chỉ mất hành động một lần |
| **Khiên** | Chủ thể có bể chắn `value` × máu tối đa; sát thương trực tiếp trừ vào bể trước | Cộng `value`, trần 50% máu tối đa; thời lượng làm mới | Không chặn Bỏng/Độc. Bùa Khiên = Khiên 25% máu tối đa đội, kéo dài đến hết trận |
| **Hồi máu** | Cuối lượt hồi `value` × máu tối đa | Làm mới, không cộng dồn | Chạy sau Bỏng/Độc. Bình Hồi Phục là hồi tức thì |
| **Tăng công** | Công của chủ thể × (1 + value) | Làm mới, lấy value lớn hơn | Đội: cả 5 nhân vật. Tính **nhân** với Giảm công; sàn công = ×0.25 |
| **Giảm công** | Công của chủ thể × (1 − value) | Như trên | Tiêu cực, Miễn nhiễm chặn |
| **Phản đòn** | Khi chủ thể nhận sát thương trực tiếp (sau Khiên), phản `value` × sát thương đó cho kẻ tấn công | Làm mới | Phản đòn không kích Phản đòn khác; sát thương phản không tính combo; trần 10% máu tối đa mục tiêu mỗi lượt |
| **Xuyên giáp** | Sát thương trực tiếp của chủ thể bỏ qua **Khiên** của mục tiêu | Làm mới | Không bỏ qua Miễn nhiễm |
| **Khóa ngọc** | Chỉ do quái áp lên Đội: khóa `value` ô ngẫu nhiên (RNG seed). Ô khóa không thể bắt đầu hoặc nằm trên đường kéo, vẫn tiêu được trong combo, tiêu xong thì mở | Làm mới thời lượng; ô khóa đã chọn giữ nguyên | Tối đa 8 ô |
| **Miễn nhiễm** | Chặn mọi hiệu ứng **tiêu cực** mới lên chủ thể trong N lượt | Làm mới | Không xóa hiệu ứng tiêu cực đã có |

## 3. Thứ tự xử lý một lượt
1. **Pha người chơi**: dùng kỹ năng (nếu có, không tốn lượt) → kéo ngọc → tiêu/cascade. Sát thương dùng công đã tính Tăng/Giảm công tại thời điểm đó.
2. **Pha quái** (theo thứ tự trái sang phải, quái còn sống): bị Choáng/Đóng băng thì bỏ qua; ngược lại giảm bộ đếm, về 0 thì tấn công (sát thương → Phản đòn → Khiên → máu) và áp hiệu ứng trong kỹ năng quái.
3. **Cuối lượt**: (a) Bỏng, Độc lên quái, kiểm tra thắng; (b) Bỏng, Độc lên Đội, kiểm tra thua; (c) Hồi máu quái, rồi Đội; (d) giảm thời lượng mọi hiệu ứng, xóa cái hết hạn, cập nhật bộ đếm hồi phục.
- Nếu quái và Đội cùng về 0 trong một bước, **người chơi thắng**.
- Bỏng/Độc/Phản đòn không thể đưa máu Đội xuống dưới 0 gây lỗi; máu kẹp ở 0.

## 4. Quyết định kèm theo cần duyệt
1. **Khiên đổi từ "chặn N đòn" (M2) sang "bể chắn theo % máu"**, để dùng chung cho cả quái và Đội. Bùa Khiên và HUD sẽ đổi theo.
2. **Leader skill = nhân vật ở ô 1**, 4 khuôn mẫu cố định: `atk_element` (+X% công hệ Y), `hp_element` (+X% máu hệ Y), `heal_boost` (+X% hồi), `start_cd` (mọi kỹ năng bắt đầu trận với hồi chiêu −N).
3. **Duo** = hai nhân vật đứng **liền ô** (không phân biệt thứ tự), kỹ năng ghép dùng chung 1 hồi chiêu riêng cho cặp.
4. **Ngân sách chỉ số** = HP×0.1 + ATK + Heal tại Level tối đa + Thức tỉnh 5. Đề xuất trần: 3★ 330, 4★ 420, 5★ 520.

# Thiết kế lại kỹ năng 24 tướng (bản đề xuất, chờ Duy duyệt)

## Nguyên tắc
- Mỗi tướng **đúng 1 kỹ năng chủ động**, đúng 1 dạng, 1 hiệu ứng (đọc một dòng là hiểu).
- **Đội trưởng**: chỉ một số tướng có (12/24). Sao càng cao, chỉ số càng mạnh.
- **Bị động**: bỏ tạm, làm sau. Dữ liệu để `null`.
- Giữ 12 từ khóa hiệu ứng. Hai cơ chế mới (Ngọc Nâng Cấp, Dừng Thời Gian) là **đơn vị kỹ năng**, không phải từ khóa.

## Dạng kỹ năng chủ động (7 dạng)
| Dạng | Mô tả | Cơ chế |
|---|---|---|
| convert | Chuyển N ngọc bất kỳ sang màu của tướng | có sẵn |
| buff | Cường hóa cả đội (Khiên, Tăng công, Xuyên giáp, Miễn nhiễm...) | có sẵn |
| debuff | Làm yếu địch (Giảm công, Choáng, Đóng băng...) | có sẵn |
| damage | Sát thương chuẩn: mult × ATK của tướng, một hoặc toàn bộ địch | có sẵn |
| heal | Hồi % máu tối đa | có sẵn |
| enhance | Nâng N ngọc màu của tướng thành Ngọc Nâng Cấp | **mới** |
| timeFreeze | Trong N lượt: đồng hồ kéo ngọc dừng, thả tay ngọc không tiêu, chỉ tiêu khi bấm nút Tiêu | **mới** |

## Kỹ năng đội trưởng (7 mẫu, giá trị theo sao)
| Mẫu | 3★ | 4★ | 5★ | Cơ chế |
|---|---|---|---|---|
| drag_time (+giây kéo ngọc) | +1.0s | +1.5s | +2.5s | có sẵn (dragBonusMs) |
| combo_mult (+hệ số nhân mỗi combo) | | +0.10 | +0.20 | **mới** |
| rainbow (cả đội 5 hệ khác nhau: ATK toàn đội) | | ×1.3 | ×1.6 | **mới** |
| atk_element (+ATK tướng cùng hệ) | +15% | +20% | +25% | có sẵn |
| atk_all (+ATK cả đội) | | +12% | +18% | **mới** |
| heal_boost (+hồi máu) | +20% | +25% | +30% | có sẵn |
| hp_all / hp_element (+HP) | 15% hệ | 20% hệ | 18% cả đội | hp_element có sẵn, hp_all mới |

Bỏ mẫu `start_cd` (giảm hồi chiêu đầu trận) vì không nằm trong danh sách mới.

## Bảng 24 tướng
| Tướng | ★ | Hệ | Chủ động | CD | Đội trưởng |
|---|---|---|---|---|---|
| thuy_tinh | 5 | Thủy | debuff: Giảm công toàn địch 40%, 3 lượt | 7 | atk_element Thủy +25% |
| ran | 4 | Thủy | convert: 7 ngọc sang Thủy | 6 | không |
| thetis | 3 | Thủy | buff: Khiên đội 20%, 3 lượt | 5 | hp_element Thủy +15% |
| coc_kien_troi | 3 | Thủy | damage: 1 địch ×4.0 | 5 | không |
| thanh_giong | 5 | Hỏa | buff: Tăng công đội 40%, 3 lượt | 7 | atk_all +18% |
| hephaestus | 4 | Hỏa | enhance: 6 ngọc Hỏa nâng cấp | 6 | không |
| surtr | 4 | Hỏa | damage: toàn địch ×2.5 | 6 | atk_element Hỏa +20% |
| bennu | 3 | Hỏa | heal: 30% máu tối đa | 5 | không |
| son_tinh | 5 | Mộc | timeFreeze: 1 lượt | 7 | hp_all +18% |
| mai_an_tiem | 4 | Mộc | convert: 7 ngọc sang Mộc | 6 | không |
| artemis | 4 | Mộc | damage: 1 địch ×5.0 | 6 | combo_mult +0.10 |
| atalanta | 3 | Mộc | enhance: 4 ngọc Mộc nâng cấp | 5 | không |
| apollo | 5 | Quang | timeFreeze: 2 lượt | 9 | rainbow ×1.6 |
| ra | 4 | Quang | buff: Xuyên giáp đội, 3 lượt | 6 | drag_time +1.5s |
| eos | 3 | Quang | convert: 6 ngọc sang Quang | 5 | drag_time +1.0s |
| heimdall | 3 | Quang | buff: Miễn nhiễm đội, 2 lượt | 6 | không |
| hel | 5 | Ám | damage: toàn địch ×3.5 | 8 | combo_mult +0.20 |
| loki | 4 | Ám | debuff: Đóng băng 1 địch, 2 lượt | 6 | không |
| nyx | 3 | Ám | debuff: Choáng toàn địch, 1 lượt | 6 | không |
| fenrir | 3 | Ám | damage: 1 địch ×4.0 | 5 | không |
| co_tam | 5 | Tim | heal: 50% máu tối đa | 8 | heal_boost +30% |
| freyja | 4 | Tim | enhance: 6 ngọc Tim nâng cấp | 6 | heal_boost +25% |
| eir | 3 | Tim | heal: 30% máu tối đa | 5 | không |
| orpheus | 3 | Tim | heal: 25% máu tối đa | 5 | không |

Phân bố: convert 3, buff 4, debuff 3, damage 5, heal 4, enhance 3, timeFreeze 2. Đội trưởng: 5★ 6/6, 4★ 4/8, 3★ 2/10.

## Các điểm chưa chốt (mặc định đề xuất)
1. **Ngọc Nâng Cấp**: tiêu trong một cụm thì cụm đó +50% sát thương/hồi (Tim nâng cấp hồi +50%). Giữ nguyên tới khi tiêu.
2. **Dừng Thời Gian**: kéo không giới hạn giờ; thả tay ngọc ở yên; nút **Tiêu** để tính cụm. Có thể kéo nhiều lần trước khi bấm Tiêu. Hết N lượt trở về bình thường.
3. **combo_mult**: mỗi combo cộng thêm vào hệ số nhân (ví dụ +0.10 mỗi combo, 6 combo thành +0.60).
4. **Thức tỉnh** (khi chỉ còn 1 chủ động): chủ động mạnh thêm 25% và hồi chiêu −1; đội trưởng (nếu có) mạnh thêm 20%.
5. Hiệu ứng kỹ năng nằm trong `characters.json`; chữ mô tả sinh từ i18n, hai ngôn ngữ cùng bộ key.

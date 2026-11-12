# Đổi quái sang phản diện nổi tiếng (đã duyệt, triển khai v0.46.0)

## Nguyên tắc
- Chỉ dùng tên và hình tượng từ thần thoại, truyền thuyết, văn học dân gian đã thuộc phạm vi công cộng; thiết kế, mô tả, art là của riêng game. Không dùng nhân vật, tên riêng, ngoại hình của phim, game, truyện có bản quyền.
- Độ nổi tiếng quyết định hạng: nổi nhất = Boss, kế = Elite, còn lại = Creep. Mỗi khu giữ cơ cấu hiện tại: 2 Creep + 1 Elite + 1 Boss (6 khu = 24), cộng 3 quái màn hướng dẫn = 27.
- Tránh trùng tướng đã có (Hel, Loki, Fenrir, Nyx, Surtr, Medusa/Dracula/Thor/Hades... vốn dành cho tướng Biểu tượng toàn cầu theo GDD).
- Chỉ số, kỹ năng đòn (Bỏng, Độc, Khóa ngọc...) và 12 từ khóa giữ nguyên. Id quái giữ nguyên để không vỡ save và bản ghi; chỉ đổi tên hiển thị.

## Bảng đề xuất
| Khu | Id hiện tại | Hạng | Phản diện | Nguồn gốc | Ghi chú đòn (giữ nguyên) |
|---|---|---|---|---|---|
| Thủy | water_n1 | Creep | Kappa | Nhật Bản, dân gian | |
| Thủy | water_n2 | Creep | Thuồng Luồng | Việt Nam, dân gian | |
| Thủy | water_e1 | Elite | Kraken | Bắc Âu, truyền thuyết biển | Giảm công |
| Thủy | water_b1 | Boss | Leviathan | Cổ văn Do Thái | Giảm công + Đóng băng |
| Hỏa | fire_n1 | Creep | Salamander | Giả kim, truyền thuyết châu Âu | |
| Hỏa | fire_n2 | Creep | Ifrit | Ả Rập, dân gian | |
| Hỏa | fire_e1 | Elite | Chimera | Hy Lạp | Bỏng |
| Hỏa | fire_b1 | Boss | Typhon | Hy Lạp, cha của quái vật | Bỏng + Khóa ngọc |
| Mộc | wood_n1 | Creep | Leshy | Slav, linh rừng | |
| Mộc | wood_n2 | Creep | Mandrake | Truyền thuyết châu Âu, cây kêu thét | |
| Mộc | wood_e1 | Elite | Nidhogg | Bắc Âu, rắn gặm rễ cây thế giới | Độc |
| Mộc | wood_b1 | Boss | Hydra | Hy Lạp, rắn nhiều đầu | Độc + Khóa ngọc |
| Quang | light_n1 | Creep | Ma Trơi | Việt Nam, dân gian | |
| Quang | light_n2 | Creep | Griffin | Cổ đại, giữ vàng | |
| Quang | light_e1 | Elite | Golem | Do Thái, dân gian | Choáng |
| Quang | light_b1 | Boss | Sphinx | Ai Cập/Hy Lạp, quái đố | Đóng băng + Giảm công |
| Ám | dark_n1 | Creep | Ghoul | Ả Rập, dân gian | |
| Ám | dark_n2 | Creep | Banshee | Ireland, dân gian | |
| Ám | dark_e1 | Elite | Baba Yaga | Slav, dân gian | Khóa ngọc |
| Ám | dark_b1 | Boss | Cerberus | Hy Lạp, chó ba đầu | Khóa ngọc + Choáng |
| Tim | heart_n1 | Creep | Siren | Hy Lạp, giọng hát dụ dỗ | |
| Tim | heart_n2 | Creep | Pixie | Cornwall, dân gian | |
| Tim | heart_e1 | Elite | Lamia | Hy Lạp | Độc |
| Tim | heart_b1 | Boss | Cửu Vĩ Hồ | Đông Á, hồ ly chín đuôi | Khóa ngọc + Giảm công |
| Hướng dẫn | m_ember | Creep | Imp | Dân gian châu Âu | |
| Hướng dẫn | m_tide | Creep | Nixie | Đức, linh nước | |
| Hướng dẫn | m_shade | Creep | Goblin | Dân gian châu Âu | |

## Cần Duy quyết
1. Duyệt hoặc đổi tên trong bảng (đặc biệt Boss: Leviathan, Typhon, Hydra, Sphinx, Cerberus, Cửu Vĩ Hồ).
2. Art: ảnh hiện tại (sứa, cua, rắn tro...) không khớp tên mới. Phương án: đổi tên ngay, giữ ảnh cũ tạm; hoặc Duy cấp ảnh mới rồi mới đổi. Tên tệp ảnh giữ theo id nên thay ảnh là chép đè.
3. Tộc (race) của quái quyết định Lễ Vật rớt. Mặc định giữ nguyên tộc hiện tại; nếu muốn khớp hơn (ví dụ Ifrit = Linh, Typhon = Thần) thì nói mình chỉnh.

## Đã làm (v0.46.0)
- Duyệt nguyên bảng. Đã đổi tên VI/EN, art mới cho cả 27 quái (sinh bằng ChatGPT, nhập bằng `tools/art-import-mon.py`), id giữ nguyên.
- Lamia, Siren, Pixie vẽ lại bản kín đáo cho phù hợp mọi lứa tuổi.
- Tộc chỉnh cho khớp: Thuồng Luồng/Nidhogg/Hydra = Long; Kappa/Kraken/Salamander/Chimera/Griffin/Cerberus = Thú; Ifrit/Leshy/Mandrake/Ma Trơi/Golem/Ghoul/Banshee/Siren/Pixie/Cửu Vĩ Hồ/Imp/Nixie = Linh; Baba Yaga/Lamia/Goblin = Nhân; Leviathan = Long; Typhon/Sphinx = Thần.

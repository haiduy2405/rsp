# Schema dữ liệu JSON

Validator tự viết: `www/js/core/schema.js` (kiểm tra bằng `tests/project.test.js`). Mục có dấu (kế hoạch) chưa có validator, sẽ thêm ở mốc tương ứng.

Loại ngọc / hệ: `0` Thủy, `1` Hỏa, `2` Mộc, `3` Quang, `4` Ám, `5` Tim.

## config.json
| Khóa | Ý nghĩa |
|---|---|
| `board.allowDiagonal` | cho phép kéo chéo (mặc định false) |
| `dragTimeMs` | thời gian kéo, ms |
| `elements` | tên hệ theo chỉ số |
| `advantage` | `{ "hệ tấn công": [hệ bị khắc] }` |
| `elementMult` | `strong` (khắc), `weak` (bị khắc) |
| `combo.step` | cộng thêm mỗi combo |
| `group` | `sizeBonus`, `fourOrbBoost`, `enhancedBonus` |
| `heal.base` | nhân hồi máu của ngọc Tim |

## characters.json (mảng)
`{ id, element, rarity (3-5), hp, atk, heal, skill? }`
`skill = { cooldown, startCooldown?, units: [...] }`

Đơn vị kỹ năng (`units`):
- `{ "type": "damage", "target": "all" | "one", "mult", "element"? }` sát thương = ATK × mult × khắc hệ
- `{ "type": "heal", "pctMax" }` hồi % máu tối đa của đội
- `{ "type": "convert", "to", "count" }` đổi `count` ngọc ngẫu nhiên (từ rng) thành loại `to`
- `{ "type": "applyEffect", "target", "key", "turns", "value" }` gắn hiệu ứng lên quái (khung có sẵn; 12 từ khóa sẽ được cài ở M3)

## monsters.json (mảng)
`{ id, element (0-4), hp, atk, attackEvery }`

## Trạng thái trận (không phải file)
`createBattle` trả `{ version, turn, status, rng, board:{cells,enh}, members, hp, maxHp, enemies }`. `step(ctx, state, action)` trả `{ state, events }`, không sửa state vào.
Hành động: `{type:'move', path:[ô...]}` hoặc `{type:'skill', index}`. Bản ghi replay: `{ seed, team, enemies, actions }`.

## (kế hoạch) zones, loot, banners, events, items
- `zones.json`: `{ id, element, ải: [...], loạiẢiCuối, bảngQuái }` (M2)
- `loot.json`: bảng rớt theo khu, trọng số, bảo hiểm xui (M2)
- `events.json`: sự kiện bí ẩn, lựa chọn A/B, kết quả (M2)
- `items.json`: vật phẩm trong chuyến, vật phẩm thời trang (M2/M6)
- `banners.json`: tỉ lệ, pity, danh sách nhân vật (M4)

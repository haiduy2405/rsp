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

## M2
- `zones.json`: `{id, order, element, final:'elite'|'boss', monsters:{normal[],elite[],boss[]}}`.
- `events.json`: `{id, choices:[{outcomes:[{weight, effects:[{type:gold|essence|item|stone|hpPct|none,...}]}]}]}`, chuỗi i18n `ev.<id>.title/body/c<i>/o<i>_<j>`.
- Run: `{seed, zoneId, team, floors, floor, phase, doors, hp, loot, items, armed, battle, ...}`; record `{seed, zoneId, team, pityMissed, actions}`.
- Progress v2 + save envelope `{v, sum, data}`; khóa `rsp.save`, `rsp.save.bak`.

## M3
- `characters.json`: `{id, element, rarity, role, hp, atk, heal, skill:{cooldown, startCooldown, units[]}, leader:{template, ...}}`. Đơn vị kỹ năng: `damage{target,mult,element?}`, `heal{pctMax}`, `convert{to,count}`, `applyEffect{target:one|all|team,key,turns,value}`. `key` thuộc 12 từ khóa nội bộ: burn, poison, stun, freeze, shield, regen, atkUp, atkDown, reflect, pierce, lock, immune.
- Leader: `atk_element{element,pct}`, `hp_element{element,pct}`, `heal_boost{pct}`, `start_cd{n}`.
- `duos.json`: `{id, a, b, reason, source?, skill}`.
- `monsters.json`: thêm `onAttack: [{key,turns,value}]` (quái áp hiệu ứng lên đội khi đánh).
- `config.json`: `progression` (levelMax, levelGrowth, awaken[]), `budget` + `budgetWeights`, `upgrade` (level, awaken, duplicateShards), `run.zoneScale`.
- Progress v3: thêm `characters: {id: {level, awaken}}`; đội là 5 id khác nhau đã sở hữu.

## M4 (save v4)
progress += `player{name,callsign,hometown,avatar}`, `onboarding{done,tutorialDone}`, `summon{pity5,pity4,pulls,firstDone,freeDay,history[]}`, `settings{volume}`.
`banners.json`: {id,culture,rateUp}. `story.json`: {id,after(zoneId|null)}.

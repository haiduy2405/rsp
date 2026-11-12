import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, encode, decode, KEY, BAK_KEY } from '../www/js/save/storage.js';
import { migrate } from '../www/js/save/migrate.js';
import { newProgress, isValidProgress, SAVE_VERSION } from '../www/js/core/progress.js';
import { loadCtx } from './helpers.js';

const ctx = loadCtx();
const memAdapter = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
};
const sample = () => {
  const p = newProgress(ctx);
  p.inventory.gold = 1234;
  p.inventory.stones[0].normal = 7;
  p.inventory.stones[0].rare = 2;
  p.unlocked.push('zone_fire');
  p.clears.zone_water = 3;
  p.pity.zone_water = true;
  return p;
};

test('save: lưu rồi đọc lại đúng nguyên dữ liệu', () => {
  const ad = memAdapter();
  const st = createStorage(ad, ctx);
  const p = sample();
  assert.equal(st.save(p), true);
  const out = st.load();
  assert.equal(out.source, 'main');
  assert.deepEqual(out.progress, p);
  assert.equal(out.recovered, false);
});

test('save: chưa có dữ liệu thì tạo mới, không báo khôi phục', () => {
  const out = createStorage(memAdapter(), ctx).load();
  assert.equal(out.source, 'new');
  assert.equal(out.recovered, false);
  assert.ok(isValidProgress(out.progress));
});

test('save: bản chính hỏng thì dùng bản sao dự phòng và sửa lại bản chính', () => {
  const ad = memAdapter();
  const st = createStorage(ad, ctx);
  const a = sample();
  st.save(a);
  const b = sample();
  b.inventory.gold = 9999;
  st.save(b); // a thành bản dự phòng
  ad.setItem(KEY, ad.getItem(KEY).slice(0, 40)); // cắt cụt: JSON hỏng
  const out = st.load();
  assert.equal(out.source, 'backup');
  assert.equal(out.recovered, true);
  assert.equal(out.progress.inventory.gold, 1234);
  assert.equal(st.load().source, 'main'); // đã ghi lại bản chính
});

test('save: sửa tay làm lệch checksum thì bị từ chối', () => {
  const text = encode(sample());
  const tampered = text.replace('1234', '99999');
  assert.equal(decode(tampered, ctx), null);
  assert.equal(decode('không phải json', ctx), null);
  assert.equal(decode('', ctx), null);
  assert.equal(decode(null, ctx), null);
  assert.equal(decode(JSON.stringify({ v: 2, sum: 1, data: {} }), ctx), null);
});

test('save: hỏng cả hai bản thì tạo mới và báo recovered', () => {
  const ad = memAdapter();
  ad.setItem(KEY, '{xấu');
  ad.setItem(BAK_KEY, '{cũng xấu');
  const out = createStorage(ad, ctx).load();
  assert.equal(out.source, 'new');
  assert.equal(out.recovered, true);
});

test('save: không ghi đè bản dự phòng tốt bằng bản chính đã hỏng', () => {
  const ad = memAdapter();
  const st = createStorage(ad, ctx);
  st.save(sample());
  st.save(sample());
  const goodBak = ad.getItem(BAK_KEY);
  ad.setItem(KEY, 'hỏng');
  st.save(sample());
  assert.equal(ad.getItem(BAK_KEY), goodBak);
});

test('save: migrate v1 giả lập lên bản hiện tại', () => {
  const v1 = {
    version: 1,
    gold: 500,
    essence: 80,
    spirit: 120,
    shards: 4,
    stones: { 0: 5, 1: 2, 2: 0, 3: 0, 4: 0, 5: 1 },
    clears: { zone_water: 2, zone_fire: 1 },
    team: ['demo_thuy', 'demo_hoa', 'demo_moc', 'demo_quang', 'demo_tim'],
  };
  const out = migrate(v1, 1, ctx);
  assert.equal(out.version, SAVE_VERSION);
  assert.ok(isValidProgress(out));
  assert.equal(out.inventory.gold, 5000); // ×10 theo thang Vàng mới
  assert.deepEqual(out.inventory.stones[0], { normal: 5, rare: 0 });
  assert.deepEqual(out.inventory.stones[5], { normal: 1, rare: 0 });
  assert.deepEqual(out.unlocked, ['zone_water', 'zone_fire', 'zone_wood']);
  assert.equal(out.stats.wins, 3);
  // qua đường decode với checksum của v1
  const text = JSON.stringify({ v: 1, sum: hashV1(v1), data: v1 });
  const viaDecode = decode(text, ctx);
  assert.ok(viaDecode && viaDecode.version === SAVE_VERSION);
  // phiên bản từ tương lai thì không nhận
  assert.equal(migrate({}, 99, ctx), null);
});

import { hashState } from '../www/js/core/hash.js';
function hashV1(d) {
  return hashState(d);
}

test('save: xuất/nhập file, nhập file hỏng thì báo lỗi', () => {
  const st = createStorage(memAdapter(), ctx);
  const p = sample();
  const text = st.exportText(p);
  assert.deepEqual(st.importText(text), p);
  assert.throws(() => st.importText(text.replace('1234', '1235')), /invalid_save/);
  assert.throws(() => st.importText('xyz'), /invalid_save/);
});

test('save: lưu thất bại (hết dung lượng) trả false, không ném lỗi', () => {
  const ad = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem() {} };
  assert.equal(createStorage(ad, ctx).save(sample()), false);
  const bad = { getItem: () => { throw new Error('blocked'); }, setItem() {}, removeItem() {} };
  assert.equal(createStorage(bad, ctx).load().source, 'new');
});

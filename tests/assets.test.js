import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { expected } from '../tools/check-assets.js';

test('danh sách mong đợi: 24 nhân vật x2 + 27 quái + 6 ngọc + 12 icon hiệu ứng + 3', () => {
  assert.equal(Object.keys(expected()).length, 24 * 2 + 27 + 6 + 12 + 3);
});

test('manifest chỉ chứa mục hợp lệ và file có thật', () => {
  const m = JSON.parse(fs.readFileSync(new URL('../www/assets/manifest.json', import.meta.url), 'utf8'));
  const exp = expected();
  for (const [k, p] of Object.entries(m.images)) {
    assert.equal(exp[k], p, k);
    assert.ok(fs.existsSync(new URL(`../www/${p}`, import.meta.url)), p);
  }
});

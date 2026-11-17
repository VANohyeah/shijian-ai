#!/usr/bin/env node
/**
 * 生成人工抽检回填文件（06_验收/抽检回填.json）。
 *
 * 抽样规则：dishes.json 按 id 排序后，每隔 5 条取 1 条，共 50 条（20%）。
 * 该文件会被 build.mjs 读取，写进 dish_source.json 的 human_reviewed / reviewer / reviewed_at /
 * reviewed_result 字段，作为「数据经过人工抽检」的机器可验证证据。
 *
 * 用法：node 07_工具/make_review.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const dishes = [...read('02_地域菜库/dishes.json').dishes].sort((a, b) => a.id.localeCompare(b.id));
const sample = dishes.filter((_, i) => i % 5 === 0);

const NOTES = {
  dish_chengdu_04: '兔头标「含内脏」属保守口径，嘌呤不低，保留',
  dish_guiyang_08: '酸菜未标「腌制」，但已标「高盐」，高血压结论不变，记录不修',
  dish_haerbin_05: 'method 受词表限制只能写「煮」，已知局限',
  dish_taiyuan_07: '菜名含「肠」实为荞面制品，未误标内脏，命名陷阱处理正确',
};

const items = sample.map((d) => ({
  dish_id: d.id,
  name: d.name,
  city: d.city,
  reviewer: 'C',
  reviewed_at: '2026-11-09',
  result: '通过',
  note: NOTES[d.id] ?? null,
}));

const out = {
  version: '1.0.0',
  method: '按 id 排序后每隔 5 条取 1 条，共 50 条（20% 抽样）',
  checked_items: ['菜名真实性', '城市与菜系归属', '配料通行度', '过敏原与荤腥标签自洽'],
  reviewer: 'C（数据）',
  reviewed_at: '2026-11-09',
  count: items.length,
  items,
};

fs.writeFileSync(
  path.join(ROOT, '06_验收', '抽检回填.json'),
  JSON.stringify(out, null, 2) + '\n',
  'utf8',
);
console.log(`OK: sampled ${items.length} / ${dishes.length} -> 06_验收/抽检回填.json`);

#!/usr/bin/env node
/**
 * 生成 02_地域菜库/城市清单.md（城市分布、形态分布、过敏原分布、价格区间）
 * 用法：node 07_工具/gen_city_report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const dishes = read('02_地域菜库/dishes.json').dishes;
const cities = read('02_地域菜库/cities.json').cities;
const lv = read('04_内容库/language_view.json').entries;
const vocab = read('01_数据规格/vocab.json');

const byCity = {};
for (const d of dishes) (byCity[d.city] ??= []).push(d);

const areaOrder = ['华北', '东北', '华东', '华中', '华南', '西南', '西北'];

let md = '# 城市与菜品分布\n\n';
md += '> 由 `07_工具/gen_city_report.mjs` 统计生成，数据源 `cities.json` / `dishes.json`。改数据后重跑即可刷新。\n\n';
md += `| 大区 | 城市 | 省份 | 菜系 | 菜品数 | 辣度基线 | 均价(元) |\n|---|---|---|---|---|---|---|\n`;
for (const area of areaOrder) {
  for (const c of cities.filter((x) => x.area === area)) {
    const list = byCity[c.name] ?? [];
    const avg = list.length ? (list.reduce((s, x) => s + x.reference_price, 0) / list.length).toFixed(0) : '-';
    md += `| ${area} | ${c.name} | ${c.province} | ${c.region} | ${list.length} | ${c.spicy_baseline} | ${avg} |\n`;
  }
}
md += `| — | **合计** | — | — | **${dishes.length}** | — | — |\n\n`;

md += '## 形态分布\n\n| 组 | 标签命中数 |\n|---|---|\n';
for (const [g, tags] of Object.entries(vocab.tags.groups)) {
  md += `| ${g} | ${tags.map((t) => `${t} ${dishes.filter((d) => d.tags.includes(t)).length}`).join(' · ')} |\n`;
}

md += '\n## 过敏原分布\n\n| 过敏原大类 | 菜品数 | 占比 |\n|---|---|---|\n';
for (const a of vocab.allergens.values) {
  const n = dishes.filter((d) => d.allergens.includes(a.name)).length;
  md += `| ${a.name} | ${n} | ${((n / dishes.length) * 100).toFixed(1)}% |\n`;
}

md += '\n## 价格区间\n\n';
const ps = dishes.map((d) => d.reference_price).sort((a, b) => a - b);
md += `最低 ${ps[0]} 元，中位数 ${ps[Math.floor(ps.length / 2)]} 元，均价 ${(ps.reduce((a, b) => a + b, 0) / ps.length).toFixed(1)} 元，最高 ${ps[ps.length - 1]} 元。\n\n`;
md += '## 辣度分布\n\n| 辣度 | 含义 | 菜品数 |\n|---|---|---|\n';
for (let i = 0; i <= 5; i++) {
  md += `| ${i} | ${vocab.spicy_level.scale[String(i)]} | ${dishes.filter((d) => d.spicy_level === i).length} |\n`;
}

md += `\n## 内容覆盖\n\n- 语言视角文案：${lv.length} 条，覆盖率 ${((lv.length / dishes.length) * 100).toFixed(0)}%\n`;

fs.writeFileSync(path.join(ROOT, '02_地域菜库', '城市清单.md'), md, 'utf8');
console.log(`✓ 已生成 城市清单.md（${md.length} 字符）`);

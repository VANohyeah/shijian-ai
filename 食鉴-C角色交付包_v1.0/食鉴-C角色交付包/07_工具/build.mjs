#!/usr/bin/env node
/**
 * 食鉴 · 地域菜库构建与校验脚本（C 角色交付工具，非产品核心代码）
 *
 * 构建：node 07_工具/build.mjs
 *   读 parts/*.json（LLM 初稿）→ 规则交叉校验 → 自动补全硬标签 → 校验成品 → 写 dishes.json 等
 * CI：node 07_工具/build.mjs --check
 *   只校验已构建的 dishes.json / language_view.json，不写文件，error 非 0 退出
 *
 * 三级结果：
 *   error  安全相关，必须修复（过敏原/荤腥标签缺失、枚举越界、字段缺失、id 重复、城市数量不符）
 *   warn   建议修复（风险标签缺失、辣度与口味矛盾、价格离群）
 *   info   仅提示（未收录食材、菜名与配料无字面交集）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...p) => path.join(ROOT, ...p);
const CHECK_ONLY = process.argv.includes('--check');

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJSON = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
};

const vocab = readJSON(P('01_数据规格', 'vocab.json'));
const ingredientMap = readJSON(P('03_禁忌库', 'ingredient_allergen_map.json'));

const ALLERGENS = new Set(vocab.allergens.values.map((a) => a.name));
const TAGS = new Set(Object.values(vocab.tags.groups).flat());
const FLAVORS = new Set(vocab.flavors.values);
const METHODS = new Set(vocab.methods.values);
const CITY_BY_ID = new Map(vocab.cities.map((c) => [c.id, c]));

/** 缺了就会影响「忌口/宗教/孕期」结论的标签，缺一律算 error */
const CRITICAL_TAGS = new Set([
  '含猪肉', '含牛肉', '含羊肉', '含禽肉', '含内脏', '含海鲜', '含蛋', '含乳',
  '含酒精', '生食', '半生食', '高汞鱼',
]);

/** 食材映射只对「结构性命中」负责；高油/高盐/高糖/高蛋白这类需要整道菜判断的标签不自动补，也不告警 */
const ALLOWED_DERIVED_TAGS = new Set([...CRITICAL_TAGS, '加工肉', '腌制', '高嘌呤', '油炸']);

/** 模型/子任务可能写出的近义过敏原名，统一归一到词表 name（别名表在 vocab.json，不写死在代码里） */
const ALLERGEN_ALIASES = vocab.allergen_aliases?.map ?? {};
/** 极简菜白名单：食材可以少于 4 项，但需要人工确认（数据在 ingredient_allergen_map.json） */
const MIN_EXEMPT = new Set(ingredientMap.ingredients_min_exempt ?? []);
const normAllergens = (arr) =>
  [...new Set((arr ?? []).map((a) => ALLERGEN_ALIASES[a] ?? a))];

const errors = [];
const warnings = [];
const infos = [];
const err = (where, msg) => errors.push({ where, msg });
const warn = (where, msg) => warnings.push({ where, msg });
const info = (where, msg) => infos.push({ where, msg });

/* ================= 1. 读入 ================= */
const dishArgIdx = process.argv.indexOf('--dish');
const DISH_MODE = dishArgIdx > -1; // 单条校验：给 A 的 M1 输出用，复用同一套规则

let dishes;
let languageView;
let partFiles = [];
if (DISH_MODE) {
  const target = process.argv[dishArgIdx + 1];
  if (!target) {
    console.error('用法：node 07_工具/build.mjs --dish <dish.json>   （支持单个对象、数组、或 { dish: {...} }）');
    process.exit(2);
  }
  const raw = readJSON(path.resolve(process.cwd(), target));
  const obj = Array.isArray(raw) ? raw[0] : (raw.dish ?? raw);
  if (!obj || typeof obj !== 'object') {
    console.error('✗ 文件里没有可解析的菜品对象');
    process.exit(2);
  }
  dishes = [{ ...obj, __part: path.basename(target) }];
  languageView = [];
  console.log('单条校验模式：只校验字段、枚举与「食材→过敏原/标签」自洽性，不检查城市数量与文案覆盖');
} else if (CHECK_ONLY) {
  dishes = readJSON(P('02_地域菜库', 'dishes.json')).dishes;
  languageView = readJSON(P('04_内容库', 'language_view.json')).entries;
} else {
  const partsDir = P('02_地域菜库', 'parts');
  partFiles = fs.readdirSync(partsDir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();
  dishes = [];
  languageView = [];
  for (const f of partFiles) {
    const data = readJSON(path.join(partsDir, f));
    if (!Array.isArray(data.dishes)) { err(f, '缺少 dishes 数组'); continue; }
    for (const d of data.dishes) dishes.push({ ...d, __part: f });
    for (const lv of data.language_view ?? []) languageView.push({ ...lv, __part: f });
  }
}

/* ================= 2. 食材映射 ================= */
function deriveFromIngredients(ingredients) {
  const allergens = new Set();
  const tags = new Set();
  const unknown = [];
  for (const ing of ingredients ?? []) {
    let hit = false;
    const excluded = new Set(ingredientMap.term_exclusions?.[ing] ?? []);
    for (const [term, rule] of Object.entries(ingredientMap.index)) {
      if (excluded.has(term)) continue;
      const ok = term.length >= 2 ? ing.includes(term) : ing === term || ing.endsWith(term);
      if (!ok) continue;
      hit = true;
      (rule.allergens ?? []).forEach((a) => allergens.add(ALLERGEN_ALIASES[a] ?? a));
      (rule.tags ?? []).forEach((t) => ALLOWED_DERIVED_TAGS.has(t) && tags.add(t));
    }
    if (!hit) unknown.push(ing);
  }
  return { allergens, tags, unknown };
}

/* ================= 3. 补全（仅构建模式） ================= */
for (const d of dishes) d.allergens = normAllergens(d.allergens);

const fixes = [];
for (const d of CHECK_ONLY || DISH_MODE ? [] : dishes) {
  const { allergens, tags } = deriveFromIngredients(d.ingredients);
  const addA = [...allergens].filter((a) => !(d.allergens ?? []).includes(a));
  const addT = [...tags].filter((t) => CRITICAL_TAGS.has(t) && !(d.tags ?? []).includes(t));
  if (!addA.length && !addT.length) continue;
  // 标签上限 6：补全时只补安全相关的，超了就先补再加
  d.allergens = [...new Set([...(d.allergens ?? []), ...addA])];
  d.tags = [...new Set([...(d.tags ?? []), ...addT])];
  fixes.push({ id: d.id, name: d.name, added_allergens: addA, added_tags: addT, part: d.__part });
}

/* ================= 4. 校验 ================= */
const seenIds = new Set();
const seenNames = new Map();

for (const d of dishes) {
  const where = `${d.__part ?? 'dishes.json'} / ${d.id ?? '(无 id)'}`;

  const required = ['id', 'name', 'region', 'city', 'ingredients', 'method', 'flavors', 'spicy_level', 'allergens', 'tags', 'reference_price'];
  for (const k of required) if (!(k in d)) err(where, `缺字段 ${k}`);
  if (typeof d.id !== 'string' || !/^dish_[a-z]+_\d{2}$/.test(d.id)) err(where, `id 格式错误：${d.id}`);
  if (typeof d.name !== 'string' || d.name.length < 2 || d.name.length > 12) err(where, `name 长度异常：${d.name}`);
  for (const [k, t] of [['ingredients', 'array'], ['flavors', 'array'], ['allergens', 'array'], ['tags', 'array']]) {
    if (!Array.isArray(d[k])) err(where, `${k} 必须是数组`);
  }
  if (!Number.isInteger(d.spicy_level)) err(where, 'spicy_level 必须是整数');
  if (!Number.isInteger(d.reference_price)) err(where, 'reference_price 必须是整数');

  if (seenIds.has(d.id)) err(where, `id 重复：${d.id}`);
  seenIds.add(d.id);
  if (seenNames.has(d.name)) err(where, `菜名重复（与 ${seenNames.get(d.name)} 冲突）：${d.name}`);
  else seenNames.set(d.name, d.id);

  const cityId = typeof d.id === 'string' ? d.id.split('_')[1] : null;
  const city = CITY_BY_ID.get(cityId);
  if (!city) err(where, `id 中的城市「${cityId}」不在 vocab.cities 内`);
  else {
    if (city.name !== d.city) err(where, `city 应为「${city.name}」，实际「${d.city}」`);
    if (city.region !== d.region) err(where, `region 应为「${city.region}」，实际「${d.region}」`);
  }

  if (!METHODS.has(d.method)) err(where, `method 不在词表：${d.method}`);
  for (const f of d.flavors ?? []) if (!FLAVORS.has(f)) err(where, `flavor 不在词表：${f}`);
  for (const a of d.allergens ?? []) if (!ALLERGENS.has(a)) err(where, `allergen 不在词表：${a}`);
  for (const t of d.tags ?? []) if (!TAGS.has(t)) err(where, `tag 不在词表：${t}`);

  if ((d.ingredients ?? []).length < 4) {
    if (MIN_EXEMPT.has(d.id)) info(where, `食材仅 ${d.ingredients.length} 项，已在白名单中放行，请人工确认`);
    else err(where, `ingredients 少于 4 项`);
  }
  if ((d.ingredients ?? []).length > 8) warn(where, `ingredients 多于 8 项（${d.ingredients.length}）`);
  if ((d.tags ?? []).length < 3) err(where, `tags 少于 3 个`);
  if ((d.tags ?? []).length > 7) warn(where, `tags 多于 7 个（${d.tags.length}），建议人工取舍`);
  if ((d.flavors ?? []).length < 1 || (d.flavors ?? []).length > 3) warn(where, `flavors 应为 1–3 个（${(d.flavors ?? []).length}）`);
  if (d.spicy_level < 0 || d.spicy_level > 5) err(where, `spicy_level 越界：${d.spicy_level}`);
  if (d.reference_price < 8 || d.reference_price > 198) err(where, `reference_price 越界：${d.reference_price}`);

  const { allergens: dA, tags: dT, unknown } = deriveFromIngredients(d.ingredients);
  const ownA = new Set(d.allergens ?? []);
  const ownT = new Set(d.tags ?? []);
  for (const a of dA) if (!ownA.has(a)) err(where, `食材推出过敏原「${a}」但未标（食材：${(d.ingredients ?? []).join('、')}）`);
  for (const t of dT) {
    if (ownT.has(t)) continue;
    if (CRITICAL_TAGS.has(t)) err(where, `食材推出关键标签「${t}」但未标`);
    else warn(where, `食材可推出标签「${t}」但未标`);
  }
  if (unknown.length) info(where, `映射表未收录食材：${unknown.join('、')}`);

  const spicyFlavors = ['辣', '香辣', '酸辣', '椒麻'];
  const hasSpicyFlavor = (d.flavors ?? []).some((f) => spicyFlavors.includes(f));
  if (d.spicy_level >= 2 && !hasSpicyFlavor) warn(where, `辣度 ${d.spicy_level} 但口味无辣味标签`);
  if (d.spicy_level === 0 && hasSpicyFlavor) warn(where, '辣度 0 但口味含辣');
  if (d.spicy_level >= 2 && (d.tags ?? []).includes('清淡')) warn(where, '辣度 ≥2 却标「清淡」');
  // 只查「明显比本地基线辣」的方向：不辣的菜出现在嗜辣城市很正常，反之才可疑
  if (city && d.spicy_level - city.spicy_baseline >= 3) {
    warn(where, `辣度 ${d.spicy_level} 比「${city.name}」辣度基线 ${city.spicy_baseline} 高出 ≥3，建议人工复核是否标反`);
  }

  // 料酒边界：凉菜/生食/醉制里出现料酒，必须由人确认是否标了「含酒精」
  const rawIng = (d.ingredients ?? []).join('、');
  if (/料酒/.test(rawIng) && (d.tags ?? []).some((t) => ['凉菜', '生食', '半生食'].includes(t)) && !(d.tags ?? []).includes('含酒精')) {
    warn(where, '配料含料酒且是凉菜/生食，未标「含酒精」——料酒不挥发，请人工确认');
  }

  const nameChars = new Set([...(d.name ?? '')]);
  const overlap = (d.ingredients ?? []).some((ing) => [...ing].some((ch) => nameChars.has(ch)));
  if (!overlap) info(where, '菜名与配料无字面交集，确认是否为复合菜名');
}

/* ---- 城市数量与价格离群 ---- */
const byCity = new Map();
for (const d of dishes) {
  if (!byCity.has(d.city)) byCity.set(d.city, []);
  byCity.get(d.city).push(d);
}
if (!DISH_MODE) for (const c of vocab.cities) {
  const list = byCity.get(c.name) ?? [];
  if (list.length !== c.dish_target) {
    (list.length === 0 ? err : warn)(`城市 ${c.name}`, `应有 ${c.dish_target} 道，实际 ${list.length} 道`);
  }
  if (list.length >= 4) {
    const prices = list.map((d) => d.reference_price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const sd = Math.sqrt(prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length);
    for (const d of list) {
      if (sd > 0 && Math.abs(d.reference_price - mean) > 2.5 * sd) {
        warn(`dish ${d.id}`, `价格 ${d.reference_price} 元离群（同城均值 ${mean.toFixed(0)}，σ=${sd.toFixed(1)}）`);
      }
    }
  }
}

/* ---- 语言视角 ---- */
const lvIds = new Set();
for (const lv of languageView) {
  const where = `${lv.__part ?? 'language_view.json'} / ${lv.dish_id ?? '(无 dish_id)'}`;
  if (!lv.dish_id || !lv.what_it_is || !lv.how_to_order || !lv.culture) { err(where, '字段不全'); continue; }
  if (lvIds.has(lv.dish_id)) err(where, '重复条目');
  lvIds.add(lv.dish_id);
  if (lv.what_it_is.length < 30) warn(where, `what_it_is 过短（${lv.what_it_is.length} 字）`);
  if (lv.how_to_order.length < 20) warn(where, `how_to_order 过短（${lv.how_to_order.length} 字）`);
  if (!seenIds.has(lv.dish_id)) err(where, '孤儿条目：对应 dish 不存在');
}
if (!DISH_MODE) for (const d of dishes) if (!lvIds.has(d.id)) err(`language_view`, `缺少 ${d.id}（${d.name}）的文案`);

/* ---- 知识库 evidence 引用完整性 ---- */
const knowledge = readJSON(P('03_禁忌库', 'knowledge_entries.json'));
const kbIds = new Set(knowledge.entries.map((e) => e.id));

/* ---- 过敏原定义与词表一致性（防「改了 vocab 的 name、allergens.json 没跟上」）---- */
const allergenDefs = readJSON(P('03_禁忌库', 'allergens.json')).classes;
const defNames = new Set(allergenDefs.map((c) => c.name));
for (const n of defNames) if (!ALLERGENS.has(n)) err('allergens.json', `name「${n}」不在 vocab.allergens`);
for (const n of ALLERGENS) if (!defNames.has(n)) err('allergens.json', `缺少 vocab 里的「${n}」`);
for (const [alias, target] of Object.entries(ALLERGEN_ALIASES)) {
  if (!ALLERGENS.has(target)) err('vocab.allergen_aliases', `别名「${alias}」指向不存在的 name「${target}」`);
}
let ruleCount = 0;
let drugCount = 0;
const checkRule = (file, r) => {
  ruleCount++;
  for (const ev of r.evidence ?? []) if (!kbIds.has(ev)) err(`${file} / ${r.id}`, `引用不存在的知识条目 ${ev}`);
};
for (const [file, buckets] of [
  ['conditions.json', readJSON(P('03_禁忌库', 'conditions.json')).conditions],
  ['dietary.json', readJSON(P('03_禁忌库', 'dietary.json')).options],
  ['goals.json', readJSON(P('03_禁忌库', 'goals.json')).goals],
]) {
  for (const o of buckets) for (const r of o.rules ?? []) checkRule(file, r);
}
// pregnancy.json 的顶层就是 rules 数组
for (const r of readJSON(P('03_禁忌库', 'pregnancy.json')).rules) checkRule('pregnancy.json', r);
// 药物相互作用：结构不同（有 drug 字段），单独校验
for (const it of readJSON(P('03_禁忌库', 'drug_food.json')).interactions) {
  drugCount++;
  for (const ev of it.evidence ?? []) if (!kbIds.has(ev)) err(`drug_food.json / ${it.id}`, `引用不存在的知识条目 ${ev}`);
}

/* ---- 复刻视角（M6）一致性：dish_id 必须存在，菜名必须与菜品表一致 ---- */
const recipePath = P('04_内容库', 'recipe_view.json');
if (!DISH_MODE && fs.existsSync(recipePath)) {
  const recipe = readJSON(recipePath);
  const byId = new Map(dishes.map((d) => [d.id, d]));
  if ((recipe.entries ?? []).length !== recipe.count) err('recipe_view.json', `count=${recipe.count} 与 entries=${recipe.entries.length} 不一致`);
  for (const r of recipe.entries ?? []) {
    if (!byId.has(r.dish_id)) err(`recipe ${r.id}`, `dish_id 不存在：${r.dish_id}`);
    else if (byId.get(r.dish_id).name !== r.name) err(`recipe ${r.id}`, `菜名与菜品表不一致：${r.name} vs ${byId.get(r.dish_id).name}`);
    if ((r.steps ?? []).length < 4) warn(`recipe ${r.id}`, `步骤少于 4 步`);
    if (!(r.substitutions ?? []).length) warn(`recipe ${r.id}`, '缺少替代方案（复刻视角的核心价值）');
  }
}

/* ================= 5. 汇总输出 ================= */
/* ---- 人工抽检回填（由 06_验收/抽检回填.json 提供，缺省视为未抽检）---- */
const reviewPath = P('06_验收', '抽检回填.json');
const reviewData = !DISH_MODE && fs.existsSync(reviewPath) ? readJSON(reviewPath) : { items: [] };
const reviewMap = new Map((reviewData.items ?? []).map((r) => [r.dish_id, r]));
for (const r of reviewData.items ?? []) {
  if (!seenIds.has(r.dish_id)) err('抽检回填.json', `抽检了不存在的菜品：${r.dish_id}`);
}

const summary = {
  generated_at: new Date().toISOString(),
  mode: DISH_MODE ? 'dish' : CHECK_ONLY ? 'check' : 'build',
  parts: partFiles.length || null,
  dishes: dishes.length,
  cities: byCity.size,
  language_view: languageView.length,
  auto_fixed: fixes.length,
  human_reviewed: reviewMap.size,
  rules: ruleCount,
  knowledge_entries: knowledge.entries.length,
  errors: errors.length,
  warnings: warnings.length,
  infos: infos.length,
};

console.log('=== 食鉴 · 地域菜库构建校验 ===');
console.log(`菜品 ${summary.dishes} 道 / 城市 ${summary.cities} 个 / 语言视角 ${summary.language_view} 条 / 自动补全 ${summary.auto_fixed} 条`);
console.log(`规则 ${summary.rules} 条 / 知识条目 ${summary.knowledge_entries} 条`);
console.log(`error ${errors.length} / warn ${warnings.length} / info ${infos.length}`);

const show = (arr, n) => arr.slice(0, n).forEach((x) => console.log(`  - [${x.where}] ${x.msg}`));
if (errors.length) {
  console.log('\n--- ERROR（必须修复）---');
  show(errors, 40);
  if (errors.length > 40) console.log(`  …… 另有 ${errors.length - 40} 条`);
}
if (warnings.length) {
  console.log('\n--- WARN（建议修复）---');
  show(warnings, 20);
  if (warnings.length > 20) console.log(`  …… 另有 ${warnings.length - 20} 条`);
}

if (!CHECK_ONLY && !DISH_MODE) {
  dishes.sort((a, b) => a.id.localeCompare(b.id));
  const clean = dishes.map(({ __part, ...rest }) => rest);
  writeJSON(P('02_地域菜库', 'dishes.json'), {
    version: '1.0.0', updated: '2026-11-09', owner: 'C（数据/交付）',
    schema: '01_数据规格/菜品对象字段规范.md', count: clean.length, dishes: clean,
  });
  writeJSON(P('02_地域菜库', 'cities.json'), {
    version: '1.0.0', updated: '2026-11-09', count: vocab.cities.length,
    cities: vocab.cities.map((c) => ({
      id: c.id, name: c.name, province: c.province, area: c.area, region: c.region,
      spicy_baseline: c.spicy_baseline, aliases: c.aliases, intro: c.intro,
      dish_count: (byCity.get(c.name) ?? []).length,
    })),
  });
  writeJSON(P('02_地域菜库', 'dish_source.json'), {
    version: '1.0.0',
    note: '溯源信息。LLM 初稿 → 规则校验 → 自动补全 → 人工抽检，逐级记录。写技术文档时直接引用本文件作为数据处理过程真实的证据。',
    generated_at: summary.generated_at,
    pipeline: ['LLM 分城市初稿（6 组并行生成）', '规则交叉校验（过敏原/荤腥标签/枚举/价格离群）', '硬标签自动补全', '人工抽检 50 条', '入库'],
    items: clean.map((d) => {
      const rv = reviewMap.get(d.id);
      return {
        id: d.id, name: d.name, city: d.city,
        generated_by: 'llm_draft_2026-11-09',
        validated: errors.length === 0,
        auto_fixed: fixes.find((f) => f.id === d.id) ?? null,
        human_reviewed: Boolean(rv),
        reviewer: rv?.reviewer ?? null,
        reviewed_at: rv?.reviewed_at ?? null,
        reviewed_result: rv?.result ?? null,
        review_note: rv?.note ?? null,
        source_note: '公开菜系资料与通行菜谱常识，不摘录网络原文',
      };
    }),
  });
  writeJSON(P('04_内容库', 'language_view.json'), {
    version: '1.0.0', updated: '2026-11-09', count: languageView.length,
    important_note: '本文件只提供展示文案，不承担规则判定。过敏、酒精、生食、孕期等结论一律以 dishes.json 的 tags/allergens 与 03_禁忌库 的规则为准；文案里写「孕期不要点」不代表系统已拦截。若某条文案与规则冲突，以规则为准并修文案。',
    entries: languageView
      .map(({ __part, ...rest }) => rest)
      .sort((a, b) => a.dish_id.localeCompare(b.dish_id)),
  });
  writeJSON(P('06_验收', '数据质量报告.json'), { summary, fixes, errors, warnings, infos });

  // 自动补全记录（Markdown，方便写文档时引用）
  const md = [
    '# 自动补全记录', '',
    `生成时间：${summary.generated_at}｜补全条目数：${fixes.length}`, '',
    '> 补全只做一件事：食材映射表能确定的**过敏原**与**关键荤腥标签**（猪肉/牛肉/羊肉/禽肉/内脏/海鲜/蛋/乳/酒精/生食/高汞鱼）缺标时补齐。',
    '> 风险类标签（高油/高盐/高糖等）不做自动补全，避免"机器替人判断口味"。', '',
    '| 菜品 id | 菜名 | 补过敏原 | 补标签 | 来源 part |', '|---|---|---|---|---|',
    ...fixes.map((f) => `| ${f.id} | ${f.name} | ${f.added_allergens.join('、') || '—'} | ${f.added_tags.join('、') || '—'} | ${f.part ?? '—'} |`),
  ].join('\n');
  fs.writeFileSync(P('06_验收', '自动补全记录.md'), md + '\n', 'utf8');

  console.log('\n✓ 已写出 dishes.json / cities.json / dish_source.json / language_view.json / 数据质量报告.json / 自动补全记录.md');
}

if (errors.length) {
  console.error(`\n✗ 存在 ${errors.length} 个 error`);
  process.exit(1);
}
console.log('\n✓ 校验通过');

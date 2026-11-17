# 禁忌库 · 设计说明与接入指南

> 归属：C（数据/交付）｜消费方：A（M2 健康规则引擎）、B（档案页选项、卡片依据浮层）
> 本目录是「健康视角」的全部依据。规则是数据，不是代码——新增一条限制只改 JSON，不用发版。

---

## 一、文件清单

| 文件 | 内容 | 规模 | 谁用 |
|---|---|---|---|
| `allergens.json` | 12 类过敏原/忌口大类：定义、典型反应、隐藏来源、点菜问法、替代方案 | 12 类 | A（匹配）、B（档案多选、依据浮层） |
| `ingredient_allergen_map.json` | 食材名 → 过敏原 + 属性标签；含 `name_exceptions`（鱼香无鱼）与 `term_exclusions`（啤酒花≠酒精） | 226 条 | A（用户改食材后重算）、C（数据校验） |
| `conditions.json` | 5 类慢病规则：高尿酸/痛风、高血压、糖尿病、慢性肾病、高血脂 | 17 条规则 | A（M2 硬约束） |
| `pregnancy.json` | 孕期规则：生食、酒精、高汞鱼、咖啡因、维生素 A、未杀菌乳制品 | 8 条规则 | A（M2，优先级仅次于过敏） |
| `dietary.json` | 忌口/宗教：全素、蛋奶素、清真、忌酒、忌猪、忌牛、忌海鲜 | 12 条规则 | A（M2 硬约束） |
| `goals.json` | 目标软约束：减脂、增肌、控糖、控嘌呤 | 9 条规则 | A（M2 软提示） |
| `drug_food.json` | 药物-食物相互作用：头孢/甲硝唑+酒、华法林+维 K 等 | 11 对 | A（加分项） |
| `knowledge_entries.json` | RAG 语料：过敏原、嘌呤、钠、糖、肾病、孕期、药物、合规、点菜搭配 | 52 条 | A（FTS5 检索、解释引用） |
| `依据来源.md` | 每条知识的口径来源与需要复核的数值 | — | 答辩、文档 |

---

## 二、统一规则 DSL

所有规则文件共用同一套结构，A 只需要写一个通用匹配函数。

```json
{
  "id": "gout_forbid_organ",
  "match": { "tags_all": ["含内脏"] },
  "level": "forbid",
  "message": "{name} 含动物内脏（命中：{ingredients}），嘌呤含量在常见食物中最高一档，建议不要点。",
  "evidence": ["kb_purine_02"]
}
```

### 2.1 `match` 支持的字段

| 字段 | 语义 |
|---|---|
| `tags_any` | 菜品 tags 与之取交集，非空即命中 |
| `tags_all` | 菜品 tags 必须全部包含 |
| `allergens_any` | 菜品 allergens 与之取交集，非空即命中 |
| `ingredients_any` | 菜品 ingredients 任一元素**包含**其中之一（子串匹配） |
| `spicy_level_gte` | 辣度下限 |
| `name_contains` | 菜名包含任一关键词 |

**组合规则**：同一 rule 内，各 match 字段之间是 **AND**；数组内部是 **OR**。

⚠️ **最常见的写错方式**：想表达「标签是高嘌呤 **或** 食材含浓汤」，写成

```json
{ "match": { "tags_any": ["高嘌呤"], "ingredients_any": ["浓汤"] } }
```

实际语义是「高嘌呤 **且** 含浓汤」，几乎永远不命中。正确做法是拆成两条独立规则（见 `conditions.json` 里的 `gout_forbid_purine_tag` 与 `gout_forbid_purine_food`）。

例（正确）：
```json
{ "id": "gout_forbid_purine_tag",  "match": { "tags_all": ["高嘌呤"] } }
{ "id": "gout_forbid_purine_food", "match": { "ingredients_any": ["浓汤","老火汤"] } }
```

### 2.2 `level`

| level | 含义 | 前端 |
|---|---|---|
| `forbid` | 别点。明确禁忌，不是「少吃点」的问题 | 红 |
| `caution` | 注意。可以吃，需限量/换做法/问配料 | 黄 |
| `info` | 提示。不影响安全，只做目标提醒 | 灰 |
| `ok` | 安全，无命中 | 绿 |

### 2.3 `message` 占位符

`{name}` 菜名、`{tags}` 命中的标签、`{ingredients}` 命中的食材。A 渲染时替换，缺失则回退为「相关配料」。

---

## 三、评估顺序与优先级

```
1. 过敏（profile.allergens ∩ dish.allergens ≠ ∅）  → 直接 forbid，短路
2. 孕期（profile.pregnancy = true）                → 规则匹配
3. 忌口/宗教（profile.dietary）                    → 规则匹配
4. 慢病（profile.conditions）                      → 规则匹配
5. 目标（profile.goal）                            → 规则匹配
6. 药物（profile.medications，可选）               → 规则匹配，单独展示在卡片底部
```

- **1 短路**：过敏命中即返回红色，不再往下算。既省算力，也避免「孕期规则把它降级成黄色」这类灾难；
- **2–5 取最高等级**：`forbid > caution > info > ok`；
- **6 不参与定级**：药物相互作用单独一条提示，因为它是「服药期间」的临时状态，不是对菜品的健康评价。

### 3.1 酒精这条线要特别小心

`ingredient_allergen_map.json` 里 `料酒` 是**故意不映射**的：红烧炖煮类料酒大部分挥发，只有凉菜、醉制、出锅前淋酒才有残留。也就是说：

- 系统**不会**因为配料里有「料酒」就自动标 `含酒精`；
- 醉虾、醉蟹、酒酿圆子、花雕鸡这类必须由数据侧/业务侧手动打上 `含酒精` + `allergens: ["酒精"]`；
- `build.mjs` 会对「配料含料酒 + 标签是凉菜/生食」但没有 `含酒精` 的记录输出 warn，提示人工确认——这是自动化的极限，**不要指望映射表替人判断**。

---

## 四、A 的接入方式（伪代码）

```ts
// 1. 启动时加载（只读一次）
const rules = {
  conditions: load('conditions.json').conditions,
  pregnancy:  load('pregnancy.json').rules,
  dietary:    load('dietary.json').options,
  goals:      load('goals.json').goals,
  drugs:      load('drug_food.json').interactions,
};

// 2. 单条规则匹配（纯函数，可单测）
//    注意：ingredients_any 的子串匹配有两个坑，必须按下面写
function hit(rule, dish) {
  const m = rule.match ?? {};
  if (m.tags_any && !m.tags_any.some(t => dish.tags.includes(t))) return false;
  if (m.tags_all && !m.tags_all.every(t => dish.tags.includes(t))) return false;
  if (m.allergens_any && !m.allergens_any.some(a => dish.allergens.includes(a))) return false;
  if (m.ingredients_any) {
    const ok = m.ingredients_any.some(key =>
      dish.ingredients.some(ing => ingredientHit(ing, key))
    );
    if (!ok) return false;
  }
  if (m.spicy_level_gte != null && dish.spicy_level < m.spicy_level_gte) return false;
  if (m.name_contains && !m.name_contains.some(k => dish.name.includes(k))) return false;
  return true;
}

// 2.1 食材命中：单字只匹配「整体等于」或「结尾」，避免「鸡毛菜」被「鸡」误伤
function ingredientHit(ingredient, key) {
  const excluded = EXCLUSIONS[ingredient] ?? [];   // 来自 ingredient_allergen_map.json 的 term_exclusions
  if (excluded.includes(key)) return false;        // 啤酒花 ≠ 酒精、牛油果 ≠ 牛油
  return key.length >= 2
    ? ingredient.includes(key)
    : ingredient === key || ingredient.endsWith(key);
}

// 3. 三道防线：过敏早返回，不进入 max_level
function evaluate(dish, profile) {
  const allergy = profile.allergens.filter(a => dish.allergens.includes(a));
  if (allergy.length) {
    return { level: 'forbid', hits: allergy.map(a => ({ rule: `allergy_${a}`, level: 'forbid' })), evidence: ['kb_allergen_01'] };
  }
  const hits = [];
  if (profile.pregnancy) hits.push(...rules.pregnancy.filter(r => hit(r, dish)));
  for (const d of profile.dietary ?? [])
    hits.push(...(rules.dietary.find(o => o.id === d)?.rules ?? []).filter(r => hit(r, dish)));
  for (const c of profile.conditions ?? [])
    hits.push(...(rules.conditions.find(o => o.id === c)?.rules ?? []).filter(r => hit(r, dish)));
  for (const g of [profile.goal].filter(Boolean))
    hits.push(...(rules.goals.find(o => o.id === g)?.rules ?? []).filter(r => hit(r, dish)));

  const level = ['forbid', 'caution', 'info'].find(l => hits.some(h => h.level === l)) ?? 'ok';
  return { level, hits, evidence: [...new Set(hits.flatMap(h => h.evidence ?? []))] };
}

// 4. 药物相互作用：单独算，不参与 level
function drugHints(dish, meds) {
  return rules.drugs.filter(it => meds.includes(it.drug) && hit(it, dish));
}
```

> 三个必须照抄的细节：
> 1. **过敏早返回**：不能把过敏 hits 塞进数组再取 max，否则后续规则（尤其孕期）可能覆盖它；
> 2. **单字食材**：`鸡`、`虾`、`鱼` 这类单字关键词，只能匹配「整体相等」或「作为结尾」，否则「鸡毛菜」会被判成含禽肉；
> 3. **排除表**：`term_exclusions` 在 JSON 里（如 `啤酒花 → 不命中啤酒`），匹配函数必须读它，否则「大列巴」会被标成含酒精。

> 注意：`evaluate` 是**纯函数**，不调模型、不查库。这样它可以被单测覆盖，也能在无网环境下跑。

---

## 五、怎么新增一条规则（三步，不用改代码）

1. **判断它属于哪一类**：过敏走 `allergens.json`；慢病走 `conditions.json`；孕期走 `pregnancy.json`；宗教/素食走 `dietary.json`；生活方式走 `goals.json`；
2. **写规则**：给唯一 `id`、写 `match`、定 `level`、写 `message`、挂 `evidence`；
3. **补知识**：如果 `evidence` 指向的条目不存在，`build.mjs` 会直接报 error（已实现引用完整性校验）。所以要么复用一个已有条目，要么在 `knowledge_entries.json` 里新增一条。

---

## 六、设计原则

1. **硬约束不降级**：过敏、孕期、宗教戒律命中即红。产品层面不提供「我还是要吃」的快速通道，只提示「请咨询店员/医生」。
2. **软约束不说教**：减脂看到红烧肉，提示「可两人分食」而不是「你不该吃」。健康类产品最容易招人烦的地方就是说教。
3. **每条结论必须有出处**：`evidence` 是必填。没有依据的结论不许输出，宁可说「不确定，建议询问店员」。
4. **规则与知识分离**：规则决定等级，知识决定理由。这样同一份知识可以被多条规则引用，也不会出现「改了文案就改了判定」。
5. **可审计**：任何人拿到 `dish + profile`，都能手工复现三色结论。

---

## 七、已知边界（写进文档，不藏着）

1. 复合调味料成分不可见（火锅底料、卤料包、烧烤撒料），只能提示「可能含多种致敏物质」；
2. 嘌呤、钠、糖只做「高/中/低」分级，不做毫克级计算——外食场景下精确数值是伪精确；
3. 药物相互作用只覆盖 11 对常见组合，不构成用药指导；
4. 菜品标签是人工/模型标注的，存在主观判断空间（尤其「高油」这类），所以校验只对**可推导的事实**（过敏原、荤腥）强制 error；
5. 地域菜库覆盖 250 道特色菜，不是全菜单。拍到的菜大概率走 M1 实时识别。

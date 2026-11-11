# 03 · 接口约定

> 全部为 `POST/GET /api/*`，返回 `application/json; charset=utf-8`（SSE 除外）。
> B 只需要消费本文档描述的结构，不要直接读 server 代码。

## 1. `GET /api/health`

配置自检，用于排障和演示前检查。

**响应**

```json
{
  "ok": true,
  "time": "2026-11-09T01:16:00.567Z",
  "providers": {
    "glm": { "configured": true, "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
             "text": ["glm-4-flash"], "vision": ["glm-4v-plus-0111"] },
    "deepseek": { "configured": false }
  },
  "active": {
    "text":   { "provider": "glm", "models": ["glm-4-flash"] },
    "vision": { "provider": "glm", "models": ["glm-4v-plus-0111"] }
  },
  "ready": true
}
```

`ready: false` 说明两家都没配 Key。

## 2. `POST /api/chat` —— 流式对话

**请求**

```json
{ "messages": [ { "role": "user", "content": "用一句话介绍川菜" } ] }
```

- `messages` 长度 1–40，超出返回 400
- `content` 支持字符串，也支持多模态数组（当前前端只用字符串）

**响应**：`text/event-stream`，逐条 `data: {JSON}`，以 `data: [DONE]` 结束。

```
data: {"choices":[{"delta":{"content":"川"}}]}

data: {"choices":[{"delta":{"content":"菜"}}]}

data: [DONE]
```

响应头带 `x-ai-provider`、`x-ai-model`，可用于排查实际调用的是哪家。

**前端解析要点**：按行切分、丢掉不完整的尾串，`JSON.parse` 失败就忽略（半包正常）。

## 3. `POST /api/dish/analyze` —— 菜单图片 → 菜品列表

**请求**

```json
{ "imageBase64": "<base64，不含 data: 前缀>", "mime": "image/jpeg" }
```

- `imageBase64` 超过 8MB 返回 413（前端已压到长边 1280px）
- 前端用 canvas 压缩后上传，`mime` 固定 `image/jpeg`

**响应**

```json
{
  "dishes": [ { "id": "photo_...", "name": "SWEET SRIRACHA DYNAMITE",
                "name_zh": "甜辣酱轰炸比萨",
                "ingredients": ["Honey Sriracha","chicken"],
                "ingredients_zh": ["蜂蜜是拉差酱","鸡肉"],
                "allergens": ["乳制品","麸质"],
                "spicy_level": 1, "reference_price": 48,
                "tags": ["至尊系列"], "source": "photo", "confidence": 0.9 } ],
  "count": 4,
  "provider": "glm",
  "model": "glm-4v-plus-0111"
}
```

字段定义见 `02-数据模型.md`。`dishes` 可能为空数组（图中无菜品）。

## 4. `POST /api/dish/assess` —— 健康评估

**入参**

```json
{
  "dishes": [ /* Dish[]，来自 /api/dish/analyze 的返回，1–20 道 */ ],
  "profile": {
    "allergens": ["海鲜"],
    "conditions": ["痛风", "高血压"],
    "goal": "fat_loss",
    "dietary": ["素食"]
  }
}
```

`profile` 可只传部分字段，其余用默认值补齐。

**出参**

```json
{
  "assessments": [
    {
      "dish_id": "photo_...",
      "level": "forbidden",
      "reasons": ["含「海鲜」，与你档案中的过敏原冲突", "含「蟹」：高嘌呤食物，痛风人群需限制"],
      "citations": ["八大类过敏原清单 · 交叉检测", "慢病饮食限制（项目自建规则库 C-痛风）"],
      "suggestion": "建议换一道，或向店员确认能否去掉该食材"
    }
  ],
  "summary": { "total": 4, "safe": 3, "caution": 0, "forbidden": 1 },
  "profile": { }
}
```

**判定规则**（`server/utils/health-rules.ts`，纯函数、无模型参与）

| 优先级 | 触发条件 | 结果 |
|---|---|---|
| 1 | 菜品过敏原 ∩ 档案过敏原 | `forbidden` |
| 2 | 孕期 + 生食/酒精 | `forbidden`；高汞鱼 `caution` |
| 3 | 慢病 + 对应禁忌关键词（痛风=嘌呤、高血压/肾病=钠、糖尿病=糖） | `caution` |
| 4 | 目标（减脂=高油、控糖=高糖） | `caution`；增肌只作正向提示 |
| 5 | 忌口（素食、清真） | `forbidden` |

**这条链路不调模型**：22ms 出结果，可解释、可复现、可写测试。模型只负责「看懂菜单」，不负责「下健康结论」——这是刻意的分工，答辩时要讲。

## 5. 错误码

| 状态码 | 含义 | 前端应做什么 |
|---|---|---|
| 400 | 参数缺失 / 轮次超限 / 菜品超过 20 道 | 提示检查输入 |
| 413 | 图片过大 | 提示重新选图（正常情况下压过不会出现） |
| 500 | 服务端未配置 Key | 提示联系管理员，不要暴露细节 |
| 502 | 所有模型均调用失败 | 提示「识别服务暂时不可用，请重试」，并把 `statusMessage` 打到控制台 |
| 504 | 上游超时 | 同上 |

`502` 的 `statusMessage` 里会带**最后一次失败的原始错误**（如「模型不存在」「余额不足」），排障时直接看它。

## 6. 前端对接约定

1. 不要硬编码模型名，一切走接口返回。
2. `allergens` 非空时**必须红色展示**，不允许弱化。
3. `confidence < 0.5` 时展示「识别可能有误，请核对食材」。
4. 识图有 10 秒左右延迟，**必须做 loading 态**，否则用户以为卡死。
5. `level === 'forbidden'` 的菜品卡片必须有明显视觉区分（红框/红标），不能只靠文字。

## 7. `GET /api/city/list` —— 城市清单

返回 `{ total, dishTotal, areas[], cities[] }`，每个 city 含 `id / name / area / region / intro / dishCount`。
数据源是 C 交付的 30 城，构建期打进包里，无运行时文件依赖。

## 8. `POST /api/city/dishes` —— 某城市特色菜 + 健康标记

**入参**

```json
{ "cityId": "chengdu", "profile": { "allergens": ["甲壳类"], "conditions": ["痛风"], "goal": "none" } }
```

`cityId` 接受城市 id 或中文名。`profile` 可省略——省略时只返回菜品，不带评估。

**出参**

```json
{
  "city": { "id": "chengdu", "name": "成都", "area": "西南", "dishCount": 9 },
  "dishes": [ /* Dish[]，source = "library" */ ],
  "assessments": [ /* 同 /api/dish/assess，未传 profile 时为 null */ ],
  "summary": { "total": 9, "safe": 6, "caution": 3, "forbidden": 0 }
}
```

这是 M3 的核心：用户不用拍照、不用提问，选个城市就能看到「哪几道本地菜我不能吃」。

## 9. 用户数据（收藏 / 历史）

| 接口 | 说明 |
|---|---|
| `GET /api/user/data?deviceId=` | 返回 `{ favorites, history, counts }` |
| `POST /api/user/favorite` | body `{ deviceId, dish, action: 'add' \| 'remove' }` |
| `POST /api/user/history` | body `{ deviceId, source, title, dishes, summary }` |

**身份**：`deviceId`（前端 localStorage 生成，36 位）。这是临时替代账号的方案，接真实登录后换成 userId，接口签名不变。

**存储**：`data/user-data.json`，原子写（先写 .tmp 再 rename）。不上 SQLite 的原因：better-sqlite3 是原生模块，在没装 VS Build Tools 的机器上编译会失败，而项目只有 8 天。

**上限**：收藏 200 条、历史 50 条，超出丢最旧的。

**写入时机**：识图成功自动记一条；每次查看城市特色菜记一条；收藏由用户手动点。

## 10. 档案（profile）

| 接口 | 说明 |
|---|---|
| `PUT /api/profile` | body `{ deviceId, profile }`，服务端做范围校验后落盘 |
| `GET /api/profile?deviceId=` | 返回 `{ profile, complete }`；没填过 `profile: null` |

校验规则：年龄 1–120、身高 80–250、体重 20–300，枚举非法值回落默认，数组去重。
档案与收藏/历史存在同一个 `data/user-data.json` 里。

## 11. 菜品详情（dishes）

`GET /api/dishes/:id?deviceId=`

返回 `{ dish, language, recipe, assessment, available }`：

- `language`：C 的 250 条语言视角（这是什么 / 怎么点 / 文化）
- `recipe`：C 的 25 道复刻菜谱（备料、步骤、过敏替代、要点）
- `assessment`：传了 deviceId 且该设备有档案时，附带三色判定
- `available`：前端据此禁用没有内容的 tab

## 12. 点菜组合（plan）

`POST /api/plan`，body `{ deviceId, dishes, people, budget, profile? }`

策略：

1. `forbidden` 的菜直接剔除，不参与配菜（硬约束）
2. 其余按「风险等级 → 价格」排序
3. 同一做法最多 2 道，保证多样性
4. 超预算就停，并在 `notes` 里说明

出参含 `plan[] / total / excluded[] / notes[] / summary`。

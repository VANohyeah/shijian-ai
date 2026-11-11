# 食鉴 · 看得懂菜单，也看得懂你的 AI 美食助手

> 2026 第九届传智杯全国大学生数智创新与 AI 应用大赛 · AI WEB 网页开发挑战赛（省赛）
> 提交截止：2026-11-18

---

## 一句话

**注册时填一次身体数据，之后无论拍菜单还是选城市，它都告诉你「这道菜我能不能吃、为什么」。**

点评类平台解决「去哪吃」，不解决「我能不能吃」。过敏、慢病、孕期、减脂人群在外就餐时，缺的不是推荐，是**判断依据**。

---

## 它能做什么

| 场景 | 用户动作 | 系统产出 |
|---|---|---|
| **拍菜单** | 拍一张菜单或外卖截图 | 识别菜品 → 按档案标「可以吃 / 注意 / 别点」→ 给出理由与依据 |
| **找地方菜** | 选一个城市 | 30 城 250 道特色菜，每道直接带三色判定，不用拍照也不用提问 |
| **看门道** | 点进任意菜品 | 语言视角（这是什么、怎么点）＋ 复刻视角（在家怎么做、过敏怎么换料） |
| **配一桌** | 填人数和预算 | 自动剔除你不能吃的，配一桌带总价的组合 |
| **我的** | — | 收藏、历史记录、身体档案 |

---

## 快速开始

```bash
npm install

cp .env.example .env        # Windows: copy .env.example .env
# 编辑 .env，填入 GLM_API_KEY（智谱开放平台获取）

npm run dev
```

打开 <http://localhost:3000>。

自检：

```bash
# 服务与模型配置是否就绪
curl http://localhost:3000/api/health
# 或 Windows PowerShell
.\scripts\verify.ps1 -Base http://localhost:3000
```

`ready: true` 表示模型已配置、可以正常识别。

> 国内网络建议先换源：`npm config set registry https://registry.npmmirror.com`

---

## 环境变量

两家供应商任选其一，填了哪家就走哪家；都填时默认优先智谱 GLM。

| 变量 | 必填 | 说明 |
|---|---|---|
| `GLM_API_KEY` | 二选一 | 智谱 API Key（形如 `xxx.xxx` 两段），**不得提交到仓库** |
| `GLM_BASE_URL` | 否 | 默认 `https://open.bigmodel.cn/api/paas/v4` |
| `GLM_TEXT_MODELS` | 否 | 文本模型候选，逗号分隔按序尝试，默认 `glm-4-flash,glm-5.3-flash` |
| `GLM_VISION_MODELS` | 否 | 视觉模型候选，默认 `glm-4v-plus-0111,glm-4v-flash,glm-5.3-flash` |
| `DEEPSEEK_API_KEY` | 二选一 | DeepSeek Key（`sk-` 开头），备用供应商，同样支持视觉 |
| `AI_PROVIDER` | 否 | 强制指定 `glm` / `deepseek`，留空自动选择 |

---

## 技术架构

```
浏览器（Nuxt 3 / Vue 3 / TypeScript）
  ├─ /                  首页：两个入口 + 最近记录
  ├─ /scan              拍菜单：压缩 → 识别 → 评估 → 落历史
  ├─ /cities            30 城列表（按赛区分组）
  ├─ /city/[id]         城市菜 + 三色判定 + 配一桌
  ├─ /dish/[id]         菜品详情：语言视角 / 复刻视角
  ├─ /profile           身体档案
  └─ /favorites         收藏与历史
        │
        ▼  Nuxt server routes（Nitro，仅作 AI 接入层）
  ├─ 供应商解析：GLM / DeepSeek，模型与图片格式三层降级
  ├─ 规则引擎：纯函数，无模型参与（可解释、可测试、22ms）
  └─ 知识检索：52 条知识，关键词 + 类别加权
        │
        ▼
  智谱 GLM（视觉 + 文本）· Key 只在服务端
```

**关键分层**：模型只负责「看懂菜单」，健康结论由规则引擎给出。这样结论可复现、可解释、可写测试——让大模型直接下健康结论，出错了无法追溯。

---

## 目录结构

```
czb比赛/
├─ app.vue / nuxt.config.ts / .env.example
├─ assets/css/main.css          全局样式
├─ components/                  AppHeader · DishCard · VerdictBadge · ProfileForm
├─ composables/useProfile.ts    deviceId + 档案读写
├─ pages/                       7 个页面（见上）
├─ server/
│  ├─ api/                      scan · evaluate · plan · profile · cities · dishes · user · chat · health
│  └─ utils/                    ai · rules · retrieve · catalog · content · store
├─ seed/                        城市 / 菜品 / 知识 / 语言 / 菜谱数据
├─ shared/types.ts              前后端共用类型（唯一真源）
├─ docs/                        开发文档 · 接口契约 · 决策记录
└─ data/                        收藏与历史（运行时生成，已 gitignore）
```

---

## 数据规模

由数据同学（C 角色）交付，经规则校验与 20% 人工抽检：

| 内容 | 规模 |
|---|---|
| 地域特色菜 | 250 道 / 30 城 |
| 菜品语言视角 | 250 条 |
| 复刻菜谱 | 25 道（含 75 条过敏替代方案） |
| 禁忌知识 | 52 条（带标准出处） |
| 过敏原大类 | 12 类（GB 7718-2011 八大类 + 项目扩展 4 类） |

---

## 设计取舍

| 取舍 | 决定 | 理由 |
|---|---|---|
| 检索 | 不引入向量库 | DeepSeek 无 embedding 接口；52 条语料用关键词 + 类别加权已够准，多养一个服务是负债 |
| 检索 | 不用 SQLite FTS5 | 同规模下内存线性扫描是微秒级，建表反而多一层部署依赖 |
| 存储 | JSON 文件而非 SQLite | `better-sqlite3` 是原生模块，无编译环境的机器装不上；单实例演示足够，换库只需改一层 |
| 身份 | deviceId 代替账号 | 省赛不做注册登录，接口签名保持 userId 语义，日后替换不改调用方 |
| 视觉模型 | `glm-4v-plus` 而非 `flash` | 实测：flash 会把「至尊系列 9寸普通庄」当菜名，plus 才能正确抽出 8 个口味。准确率优先于速度 |

详细决策过程见 [`docs/decisions-food-app.md`](docs/decisions-food-app.md)。

---

## 接口一览

完整契约见 [`docs/api.md`](docs/api.md)。

| 接口 | 用途 |
|---|---|
| `POST /api/scan` | 菜单图片 → 菜品列表 |
| `POST /api/evaluate` | 菜品 × 档案 → 三色判定 + 依据 |
| `GET /api/cities` | 城市清单 |
| `POST /api/cities/:id/dishes` | 某城菜品 + 判定 |
| `GET /api/dishes/:id` | 菜品详情（语言 / 复刻视角） |
| `POST /api/plan` | 人数 + 预算 → 配一桌 |
| `PUT /api/profile` · `GET /api/profile` | 身体档案读写 |
| `GET /api/user/data` · `POST /api/user/favorite` · `POST /api/user/history` | 收藏与历史 |
| `POST /api/chat` | 流式对话（SSE） |
| `GET /api/health` | 配置自检 |

---

## 已知限制

- **没有账号体系**：数据跟着设备走，换设备看不到收藏（省赛范围决定）
- **识图 10 秒左右**：视觉模型较大，偶尔更久；页面已做 loading 态
- **认不出冷门菜**：模型给出低置信度时会提示用户核对食材
- **不构成医疗建议**：只做禁忌提示，不做诊断

---

## 团队分工

| 角色 | 负责 |
|---|---|
| A | AI 与后端：模型接入、识图、规则引擎、检索、接口 |
| B | 前端页面与交互（本版由 A 代做） |
| C | 数据与交付：地域菜库、禁忌库、文案、技术文档、视频脚本 |

---

## 开发纪律

- **每天有 commit**：比赛要求「保留完整 Git 历史，体现真实开发过程」
- **改接口当天改 `docs/api.md`**：前端靠契约对接，不靠口头同步
- **卡超过 4 小时就同步**：不独自硬扛

---

## License

本项目为竞赛作品，未获授权前请勿商用。

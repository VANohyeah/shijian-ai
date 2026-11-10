# 食鉴 AI —— 看得懂菜单，也看得懂你的 AI 美食助手

> 2026 第九届传智杯 · AI WEB 网页开发挑战赛参赛作品
> 本仓库当前处于开发期（Day 1），界面为自测页，最终 UI 由前端同学重做。

## 项目简介

用户注册时填写一次身体数据（身高体重、过敏原、慢病、饮食目标），之后无论**拍菜单**还是**选城市**，系统都会告诉他「这道菜我能不能吃、为什么」。

解决的是点评类平台没解决的问题：它们告诉你「去哪吃」，不告诉你「你能不能吃」。

## 技术架构

- **前端**：Nuxt 3 + Vue 3 + TypeScript
- **后端**：Nuxt server routes（Nitro），仅作 AI 能力接入层
- **模型**：DeepSeek `deepseek-flash`（OpenAI 兼容，支持视觉与工具调用）
- **检索**：SQLite + FTS5 全文检索（不引入向量库，属有意取舍）
- **数据**：地域菜品库、禁忌知识库，与拍照识别结果共用同一 `Dish` 结构

```
浏览器（Nuxt/Vue）
   ├─ /api/chat          流式对话代理（SSE）
   └─ /api/dish/analyze  菜单图片 → 菜品 JSON
              │
              ▼
        DeepSeek API（Key 只在服务端）
```

## 快速开始

```bash
npm install

cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY

npm run dev
```

打开 <http://localhost:3000>：

- 「① 流式对话」能逐字输出 → 说明 Key 与 SSE 链路正常
- 「② 菜单识别」上传一张菜单照片 → 返回结构化 JSON → 说明视觉链路正常

健康检查：<http://localhost:3000/api/health>，返回 `ready: true` 即配置正确。

> 国内网络建议先换源：`npm config set registry https://registry.npmmirror.com`

## 环境变量

两家供应商任选其一，填了哪家就走哪家；两家都填时默认优先 GLM。

| 变量 | 必填 | 说明 |
|---|---|---|
| `GLM_API_KEY` | 二选一 | 智谱 API Key（形如 `xxx.xxx` 两段），**不得提交到仓库** |
| `GLM_BASE_URL` | 否 | 默认 `https://open.bigmodel.cn/api/paas/v4` |
| `GLM_TEXT_MODELS` | 否 | 文本模型候选，逗号分隔，按序尝试。默认 `glm-4-flash,glm-5.3-flash` |
| `GLM_VISION_MODELS` | 否 | 视觉模型候选。默认 `glm-4v-flash,glm-4v-plus-0111,glm-5.3-flash` |
| `DEEPSEEK_API_KEY` | 二选一 | DeepSeek Key（`sk-` 开头），备用供应商 |
| `DEEPSEEK_BASE_URL` | 否 | 默认 `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 否 | 默认 `deepseek-flash`（同样支持视觉） |
| `AI_PROVIDER` | 否 | 强制指定 `glm` / `deepseek`，留空自动 |

**实测记录（2026-11-09）**

| 模型 | 结果 | 说明 |
|---|---|---|
| `glm-4v-plus-0111` | ✅ 识图约 10s，8 道全对 | **当前首选**：能读懂「系列标题 → 口味」的层级 |
| `glm-4v-flash` | ⚠️ 识图约 6–10s | 快但会把分类标题当菜名，仅作降级备选 |
| `glm-4-flash` | ✅ 对话 0.8–1.1s | 指令跟随正常，作为默认文本模型 |
| `glm-5.3-flash` | ✅ 3s | 更强但慢，作为候选 |
| `glm-4.6-flash` | ❌ 403 | 本账号未开通，已从候选移除 |

> 视觉模型取舍：**准确率优先于速度**。分类式菜单（如比萨菜单）用 flash 会把「至尊系列 9寸普通庄」当成菜名，plus 才能正确抽出 8 个口味。
> 客户端已做压缩（长边 1280px、JPEG 0.85），手机原图上传耗时可降一半。

## 目录结构

```
├─ pages/                   页面
│  └─ index.vue             开发自测页（临时）
├─ server/
│  └─ api/
│     ├─ chat.post.ts       流式对话代理
│     ├─ dish/analyze.post.ts  菜单图片 → 菜品 JSON
│     └─ health.get.ts      健康检查
├─ shared/
│  └─ types/dish.ts         菜品对象 / 用户档案 / 评估结果（项目地基）
└─ docs/                    技术文档与决策记录（后续补充）
```

## 数据模型约定

菜品对象 `Dish` 是拍照识别与地域菜品库的公共契约，**字段变更必须全员同步**，否则前端渲染与 250 道地域菜库都要返工。

关键约束：

- `allergens` 只允许八大类：海鲜 / 花生 / 坚果 / 乳制品 / 麸质 / 蛋 / 大豆 / 鱼
- 无法确定的字段一律 `null` 或空数组，**禁止编造**
- `confidence` 低于 0.5 时前端必须提示用户核对食材

## 安全与合规

- **不构成医疗建议**：本产品只做禁忌提示，不做疾病诊断
- API Key 仅存在于服务端环境变量，前端与仓库均不可见
- 过敏命中一律红色告警，不允许降级
- 无检索依据时明确回答「不确定，建议询问店员」，禁止生成推测性结论

## 团队

| 角色 | 负责 |
|---|---|
| A | AI 与后端：模型接入、菜品识别、健康规则 |
| B | 前端：档案、首页、菜品卡、三视角 |
| C | 数据与交付：地域菜库、禁忌库、文档、视频 |

## 开发纪律

- 每天必须有 commit（赛项要求保留真实开发过程）
- 卡超过 4 小时立即同步，不独自硬扛
- 砍功能优先于交半成品，砍的顺序见 `docs/decisions-chuanzhi-cup-aiweb.md`

## License

本项目为竞赛作品，未授权前请勿商用。AGPL / MIT 待定稿后确定。

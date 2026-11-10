# AGENTS.md

> 给 AI 编码助手的项目约定。开工前先读完这一页，用到细节再翻 `docs/`。
> 最近更新：2026-11-09

---

## 0. 一句话

**食鉴**：填一次身体档案（过敏 / 慢病 / 孕期 / 减脂目标），之后拍菜单或选城市，判断「这道菜我能不能吃、为什么」。

用户是三个人（A 后端、B 前端、C 数据），不是一个人。你的改动不能踩到别人的目录。

---

## 1. 值日生守则（主人 2026-10-31 立 · **优先级最高，高于本文件其他所有条目**）

1. **动手之前，先读决策记录。**
   没读 `docs/decisions-food-app.md` 就开始写代码，等于闭眼开车。

2. **每完成一个小功能，先让主人确认，再用 Git 存档。**
   不准一口气写五个功能再上来说「都好了」。一个能点的东西 → 主人确认 → commit → 下一件。

3. **只测用户感受得到的行为。**
   页面能打开吗、按钮点下去有反应吗、报错文案人看得懂吗。用户看不见的东西，不测。

4. **不准自己考自己。**
   不写「验证我的代码对不对」那类自测脚本，不跑自己构造的单元测试来给自己发合格证。

5. **不准死抠细节。**
   差 1px、命名纠结、多抽一层函数——一律放过。10 天工期，能跑比好看重要。

6. **修 bug 别顺手堆测试。**
   哪坏修哪，改完手工点一遍。不新增测试框架，不补测试文件。

> 这六条和 §7 的「铁律」冲突时，**守则赢**。铁律是技术底线，守则是干活方式。

---

## 2. 权威顺序

有冲突时按这个顺序，上面的赢：

1. `docs/decisions-food-app.md` —— 已拍板的决策，**不许自作主张改**
2. `docs/开发文档.md` 和 `docs/api.md` —— 技术真源（类型 / 接口 / 目录 / 排期）
3. 本文件 —— 行为约束
4. 代码注释、README —— 最低

拿不准的时候去查，**不要猜**。

---

## 3. 项目状态（2026-11-09）

| 项 | 状态 |
|---|---|
| 方案与决策 | ✅ 定稿（方案 A：Nuxt 3 + SQLite） |
| 开发文档 | ✅ v1.0 |
| 编码守则 | ✅ 本文件 |
| 代码仓库 | ⬜ 未初始化，从 `npm create nuxt` 开始 |
| 赛项截止 | **2026-11-18** |

---

## 4. 技术栈（锁定，不许换）

| 层 | 选型 |
|---|---|
| 框架 | Nuxt 3（`ssr: false`，纯前端 SPA + Nitro 接口） |
| 语言 | TypeScript，`strict: true` |
| 数据库 | SQLite（`data/app.db`）+ Drizzle ORM + better-sqlite3 |
| 样式 | Tailwind CSS 4（`@tailwindcss/vite` 插件） |
| 校验 | Zod |
| 模型 | 智谱 `glm-5.3-flash`，OpenAI 兼容端点 `https://open.bigmodel.cn/api/paas/v4` |
| SDK | `openai`（改 baseURL 指向智谱） |
| 密码 | `bcryptjs`（cost 10，纯 JS） |
| 认证 | HMAC 签名 cookie（`HttpOnly`、`SameSite=Lax`），不引第三方 session 库 |
| 图标 | `lucide-vue-next` |
| MCP | `@modelcontextprotocol/sdk`，stdio server |

**不装**：Pinia（用 `useState`）、Element Plus / Naive UI（组件自己写）、向量数据库、Redis、Prisma（better-sqlite3 起不来时才考虑）。

---

## 5. 命令

```bash
npm i                       # 装依赖
npm run dev                 # 起在 http://localhost:3000，host 0.0.0.0
npx nuxi typecheck          # 类型检查，提交前必须过
node scripts/validate-seed.mjs   # 校验种子数据
```

**不引测试框架**（见守则第 4、6 条）。质量靠类型检查 + 手工验收。

---

## 6. 目录边界

改了不属于你的目录 = 制造冲突。

| 目录 | 归属 | 说明 |
|---|---|---|
| `server/` `mcp/` `scripts/gen-dishes.mjs` | **A** | 接口、规则引擎、检索、模型调用 |
| `pages/` `components/` `assets/` `app.vue` | **B** | 页面与组件，全部 Tailwind |
| `seed/` `docs/` `scripts/validate-seed.mjs` | **C** | 菜品库、知识库、文档、交付物 |
| `shared/types.ts` | 公共 | 改之前先在群里说一声 |

---

## 7. 铁律

1. **判定归代码，不归模型。**
   `server/utils/rules.ts` 的 `evaluateRules(dish, profile)` 是**纯函数**，不读数据库、不调网络。
   过敏交集一命中就是 `avoid`，任何情况下不许降级。模型只负责写人话解释。
   这条是评分项「AI 安全 4%」的立身之本，改它就是给项目扣分。

2. **枚举只用英文。**
   `allergens` / `tags` / `level` 的值只能是 `shared/types.ts` 里定义的英文常量。
   中文只出现在 `LABELS` 映射表和 UI 文案里。逻辑里出现中文比较 → 打回。

3. **类型只写一份。**
   全部放在 `shared/types.ts`，前后端都 `import type`。禁止在页面或接口里另抄一份。

4. **密钥永不进 Git。**
   `.env` 在 `.gitignore` 里；`.env.example` 只有空值。代码里读 `process.env.ZHIPU_API_KEY`，不许有默认值兜底。

5. **不编造。**
   知识条目必须有 `source`；模型没把握就输出 `caution` + 「建议询问店员」。任何菜品都不许出现「治疗 / 预防疾病」这类表述。

6. **改接口先改文档。**
   动 `server/api/**` 的同一天必须改 `docs/api.md`，B 只认那份。

7. **250 道菜全量校验。**
   不许只抽 50 条就交差。校验脚本 + 人工过一遍。

8. **每天有 commit。**
   完整 Git 历史是评分项，不是形式。

---

## 8. 已知坑（已踩过，别重复踩）

| 坑 | 现象 | 处理 |
|---|---|---|
| better-sqlite3 原生模块 | Nitro 报 `Cannot find module 'better-sqlite3'` | `nuxt.config.ts` 加 `nitro.externals.external: ['better-sqlite3']` |
| OneDrive 锁 db | `SQLITE_BUSY`、`.db-wal` 同步冲突 | 暂停该目录同步，或把 `data/` 移出 OneDrive |
| 智谱 `thinking` 关不掉 | 单次调用 5–15 秒，看着像卡死 | 前端必须给进度提示 + 禁用按钮防重复提交 |
| 图片 base64 过大 | 413 / 请求超时 | 前端压到长边 1600px、quality 0.8，控制在 4MB 内 |
| 模型返回 ```json | `JSON.parse` 抛错 | 先剥 code fence，失败重试 1 次，再失败返回手动输入 |
| 中文分词 | FTS5 查不到「痛风」「嘌呤」 | 不用 FTS5，用关键词 Map + 同义词 |
| 手机打不开 | 局域网 IP 访问失败 | `host: '0.0.0.0'` + Windows 防火墙放行 3000 |
| Tailwind 4 不生效 | 样式全丢 | 用 `@tailwindcss/vite` 插件 + `@import "tailwindcss"` |

---

## 9. 不要做的事

- ❌ 不要为了「更优雅」换框架、换 ORM、换数据库
- ❌ 不要引 FTS5、向量库、embedding 服务
- ❌ 不要在 `pages/` 里直接调模型或读数据库，一律走 `server/api/`
- ❌ 不要给 8 个页面之外的页面（评分看的是深度不是数量）
- ❌ 不要写「本产品可以治疗/预防 XX」
- ❌ 不要把 `trace` 删掉，那是给评委看的调用链
- ❌ 不要在第 7 天之后加新功能（11/15 冻需求）
- ❌ 不要自己造测试来证明自己干得好（守则 4）

---

## 10. 提交规约

```
feat(scan): 接入 glm-5.3-flash 图片识别
fix(rules): 孕期误判成 caution
data(seed): 补齐成都 10 道菜
docs(api): 新增 /api/plan
chore: 升级依赖
```

分支：`main`（只接受合并）+ `feat/a-*` / `feat/b-*` / `feat/c-*`。

**commit 时机**：一个功能让主人确认过之后立刻存，别攒着（守则 2）。

---

## 11. 文档索引

| 文件 | 内容 |
|---|---|
| [docs/开发文档.md](docs/开发文档.md) | 环境、类型、接口、规则引擎、分工、排期、验收 |
| [docs/decisions-food-app.md](docs/decisions-food-app.md) | 已定决策与理由、剩余待定 |
| `docs/api.md` | 接口契约（A 维护，随改随更） |
| `docs/测试用例.md` | 15 个验收场景（C 维护；是手工验收清单，不是自动化测试） |
| `README.md` | 对外门面：介绍、架构、跑起来、团队、声明 |

---

## 12. 动手前的自检

1. 守则读了吗？决策记录读了吗？
2. 这件事在 `docs/开发文档.md` 里有出处吗？没有就问，别自己发明。
3. 我改的目录是我的吗？
4. 类型放进 `shared/types.ts` 了吗？
5. 有没有把中文枚举写进判断逻辑？
6. 密钥有没有溜进代码？
7. `npx nuxi typecheck` 过了吗？
8. 这个小功能是不是该先给主人看一眼再继续？

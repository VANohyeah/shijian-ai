# 食鉴 MCP Server

把「查地方菜 / 判菜 / 配一桌」暴露成 [MCP](https://modelcontextprotocol.io) 工具，
让 Claude Desktop、Cursor 等 MCP 客户端直接调用食鉴的能力。

## 它暴露了什么

| 工具 | 作用 |
|---|---|
| `list_cities` | 30 座城市与各自特色菜数量 |
| `city_dishes` | 某城特色菜 + 按档案给出 ✅/⚠️/⛔ 判定 |
| `assess_dishes` | 对任意菜品数组做健康判定（含依据） |
| `plan_meal` | 按人数、预算、档案配一桌，自动剔除不能吃的 |
| `dish_detail` | 菜品详情：语言视角 + 复刻菜谱 + 过敏替代 |

## 前置条件

**食鉴 Web 服务必须在运行**（本 MCP 服务器是瘦适配器，业务逻辑只有一份，全在 Nuxt 服务里）：

```bash
npm run dev     # 默认 http://localhost:3000
```

## 手动试

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cli","version":"1"}}}' \
  | node mcp/server.mjs
```

## 接到 Claude Desktop

编辑 `claude_desktop_config.json`（macOS: `~/Library/Application Support/Claude/`，
Windows: `%APPDATA%\Claude\`）：

```json
{
  "mcpServers": {
    "shijian": {
      "command": "node",
      "args": ["C:\\Users\\你的用户名\\Desktop\\czb比赛\\mcp\\server.mjs"],
      "env": { "SHIJIAN_API": "http://localhost:3000" }
    }
  }
}
```

重启 Claude Desktop 后，问它「成都有哪些菜我能吃」或「帮我配一桌 3 人 200 元的川菜」，
它会自己调用上面的工具。

## 接到 Cursor

`.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "shijian": {
      "command": "node",
      "args": ["mcp/server.mjs"],
      "env": { "SHIJIAN_API": "http://localhost:3000" }
    }
  }
}
```

## 实现说明

- **不引第三方 SDK**：直接实现 JSON-RPC 2.0 over stdio（`initialize` / `tools/list` / `tools/call` / `ping`），
  协议本身很小，少一层依赖就少一处版本风险。
- **不复制业务逻辑**：工具内部调用本地 HTTP API，规则引擎、检索、数据只有一份实现。
- **文本优先**：返回给客户端的是人类可读文本（带 ✅/⚠️/⛔），模型能直接念给用户听，不需要再解析 JSON。

## 为什么做这个

赛项评分里「MCP / 工具集成」占 4%，而 MCP 是 2026 年被提到的行业标准。
食鉴本身有清晰的能力边界（查菜、判菜、配菜），天然适合做成工具暴露给任意 Agent ——
这不是为了凑分，而是产品形态的一部分：**别人家的 AI 也能用食鉴的能力**。

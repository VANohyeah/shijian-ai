#!/usr/bin/env node
/**
 * 食鉴 MCP Server —— 把「查菜、判菜、配一桌」暴露成 MCP 工具，
 * 让 Claude Desktop / Cursor / 任何 MCP 客户端直接调用。
 *
 * 设计取舍：
 *   - 不引第三方 SDK（@modelcontextprotocol/sdk 会多一层依赖与版本风险），
 *     直接实现 JSON-RPC 2.0 over stdio，协议本身很小。
 *   - 不复制业务逻辑：本进程是「瘦适配器」，所有判断都委托给本地运行的
 *     Nuxt 服务（默认 http://localhost:3000）。这样规则只有一份。
 *
 * 启动：node mcp/server.mjs
 * 依赖：食鉴 Web 服务需在运行（npm run dev）
 */
import { createInterface } from 'node:readline'

const API = process.env.SHIJIAN_API || 'http://localhost:3000'

const PROTOCOL_VERSION = '2024-11-05'
const SERVER_INFO = { name: 'shijian-food-guard', version: '1.0.0' }

/* ----------------------------- 工具定义 ----------------------------- */

const TOOLS = [
  {
    name: 'list_cities',
    description: '列出食鉴收录的城市（30 座）与每座城市的特色菜数量。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'city_dishes',
    description: '查询某座城市的特色菜，并按用户档案给出「可以吃 / 注意 / 别点」判定。',
    inputSchema: {
      type: 'object',
      properties: {
        cityId: { type: 'string', description: '城市 id 或中文名，如 chengdu 或 成都' },
        allergens: {
          type: 'array',
          items: { type: 'string' },
          description: '过敏原，取值：含麸质谷物/甲壳类/鱼类/蛋类/花生/大豆/乳制品/坚果/贝类·软体/芝麻/酒精/亚硫酸盐'
        },
        conditions: {
          type: 'array',
          items: { type: 'string' },
          description: '身体状况：痛风/高血压/糖尿病/肾病/孕期'
        },
        goal: {
          type: 'string',
          enum: ['none', 'fat_loss', 'muscle_gain', 'sugar_control'],
          description: '饮食目标'
        }
      },
      required: ['cityId'],
      additionalProperties: false
    }
  },
  {
    name: 'assess_dishes',
    description: '对一组菜品做健康判定。菜品需含 id/name/ingredients/allergens 等字段，可来自菜单识别结果。',
    inputSchema: {
      type: 'object',
      properties: {
        dishes: {
          type: 'array',
          description: '菜品数组，字段与 /api/scan 返回一致',
          items: { type: 'object' }
        },
        allergens: { type: 'array', items: { type: 'string' } },
        conditions: { type: 'array', items: { type: 'string' } },
        goal: { type: 'string', enum: ['none', 'fat_loss', 'muscle_gain', 'sugar_control'] }
      },
      required: ['dishes'],
      additionalProperties: false
    }
  },
  {
    name: 'plan_meal',
    description: '按人数、预算和档案约束，从给定菜品里配一桌菜（自动剔除不能吃的）。',
    inputSchema: {
      type: 'object',
      properties: {
        dishes: { type: 'array', items: { type: 'object' } },
        people: { type: 'number', minimum: 1, maximum: 10 },
        budget: { type: 'number', minimum: 0 },
        allergens: { type: 'array', items: { type: 'string' } },
        conditions: { type: 'array', items: { type: 'string' } },
        goal: { type: 'string', enum: ['none', 'fat_loss', 'muscle_gain', 'sugar_control'] }
      },
      required: ['dishes'],
      additionalProperties: false
    }
  },
  {
    name: 'dish_detail',
    description: '查一道菜的详情：语言视角（这是什么、怎么点）与复刻视角（怎么做、过敏怎么换料）。',
    inputSchema: {
      type: 'object',
      properties: { dishId: { type: 'string', description: '菜品 id，如 dish_chengdu_01' } },
      required: ['dishId'],
      additionalProperties: false
    }
  }
]

/* ----------------------------- HTTP 调用 ----------------------------- */

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`API ${path} ${res.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

async function get(path) {
  const res = await fetch(`${API}${path}`)
  const text = await res.text()
  if (!res.ok) throw new Error(`API ${path} ${res.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

function profileOf(args = {}) {
  return {
    allergens: Array.isArray(args.allergens) ? args.allergens : [],
    conditions: Array.isArray(args.conditions) ? args.conditions : [],
    goal: args.goal ?? 'none'
  }
}

/** 返回给 MCP 客户端的文本：人类可读为主，附原始 JSON 便于模型二次处理 */
async function callTool(name, args) {
  switch (name) {
    case 'list_cities': {
      const data = await get('/api/cities')
      const lines = data.cities.map((c) => `${c.name}（${c.area} · ${c.region}）${c.dishCount} 道`)
      return `食鉴收录 ${data.total} 座城市、${data.dishTotal} 道地方菜：\n${lines.join('\n')}`
    }

    case 'city_dishes': {
      const data = await post(`/api/cities/${encodeURIComponent(args.cityId)}/dishes`, {
        profile: profileOf(args)
      })
      const rows = data.dishes.map((d, i) => {
        const a = data.assessments?.[i]
        const mark = a ? { safe: '✅', caution: '⚠️', forbidden: '⛔' }[a.level] : '·'
        const why = a?.reasons?.length ? `（${a.reasons.join('；')}）` : ''
        return `${mark} ${d.name} ¥${d.reference_price ?? '-'}${why}`
      })
      const s = data.summary
      const head = s
        ? `${data.city.name}：共 ${s.total} 道，可吃 ${s.safe} · 注意 ${s.caution} · 别点 ${s.forbidden}`
        : `${data.city.name}：共 ${data.dishes.length} 道`
      return `${head}\n${rows.join('\n')}`
    }

    case 'assess_dishes': {
      const data = await post('/api/evaluate', {
        dishes: args.dishes,
        profile: profileOf(args)
      })
      const rows = data.assessments.map((a) => {
        const mark = { safe: '✅', caution: '⚠️', forbidden: '⛔' }[a.level]
        return `${mark} ${a.dish_id}：${a.reasons.join('；') || '无风险'}｜依据：${a.citations.join('；')}`
      })
      const s = data.summary
      return `判定 ${s.total} 道：可吃 ${s.safe} · 注意 ${s.caution} · 别点 ${s.forbidden}\n${rows.join('\n')}`
    }

    case 'plan_meal': {
      const data = await post('/api/plan', {
        dishes: args.dishes,
        people: args.people ?? 2,
        budget: args.budget ?? null,
        profile: profileOf(args)
      })
      const rows = data.plan.map((p) => `· ${p.dish.name} ¥${p.dish.reference_price ?? '-'} [${p.assessment.level}]`)
      const excluded = data.excluded.length
        ? `\n已剔除 ${data.excluded.length} 道（命中过敏或忌口）`
        : ''
      return `配了 ${data.count} 道，合计 ¥${data.total}\n${rows.join('\n')}${excluded}`
    }

    case 'dish_detail': {
      const data = await get(`/api/dishes/${encodeURIComponent(args.dishId)}`)
      const parts = [`${data.dish.name}（${data.dish.region}）`]
      if (data.language) {
        parts.push(`这是什么：${data.language.what_it_is}`, `怎么点：${data.language.how_to_order}`)
      }
      if (data.recipe) {
        parts.push(`家常做法（${data.recipe.difficulty} · ${data.recipe.time_min} 分钟）：`)
        parts.push(data.recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
        if (data.recipe.substitutions?.length) {
          parts.push(
            '过敏替代：' +
              data.recipe.substitutions.map((s) => `${s.from}→${s.to}（${s.for}）`).join('；')
          )
        }
      }
      return parts.join('\n')
    }

    default:
      throw new Error(`未知工具：${name}`)
  }
}

/* ----------------------------- JSON-RPC 主循环 ----------------------------- */

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

function ok(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function fail(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

async function handle(msg) {
  const { id, method, params } = msg
  const isNotification = id === undefined || id === null

  try {
    switch (method) {
      case 'initialize':
        ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO
        })
        return

      case 'notifications/initialized':
      case 'initialized':
        return

      case 'tools/list':
        ok(id, { tools: TOOLS })
        return

      case 'tools/call': {
        const name = params?.name
        const args = params?.arguments ?? {}
        const text = await callTool(name, args)
        ok(id, { content: [{ type: 'text', text }] })
        return
      }

      case 'ping':
        ok(id, {})
        return

      default:
        if (!isNotification) fail(id, -32601, `Method not found: ${method}`)
    }
  } catch (err) {
    if (!isNotification) fail(id, -32603, String(err?.message ?? err))
  }
}

const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  try {
    handle(JSON.parse(trimmed))
  } catch {
    fail(null, -32700, 'Parse error')
  }
})

process.stderr.write(`[食鉴 MCP] ready · API=${API}\n`)

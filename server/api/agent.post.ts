/**
 * Agent 接口：模型 + 工具 + 循环。
 *
 * 与 /api/evaluate 的区别：
 *   evaluate 是「写死流程」——代码决定先读档案、再判定；
 *   agent 是「模型决定下一步」——它自己决定调哪个工具、调几次、什么时候收口。
 *   评分表里「Agent / 工作流 8%」看的就是后者。
 *
 * 关键实现点（容易写错）：
 *   1. 执行工具前，必须把 assistant 那条消息（含 tool_calls）原样塞回 messages
 *   2. tool 消息必须带 tool_call_id，顺序与 tool_calls 一一对应
 *   3. MAX_ROUNDS 是刹车，防止模型来回调同一个工具
 *   4. 工具报错不抛异常，把 { ok: false } 喂回去，让模型自己换招
 */
import type { Dish, UserProfile } from '../../shared/types'
import { DEFAULT_PROFILE } from '../../shared/types'
import { providerChain } from '../utils/ai'
import { allDishes, findCity, findDish, getCityDishes } from '../utils/catalog'
import { assessMenu } from '../utils/rules'
import { enrichWithKnowledge, retrieve } from '../utils/retrieve'
import { getProfile } from '../utils/store'

const MAX_ROUNDS = 5

const SYSTEM_PROMPT = `你是「食鉴」，一个帮人判断「这道菜我能不能吃」的助手。

铁律（违反任何一条都算答错）：
1. 只要回答涉及「某道菜能不能吃」或「推荐哪些菜」，**必须先调 assess_dishes**，不许凭常识下结论，也不许只调 list_dishes 就直接推荐。
2. 解释原因时先调 search_knowledge，引用条目里的 source。找不到依据就说「不确定，建议询问店员」。
3. 不知道用户档案就先调 get_profile。
4. 用户问某一道具体的菜时，list_dishes 必须带 keyword（菜名），否则查不到。
5. 每道菜的结论必须以「可以吃 / 注意 / 别点」开头，后面接一句理由。不许说「可能没问题」这种模糊话。
6. 推荐时只列 level=safe 的菜；caution 的单独一句提醒；forbidden 的明确说「别点」并给过敏原。
7. 不构成医疗建议，涉及治疗的话不接。`

interface TraceRow {
  round: number
  tool: string
  args: unknown
  ok: boolean
  ms: number
  preview: string
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_profile',
      description:
        '读取当前用户的身体档案（过敏原、慢病、怀孕、饮食目标）。任何涉及"我能不能吃"的问题都应该先调它。',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_dishes',
      description:
        '按城市或关键词查询菜品库。返回菜品 id、名称、价格、标签。查完拿到 id 才能调 assess_dishes。',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名或 id，例如"成都"' },
          keyword: { type: 'string', description: '菜名关键词，例如"火锅"' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'assess_dishes',
      description:
        '用规则引擎判定一组菜品对该用户是否安全。返回每道菜的三色等级和原因。不允许凭常识回答，必须调这个。',
      parameters: {
        type: 'object',
        properties: {
          dishIds: { type: 'array', items: { type: 'string' }, description: '菜品 id 列表' }
        },
        required: ['dishIds']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: '检索禁忌知识库，返回带出处的条目。用于解释"为什么"以及补充医学依据。',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '检索词，例如"痛风 嘌呤"' } },
        required: ['query']
      }
    }
  }
]

function preview(v: unknown): string {
  const s = JSON.stringify(v)
  return s.length > 60 ? s.slice(0, 60) + '…' : s
}

async function runTool(
  name: string,
  args: any,
  ctx: { profile: UserProfile; dishes?: Dish[] }
): Promise<{ ok: boolean; data: unknown }> {
  try {
    switch (name) {
      case 'get_profile':
        return { ok: true, data: ctx.profile }

      case 'list_dishes': {
        let list: Dish[] = []
        if (args.city) {
          const city = findCity(String(args.city))
          list = city ? getCityDishes(city.id) : []
        } else if (ctx.dishes?.length) {
          list = ctx.dishes
        } else {
          // 没给城市、页面也没带菜：查全库，再按关键词过滤
          list = allDishes()
        }
        if (args.keyword) {
          const kw = String(args.keyword).toLowerCase()
          list = list.filter((d) => `${d.name}${d.name_zh ?? ''}`.toLowerCase().includes(kw))
        }
        if (args.keyword && list.length === 0) {
          return {
            ok: false,
            data: { error: `菜库里没有匹配「${args.keyword}」的菜，换个关键词或先调 list_dishes 看看有哪些` }
          }
        }
        return {
          ok: true,
          data: {
            count: list.length,
            dishes: list.slice(0, 20).map((d) => ({
              id: d.id,
              name: d.name_zh ?? d.name,
              price: d.reference_price,
              tags: d.tags
            }))
          }
        }
      }

      case 'assess_dishes': {
        const ids: string[] = Array.isArray(args.dishIds) ? args.dishIds : []
        // 页面带来的菜优先（id 可能不在菜库里）
        const local = ctx.dishes ?? []
        const dishes = ids
          .map((id) => local.find((d) => d.id === id) ?? findDish(String(id)))
          .filter(Boolean) as Dish[]

        if (!dishes.length) {
          return { ok: false, data: { error: '没有找到这些 dishId，请先调 list_dishes' } }
        }

        const { assessments, summary } = assessMenu(dishes, ctx.profile)
        const enriched = enrichWithKnowledge(assessments, dishes, ctx.profile)

        return {
          ok: true,
          data: {
            summary,
            results: enriched.map((a) => ({
              dishId: a.dish_id,
              name: dishes.find((d) => d.id === a.dish_id)?.name_zh ?? '',
              level: a.level,
              reasons: a.reasons,
              suggestion: a.suggestion,
              sources: a.references?.map((r) => r.source).slice(0, 2) ?? []
            }))
          }
        }
      }

      case 'search_knowledge': {
        const hits = retrieve(String(args.query ?? ''), [], 3)
        return {
          ok: true,
          data: {
            count: hits.length,
            entries: hits.map((h) => ({
              title: h.title,
              source: h.source,
              category: h.category,
              body: h.body.slice(0, 300)
            }))
          }
        }
      }

      default:
        return { ok: false, data: { error: `没有这个工具：${name}` } }
    }
  } catch (e) {
    return { ok: false, data: { error: e instanceof Error ? e.message : String(e) } }
  }
}

/** 用规则引擎的结论给模型答案兜底：模型负责表达，规则负责结论 */
function appendix(assessed: any): string {
  if (!assessed?.results?.length) return ''
  const pick = (level: string) =>
    assessed.results
      .filter((r: any) => r.level === level)
      .map((r: any) => r.name || r.dishId)

  const safe = pick('safe')
  const caution = pick('caution')
  const forbidden = pick('forbidden')

  const lines = ['', '', '—— 规则引擎核对（以此为准）——']
  if (safe.length) lines.push('✅ 可以吃：' + safe.join('、'))
  if (caution.length) lines.push('⚠️ 注意：' + caution.join('、'))
  if (forbidden.length) lines.push('⛔ 别点：' + forbidden.join('、'))
  if (!safe.length && !caution.length && !forbidden.length) return ''
  return lines.join('\n')
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ deviceId?: string; question?: string; dishes?: Dish[] }>(event)

  const deviceId = body?.deviceId ?? ''
  if (!deviceId || deviceId.length < 8) {
    throw createError({ statusCode: 400, statusMessage: '缺少 deviceId' })
  }

  const question = (body?.question ?? '').trim()
  if (!question) {
    throw createError({ statusCode: 400, statusMessage: '缺少 question' })
  }

  const profile: UserProfile = (await getProfile(deviceId)) ?? DEFAULT_PROFILE
  const provider = providerChain()[0]
  if (!provider) {
    throw createError({ statusCode: 503, statusMessage: '没有配置可用的模型供应商' })
  }

  const trace: TraceRow[] = []
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question }
  ]

  if (body?.dishes?.length) {
    messages.push({
      role: 'user',
      content: `当前页面的菜品：${JSON.stringify(
        body.dishes.map((d) => ({ id: d.id, name: d.name_zh ?? d.name }))
      )}`
    })
  }

  let rounds = 0
  /** 模型想跳过判定时，强行再要一轮工具调用 */
  let forceTool = false
  let nudged = false
  /** 最后一次 assess_dishes 的结果：答案末尾用规则引擎的结论兜底 */
  let lastAssess: any = null

  while (rounds < MAX_ROUNDS) {
    rounds++

    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: provider.textModels[0],
        messages,
        tools: TOOLS,
        tool_choice: forceTool ? 'required' : 'auto',
        temperature: 0.3
      })
    })

    if (!res.ok) {
      throw createError({
        statusCode: 502,
        statusMessage: `${provider.label}/${provider.textModels[0]}: ${(await res.text()).slice(0, 200)}`
      })
    }

    const data: any = await res.json()
    const msg = data.choices?.[0]?.message
    if (!msg) {
      throw createError({ statusCode: 502, statusMessage: '模型没有返回 message' })
    }

    // 没有工具调用 = 它想收口了
    if (!msg.tool_calls?.length) {
      // 护栏：涉及菜品的回答必须先过规则引擎，不能凭模型常识下结论
      const hasAssess = trace.some((t) => t.tool === 'assess_dishes')
      const mentionsDish = /菜|吃|点|推荐|豆腐|鱼|肉|面|饭|锅/.test(question)

      if (!hasAssess && mentionsDish && !nudged && rounds < MAX_ROUNDS) {
        nudged = true
        forceTool = true
        messages.push({ role: 'assistant', content: msg.content ?? '' })
        messages.push({
          role: 'user',
          content:
            '停一下：你还没有调用 assess_dishes。按铁律 1，任何关于「能不能吃 / 推荐哪道」的回答都必须先用工具判定。请现在调用 assess_dishes（菜品 id 可从 list_dishes 的结果里取），拿到 level 与 reasons 之后再回答。'
        })
        continue
      }

      setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
      return {
        answer: (msg.content ?? '') + appendix(lastAssess),
        trace,
        rounds,
        usage: data.usage
          ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens }
          : null
      }
    }

    // 必须原样塞回 assistant（含 tool_calls），否则下一轮格式报错
    messages.push(msg)
    forceTool = false

    for (const call of msg.tool_calls) {
      const name = call.function?.name ?? ''
      let args: any = {}
      try {
        args = JSON.parse(call.function?.arguments ?? '{}')
      } catch {
        args = {}
      }

      const t0 = Date.now()
      const { ok, data: result } = await runTool(name, args, { profile, dishes: body?.dishes })
      const ms = Date.now() - t0
      if (name === 'assess_dishes' && ok) lastAssess = result

      trace.push({ round: rounds, tool: name, args, ok, ms, preview: preview(result) })

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 4000)
      })
    }
  }

  // 轮数用完还没收口：别让前端白等
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return {
    answer: '这个问题我查了几轮还没查清，建议直接问店员确认食材。',
    trace,
    rounds,
    usage: null
  }
})

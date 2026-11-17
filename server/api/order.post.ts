
import type { Dish, Taste, UserProfile } from '../../shared/types'
import { tasteLabel } from '../../shared/types'
import { assessMenu } from '../utils/rules'
import { assemblePlan, type PlanResult } from '../utils/plan'
import { resolveProfile } from '../utils/profile'
import { providerChain } from '../utils/ai'

interface OrderBody {
  deviceId?: string
  dishes?: Dish[]
  people?: number
  budget?: number | null
  taste?: Taste
  profile?: Partial<UserProfile>
}

interface AiPlan {
  think: string
  picks: string[]
}

function ruleThink(result: PlanResult): string {
  const bits: string[] = []
  if (result.excluded.length) bits.push(`先划掉 ${result.excluded.length} 道，撞上你的忌口`)
  bits.push(`剩下能吃的按你想的口味排，挑了 ${result.count} 道，一共 ${result.total} 元`)
  if (result.budget !== null) {
    const left = result.budget - result.total
    bits.push(left > 0 ? `还剩 ${left} 元` : '正好卡在预算上')
  }
  bits.push(...result.notes)
  return bits.join('；') + '。'
}

function pickJson(text: string): AiPlan | null {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const tryParse = (raw: string): AiPlan | null => {
    try {
      const v = JSON.parse(raw) as { think?: unknown; picks?: unknown }
      if (typeof v.think !== 'string' || !Array.isArray(v.picks)) return null
      const picks = v.picks.filter((x): x is string => typeof x === 'string')
      if (!v.think.trim() || picks.length === 0) return null
      return { think: v.think.trim(), picks }
    } catch {
      return null
    }
  }

  const direct = tryParse(cleaned)
  if (direct) return direct


  const m = cleaned.match(/\{[\s\S]*\}/)
  return m ? tryParse(m[0]) : null
}

async function aiPlan(pool: Dish[], result: PlanResult, budget: number | null): Promise<AiPlan | null> {
  const providers = providerChain()
  if (providers.length === 0) return null


  const wantCount = Math.min(6, Math.max(3, result.people + 1))

  const system =
    '你在帮人配一桌中餐。先在心里过一遍，再挑菜。\n' +
    '硬要求：\n' +
    '1. 只能从「候选」里挑，不许出现候选之外的名字；\n' +
    `2. 挑 ${wantCount} 道左右；同一种做法最多 2 道；\n` +
    '3. 有预算时，合计不得超过预算；预算够就别只挑最便宜的，但也别为花光硬凑；\n' +
    '4. 用「你」，不用「您」；不用「推荐」「来来来」；\n' +
    '5. 只输出一个 JSON 对象：{"think":"…","picks":["菜品 id",…]}\n' +
    '   think 是给人看的思路，60–80 字，第一人称、口语，必须做到：\n' +
    '   a) 说清你是怎么权衡的（口味、荤素、主食够不够）；\n' +
    '   b) 至少说一句「只有看过名单才知道」的判断，比如这城的辣菜其实只有几道、\n' +
    '      哪几道是主食、有没有被划掉的菜；\n' +
    '   c) 不要出现任何金额（元、块），也不要评价贵贱——合计和余额菜单底部会写，\n' +
    '      你报了只会报错；\n' +
    '   d) 不要复述菜名清单，不要「作为 AI」。'

  const payload = {
    人数: result.people,
    口味: tasteLabel(result.taste),
    预算: budget,
    可挑菜数: pool.length,
    被划掉的菜: result.excluded.map((x) => ({ 菜: x.dish.name, 原因: x.reasons[0] ?? '' })),
    规则参考: result.plan.map((p) => p.dish.id),
    候选: pool.map((d) => ({
      id: d.id,
      名字: d.name,
      价格: d.reference_price,
      做法: d.method,
      辣度: d.spicy_level,
      口味: d.flavors
    }))
  }

  for (const provider of providers) {
    for (const model of provider.textModels) {
      try {
        const res = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`
          },
          body: JSON.stringify({
            model,
            temperature: 0.6,
            max_tokens: 240,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: JSON.stringify(payload) }
            ]
          })
        })

        if (!res.ok) continue
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
        const text = data.choices?.[0]?.message?.content ?? ''
        const parsed = pickJson(text)
        if (parsed) return parsed
      } catch {

      }
    }
  }

  return null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<OrderBody>(event)

  const dishes = body?.dishes ?? []
  if (!Array.isArray(dishes) || dishes.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'dishes 不能为空' })
  }

  const profile = await resolveProfile({ profile: body?.profile, deviceId: body?.deviceId })

  const people = Number(body?.people) || 2
  const budget = typeof body?.budget === 'number' && body.budget > 0 ? body.budget : null
  const taste: Taste = body?.taste ?? 'any'

  const { assessments } = assessMenu(dishes, profile)
  const byId = new Map(assessments.map((a) => [a.dish_id, a]))


  const pool = dishes.filter((d) => byId.get(d.id)?.level !== 'forbidden')

  const ruleResult = assemblePlan(dishes, assessments, { people, budget, taste })

  let result = ruleResult
  let think = ruleThink(ruleResult)
  let thinkBy: 'ai' | 'rule' = 'rule'

  const ai = await aiPlan(pool, ruleResult, budget)
  if (ai) {
    const validIds = new Set(pool.map((d) => d.id))
    const picks = ai.picks.filter((id) => validIds.has(id))

    if (picks.length >= 3) {
      const aiResult = assemblePlan(dishes, assessments, { people, budget, taste, picks })


      const moneyInThink = /[0-9０-９]+\s*(元|块)/.test(ai.think)
      if (aiResult.count >= 3 && !moneyInThink) {
        result = aiResult
        think = ai.think
        thinkBy = 'ai'
      }
    }
  }

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return { ...result, think, thinkBy }
})

/**
 * 点菜组合（M4）：人数 + 预算 + 档案约束 → 配一桌。
 *
 * 策略：
 *   1. 过敏 / 孕期 / 忌口命中的菜直接剔除（硬约束，不让步）
 *   2. 其余按 风险等级 → 价格 排序
 *   3. 保证多样性：同一做法最多 2 道
 *   4. 预算兜底：超预算就停，并在 notes 里说明
 */
import type { Dish, UserProfile } from '../../shared/types'

const DEFAULT_PROFILE: UserProfile = {
  gender: 'female',
  age: 25,
  height_cm: 165,
  weight_kg: 55,
  activity: 'light',
  goal: 'none',
  allergens: [],
  conditions: [],
  dietary: []
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    deviceId?: string
    dishes?: Dish[]
    people?: number
    budget?: number | null
    profile?: Partial<UserProfile>
  }>(event)

  const dishes = body?.dishes ?? []
  if (!Array.isArray(dishes) || dishes.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'dishes 不能为空' })
  }

  const people = Math.min(10, Math.max(1, Number(body?.people) || 2))
  const budget = typeof body?.budget === 'number' && body.budget > 0 ? body.budget : null

  // 档案：优先请求体，其次用设备存档
  let profile: UserProfile | null = null
  if (body?.profile) {
    profile = { ...DEFAULT_PROFILE, ...body.profile, allergens: body.profile.allergens ?? [], conditions: body.profile.conditions ?? [], dietary: body.profile.dietary ?? [] }
  } else if (body?.deviceId && body.deviceId.length >= 8) {
    profile = await getProfile(body.deviceId)
  }
  profile = profile ?? DEFAULT_PROFILE

  const { assessments } = assessMenu(dishes, profile)
  const byId = new Map(assessments.map((a) => [a.dish_id, a]))

  const excluded: { dish: Dish; level: string; reasons: string[] }[] = []
  const candidates: Dish[] = []

  for (const dish of dishes) {
    const a = byId.get(dish.id)
    if (!a) continue
    if (a.level === 'forbidden') {
      excluded.push({ dish, level: a.level, reasons: a.reasons })
      continue
    }
    candidates.push(dish)
  }

  // 排序：安全的优先，其次便宜的；risk 高的往后压
  candidates.sort((x, y) => {
    const ax = byId.get(x.id)!
    const ay = byId.get(y.id)!
    const order = { safe: 0, caution: 1, forbidden: 2 } as const
    if (order[ax.level] !== order[ay.level]) return order[ax.level] - order[ay.level]
    return (x.reference_price ?? 999) - (y.reference_price ?? 999)
  })

  const targetCount = Math.min(candidates.length, Math.max(3, people * 2))
  const picked: Dish[] = []
  const methodCount = new Map<string, number>()
  let total = 0
  const notes: string[] = []

  for (const dish of candidates) {
    if (picked.length >= targetCount) break
    const method = dish.method ?? '其他'
    if ((methodCount.get(method) ?? 0) >= 2) continue

    const price = dish.reference_price ?? 0
    if (budget !== null && total + price > budget) {
      notes.push(`预算限制：${dish.name} 未加入（超出 ¥${budget}）`)
      continue
    }

    picked.push(dish)
    methodCount.set(method, (methodCount.get(method) ?? 0) + 1)
    total += price
  }

  const pickedAssessments = picked.map((d) => byId.get(d.id)!)

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return {
    plan: picked.map((d, i) => ({ dish: d, assessment: pickedAssessments[i] })),
    total,
    count: picked.length,
    people,
    budget,
    excluded,
    notes,
    summary: {
      safe: pickedAssessments.filter((a) => a.level === 'safe').length,
      caution: pickedAssessments.filter((a) => a.level === 'caution').length
    }
  }
})

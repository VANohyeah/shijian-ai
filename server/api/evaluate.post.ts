/**
 * 健康评估接口：档案 × 菜品列表 → 每道菜的三色判定。
 * 判定逻辑在 server/utils/health-rules.ts，这里是纯 IO 与校验。
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
  const body = await readBody<{ dishes?: Dish[]; profile?: Partial<UserProfile> }>(event)

  if (!Array.isArray(body?.dishes) || body.dishes.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'dishes 不能为空' })
  }
  if (body.dishes.length > 20) {
    throw createError({ statusCode: 400, statusMessage: '一次最多评估 20 道菜' })
  }

  const profile: UserProfile = {
    ...DEFAULT_PROFILE,
    ...body.profile,
    allergens: body.profile?.allergens ?? [],
    conditions: body.profile?.conditions ?? [],
    dietary: body.profile?.dietary ?? []
  }

  const { assessments, summary } = assessMenu(body.dishes, profile)
  const enriched = enrichWithKnowledge(assessments, body.dishes, profile)

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return { assessments: enriched, summary, profile }
})

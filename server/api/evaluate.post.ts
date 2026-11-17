
import type { Dish, UserProfile } from '../../shared/types'
import { assessMenu } from '../utils/rules'
import { enrichWithKnowledge } from '../utils/retrieve'
import { mergeProfile } from '../utils/profile'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ dishes?: Dish[]; profile?: Partial<UserProfile> }>(event)

  if (!Array.isArray(body?.dishes) || body.dishes.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'dishes 不能为空' })
  }
  if (body.dishes.length > 20) {
    throw createError({ statusCode: 400, statusMessage: '一次最多评估 20 道菜' })
  }

  const profile = mergeProfile(body?.profile)

  const { assessments, summary } = assessMenu(body.dishes, profile)
  const enriched = enrichWithKnowledge(assessments, body.dishes, profile)

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return { assessments: enriched, summary, profile }
})

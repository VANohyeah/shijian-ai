
import type { UserProfile } from '../../../../shared/types'
import { findCity, getCityDishes } from '../../../utils/catalog'
import { assessMenu } from '../../../utils/rules'
import { enrichWithKnowledge } from '../../../utils/retrieve'
import { mergeProfile } from '../../../utils/profile'

export default defineEventHandler(async (event) => {
  const cityKey = String(event.context.params?.id ?? '').trim()
  const body = await readBody<{ profile?: Partial<UserProfile> }>(event).catch(() => ({}) as { profile?: Partial<UserProfile> })

  if (!cityKey) {
    throw createError({ statusCode: 400, statusMessage: '缺少 cityId' })
  }

  const city = findCity(cityKey)
  if (!city) {
    throw createError({ statusCode: 404, statusMessage: `没有找到城市：${cityKey}` })
  }

  const dishes = getCityDishes(cityKey)
  const hasProfile =
    (body.profile?.allergens?.length ?? 0) > 0 ||
    (body.profile?.conditions?.length ?? 0) > 0 ||
    (body.profile?.goal && body.profile.goal !== 'none')

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')

  if (!hasProfile) {
    return { city, dishes, assessments: null, summary: null }
  }

  const profile = mergeProfile(body.profile)

  const { assessments, summary } = assessMenu(dishes, profile)
  const enriched = enrichWithKnowledge(assessments, dishes, profile)
  return { city, dishes, assessments: enriched, summary }
})

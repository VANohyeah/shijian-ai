/**
 * 某城市的特色菜 + 健康评估。
 * 这是 M3 的核心：不用拍照、不用提问，进来就知道每道菜适不适合你。
 */
import type { UserProfile } from '../../../shared/types'

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

  const profile: UserProfile = {
    gender: 'female',
    age: 25,
    height_cm: 165,
    weight_kg: 55,
    activity: 'light',
    goal: 'none',
    allergens: [],
    conditions: [],
    dietary: [],
    ...body.profile,
    allergens: body.profile?.allergens ?? [],
    conditions: body.profile?.conditions ?? [],
    dietary: body.profile?.dietary ?? []
  }

  const { assessments, summary } = assessMenu(dishes, profile)
  const enriched = enrichWithKnowledge(assessments, dishes, profile)
  return { city, dishes, assessments: enriched, summary }
})

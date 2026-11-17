
import type { Dish, UserProfile } from '../../shared/types'
import { assessMenu } from '../utils/rules'
import { assemblePlan } from '../utils/plan'
import { resolveProfile } from '../utils/profile'

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


  const profile = await resolveProfile({ profile: body?.profile, deviceId: body?.deviceId })

  const { assessments } = assessMenu(dishes, profile)

  const result = assemblePlan(dishes, assessments, {
    people: Number(body?.people) || 2,
    budget: typeof body?.budget === 'number' && body.budget > 0 ? body.budget : null
  })

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return result
})

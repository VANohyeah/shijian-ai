/**
 * 档案读写。
 * 目标结构里只列了 profile.put.ts；读取用一个轻量 GET 补上，
 * 否则前端每次都只能靠 localStorage 猜。
 */
import type { UserProfile } from '../../shared/types'

const ALLOWED_GOALS = ['fat_loss', 'muscle_gain', 'sugar_control', 'none']

function sanitize(input: Partial<UserProfile>): UserProfile {
  return {
    gender: input.gender === 'male' ? 'male' : 'female',
    age: Math.min(120, Math.max(1, Number(input.age) || 25)),
    height_cm: Math.min(250, Math.max(80, Number(input.height_cm) || 165)),
    weight_kg: Math.min(300, Math.max(20, Number(input.weight_kg) || 55)),
    activity: ['sedentary', 'light', 'moderate', 'active'].includes(String(input.activity))
      ? (input.activity as UserProfile['activity'])
      : 'light',
    goal: ALLOWED_GOALS.includes(String(input.goal))
      ? (input.goal as UserProfile['goal'])
      : 'none',
    allergens: Array.isArray(input.allergens) ? [...new Set(input.allergens)] : [],
    conditions: Array.isArray(input.conditions) ? [...new Set(input.conditions)] : [],
    dietary: Array.isArray(input.dietary) ? [...new Set(input.dietary)] : []
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ deviceId?: string; profile?: Partial<UserProfile> }>(event)
  const deviceId = body?.deviceId

  if (!deviceId || deviceId.length < 8) {
    throw createError({ statusCode: 400, statusMessage: '缺少 deviceId' })
  }
  if (!body?.profile) {
    throw createError({ statusCode: 400, statusMessage: '缺少 profile' })
  }

  const profile = sanitize(body.profile)
  const saved = await saveProfile(deviceId, profile)

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return { ...saved, deviceId }
})

/**
 * 写一条历史记录（每次识别 / 每次看城市都算一次）。
 * body: { deviceId, source, title, dishes, summary? }
 */
import type { Dish } from '../../../shared/types/dish'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    deviceId?: string
    source?: 'photo' | 'city'
    title?: string
    dishes?: Dish[]
    summary?: { total: number; safe: number; caution: number; forbidden: number } | null
  }>(event)

  const deviceId = body?.deviceId
  if (!deviceId || deviceId.length < 8) {
    throw createError({ statusCode: 400, statusMessage: '缺少 deviceId' })
  }
  if (!Array.isArray(body?.dishes) || body.dishes.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'dishes 不能为空' })
  }

  const entry = await addHistory(deviceId, {
    source: body.source === 'city' ? 'city' : 'photo',
    title: body.title?.slice(0, 40) || '未命名记录',
    dishes: body.dishes.slice(0, 20),
    summary: body.summary ?? null
  })

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return { entry }
})

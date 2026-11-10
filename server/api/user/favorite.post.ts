/**
 * 收藏 / 取消收藏。
 * body: { deviceId, dish, action?: 'add' | 'remove' }
 */
import type { Dish } from '../../../shared/types/dish'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ deviceId?: string; dish?: Dish; action?: 'add' | 'remove' }>(event)
  const deviceId = body?.deviceId

  if (!deviceId || deviceId.length < 8) {
    throw createError({ statusCode: 400, statusMessage: '缺少 deviceId' })
  }

  const action = body?.action ?? 'add'

  if (action === 'remove') {
    if (!body?.dish?.id) {
      throw createError({ statusCode: 400, statusMessage: '缺少 dish.id' })
    }
    const favorites = await removeFavorite(deviceId, body.dish.id)
    setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    return { favorites, count: favorites.length }
  }

  if (!body?.dish?.id || !body.dish.name) {
    throw createError({ statusCode: 400, statusMessage: '缺少 dish 数据' })
  }

  const favorites = await addFavorite(deviceId, body.dish)
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return { favorites, count: favorites.length }
})

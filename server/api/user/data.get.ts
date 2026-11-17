import { getFavorites, getHistory, getProfile } from '../../utils/store'

export default defineEventHandler(async (event) => {
  const { deviceId } = getQuery(event) as { deviceId?: string }

  if (!deviceId || deviceId.length < 8) {
    throw createError({ statusCode: 400, statusMessage: '缺少 deviceId' })
  }

  const [profile, favorites, history] = await Promise.all([
    getProfile(deviceId),
    getFavorites(deviceId),
    getHistory(deviceId)
  ])

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return {
    profile,
    favorites,
    history,
    counts: { favorites: favorites.length, history: history.length }
  }
})

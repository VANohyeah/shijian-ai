/**
 * 用户数据读取：收藏 + 历史。
 * deviceId 由前端 localStorage 生成，暂时代替账号体系；接入真实登录后改成 userId 即可。
 */
export default defineEventHandler(async (event) => {
  const { deviceId } = getQuery(event) as { deviceId?: string }

  if (!deviceId || deviceId.length < 8) {
    throw createError({ statusCode: 400, statusMessage: '缺少 deviceId' })
  }

  const [favorites, history] = await Promise.all([getFavorites(deviceId), getHistory(deviceId)])

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return {
    favorites,
    history,
    counts: { favorites: favorites.length, history: history.length }
  }
})

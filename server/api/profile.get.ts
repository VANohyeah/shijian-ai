/** 读档案；没填过返回 profile: null */
export default defineEventHandler(async (event) => {
  const { deviceId } = getQuery(event) as { deviceId?: string }

  if (!deviceId || deviceId.length < 8) {
    throw createError({ statusCode: 400, statusMessage: '缺少 deviceId' })
  }

  const profile = await getProfile(deviceId)

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return { profile, complete: Boolean(profile) }
})

/**
 * 菜品详情：基础信息 + 语言视角 + 复刻视角 + （可选）针对某档案的判定。
 * GET /api/dishes/:id?deviceId=xxx
 */
export default defineEventHandler(async (event) => {
  const dishId = String(event.context.params?.id ?? '').trim()
  const { deviceId } = getQuery(event) as { deviceId?: string }

  if (!dishId) {
    throw createError({ statusCode: 400, statusMessage: '缺少菜品 id' })
  }

  const dish = findDish(dishId)
  if (!dish) {
    throw createError({ statusCode: 404, statusMessage: `没有找到菜品：${dishId}` })
  }

  const language = getLanguageView(dishId)
  const recipe = getRecipeView(dishId)

  let assessment = null
  if (deviceId && deviceId.length >= 8) {
    const profile = await getProfile(deviceId)
    if (profile) {
      const [enriched] = enrichWithKnowledge(assessMenu([dish], profile).assessments, [dish], profile)
      assessment = enriched
    }
  }

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return {
    dish,
    language,
    recipe,
    assessment,
    /** 哪些视角有内容，前端据此决定 tab 要不要灰掉 */
    available: { language: Boolean(language), recipe: Boolean(recipe) }
  }
})

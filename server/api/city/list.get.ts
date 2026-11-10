/** 城市列表：前端按 area 分组展示 */
export default defineEventHandler((event) => {
  const cities = listCities()
  const areas = [...new Set(cities.map((c) => c.area))]

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return {
    total: cities.length,
    dishTotal: totalDishes(),
    areas,
    cities
  }
})

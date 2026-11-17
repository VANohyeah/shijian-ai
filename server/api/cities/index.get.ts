import { listCities, totalDishes } from '../../utils/catalog'

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

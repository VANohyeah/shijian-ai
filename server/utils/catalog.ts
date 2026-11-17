
import dishesRaw from '../../seed/dishes.json'
import citiesRaw from '../../seed/cities.json'
import type { Dish } from '../../shared/types'

interface RawDish {
  id: string
  name: string
  region: string
  city: string
  ingredients: string[]
  method: string
  flavors: string[]
  spicy_level: 0 | 1 | 2 | 3
  allergens: string[]
  tags: string[]
  reference_price: number | null
}

interface RawCity {
  id: string
  name: string
  province: string
  area: string
  region: string
  spicy_baseline: number
  aliases: string[]
  intro: string
  dish_count: number
}

export interface CityInfo {
  id: string
  name: string
  province: string
  area: string
  region: string
  intro: string
  dishCount: number
}

const rawDishes = (dishesRaw as unknown as { dishes: RawDish[] }).dishes ?? []
const rawCities = (citiesRaw as unknown as { cities: RawCity[] }).cities ?? []

function toDish(raw: RawDish): Dish {
  return {
    id: raw.id,
    name: raw.name,
    name_zh: raw.name,
    region: raw.region ?? null,
    city: raw.city ?? null,
    ingredients: raw.ingredients ?? [],
    ingredients_zh: raw.ingredients ?? [],
    method: raw.method ?? null,
    flavors: raw.flavors ?? [],
    spicy_level: raw.spicy_level ?? null,
    allergens: (raw.allergens ?? []) as Dish['allergens'],
    tags: raw.tags ?? [],
    reference_price: typeof raw.reference_price === 'number' ? raw.reference_price : null,
    source: 'library',
    confidence: 1
  }
}

const dishesByCity = new Map<string, Dish[]>()
for (const raw of rawDishes) {
  const list = dishesByCity.get(raw.city) ?? []
  list.push(toDish(raw))
  dishesByCity.set(raw.city, list)
}

export function listCities(): CityInfo[] {
  return rawCities.map((c) => ({
    id: c.id,
    name: c.name,
    province: c.province,
    area: c.area,
    region: c.region,
    intro: c.intro,
    dishCount: dishesByCity.get(c.name)?.length ?? 0
  }))
}

export function findCity(cityIdOrName: string): CityInfo | null {
  const key = cityIdOrName.trim()
  const hit = rawCities.find((c) => c.id === key || c.name === key)
  return hit ? listCities().find((c) => c.id === hit.id) ?? null : null
}

export function getCityDishes(cityIdOrName: string): Dish[] {
  const city = findCity(cityIdOrName)
  if (!city) return []
  return dishesByCity.get(city.name) ?? []
}

export function totalDishes(): number {
  return rawDishes.length
}

export function findDish(dishId: string): Dish | null {
  for (const list of dishesByCity.values()) {
    const hit = list.find((d) => d.id === dishId)
    if (hit) return hit
  }
  return null
}

export function allDishes(): Dish[] {
  return [...dishesByCity.values()].flat()
}

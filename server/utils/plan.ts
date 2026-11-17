
import type { Dish, DishAssessment, Taste } from '../../shared/types'
import { tasteLabel } from '../../shared/types'

export interface PlanOptions {
  people: number
  budget: number | null
  taste?: Taste

  picks?: string[]
}

export interface PlanResult {
  plan: { dish: Dish; assessment: DishAssessment }[]
  total: number
  count: number
  people: number
  budget: number | null
  taste: Taste
  excluded: { dish: Dish; level: string; reasons: string[] }[]
  notes: string[]
  summary: { safe: number; caution: number }
}

function matchesTaste(dish: Dish, taste: Taste): boolean {
  if (taste === 'any') return true

  const flavors = dish.flavors ?? []
  const tags = dish.tags ?? []
  const method = dish.method ?? ''
  const name = dish.name ?? ''
  const spicy = dish.spicy_level ?? 0

  if (taste === 'spicy') return spicy >= 2 || flavors.some((f) => f.includes('辣'))
  if (taste === 'soup') {
    return (
      method.includes('汤') ||
      method.includes('炖') ||
      name.includes('汤') ||
      name.includes('羹') ||
      tags.some((t) => t.includes('汤') || t.includes('羹'))
    )
  }

  return spicy <= 1 && !tags.some((t) => t.includes('油') || t.includes('炸'))
}

export function assemblePlan(
  dishes: Dish[],
  assessments: DishAssessment[],
  options: PlanOptions
): PlanResult {
  const people = Math.min(10, Math.max(1, Number(options.people) || 2))
  const budget = typeof options.budget === 'number' && options.budget > 0 ? options.budget : null
  const taste: Taste = options.taste ?? 'any'

  const byId = new Map(assessments.map((a) => [a.dish_id, a]))
  const excluded: { dish: Dish; level: string; reasons: string[] }[] = []
  const candidates: Dish[] = []

  for (const dish of dishes) {
    const a = byId.get(dish.id)
    if (!a) continue
    if (a.level === 'forbidden') {
      excluded.push({ dish, level: a.level, reasons: a.reasons })
      continue
    }
    candidates.push(dish)
  }

  const levelOrder = { safe: 0, caution: 1, forbidden: 2 } as const
  candidates.sort((x, y) => {
    const ax = byId.get(x.id)!
    const ay = byId.get(y.id)!

    const tx = matchesTaste(x, taste) ? 0 : 1
    const ty = matchesTaste(y, taste) ? 0 : 1
    if (tx !== ty) return tx - ty
    if (levelOrder[ax.level] !== levelOrder[ay.level]) {
      return levelOrder[ax.level] - levelOrder[ay.level]
    }
    return (x.reference_price ?? 999) - (y.reference_price ?? 999)
  })

  const targetCount = Math.min(candidates.length, Math.max(3, people * 2))
  const picked: Dish[] = []
  const methodCount = new Map<string, number>()
  const notes: string[] = []
  let total = 0


  const wanted = options.picks?.length
    ? options.picks.map((id) => candidates.find((d) => d.id === id)).filter(Boolean as unknown as (d: Dish | undefined) => d is Dish)
    : candidates

  for (const dish of wanted) {
    if (picked.length >= targetCount) break
    if (picked.some((p) => p.id === dish.id)) continue
    const method = dish.method ?? '其他'
    if ((methodCount.get(method) ?? 0) >= 2) continue

    const price = dish.reference_price ?? 0
    if (budget !== null && total + price > budget) {
      notes.push(`预算 ${budget} 元打住了，${dish.name} 没能加进来`)
      continue
    }

    picked.push(dish)
    methodCount.set(method, (methodCount.get(method) ?? 0) + 1)
    total += price
  }

  if (taste !== 'any' && picked.length > 0) {
    const hit = picked.filter((d) => matchesTaste(d, taste)).length
    if (hit < picked.length) {
      notes.push(`这座城的「${tasteLabel(taste)}」菜不够，给你掺了 ${picked.length - hit} 道别的`)
    }
  }

  const pickedAssessments = picked.map((d) => byId.get(d.id)!)

  return {
    plan: picked.map((d, i) => ({ dish: d, assessment: pickedAssessments[i] })),
    total,
    count: picked.length,
    people,
    budget,
    taste,
    excluded,
    notes,
    summary: {
      safe: pickedAssessments.filter((a) => a.level === 'safe').length,
      caution: pickedAssessments.filter((a) => a.level === 'caution').length
    }
  }
}

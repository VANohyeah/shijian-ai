

export const ALLERGENS = [
  '含麸质谷物',
  '甲壳类',
  '鱼类',
  '蛋类',
  '花生',
  '大豆',
  '乳制品',
  '坚果',
  '贝类/软体',
  '芝麻',
  '酒精',
  '亚硫酸盐'
] as const

export type Allergen = (typeof ALLERGENS)[number]

export type RiskLevel = 'safe' | 'caution' | 'forbidden'

export type Condition = '痛风' | '高血压' | '糖尿病' | '肾病' | '孕期'

export type Goal = 'fat_loss' | 'muscle_gain' | 'sugar_control' | 'none'

export interface Dish {
  id: string
  name: string

  name_zh: string | null
  region: string | null
  city: string | null
  ingredients: string[]

  ingredients_zh: string[]
  method: string | null
  flavors: string[]

  spicy_level: 0 | 1 | 2 | 3 | null
  allergens: Allergen[]
  tags: string[]
  reference_price: number | null

  source: 'photo' | 'library'

  confidence: number
}

export interface UserProfile {
  gender: 'male' | 'female'
  age: number
  height_cm: number
  weight_kg: number
  activity: 'sedentary' | 'light' | 'moderate' | 'active'
  goal: Goal
  allergens: Allergen[]
  conditions: Condition[]
  dietary: string[]
}

export interface DishAssessment {
  dish_id: string
  level: RiskLevel

  reasons: string[]

  citations: string[]
  suggestion: string | null
}

export type DishDraft = Omit<Dish, 'id' | 'source'>

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  safe: '可以吃',
  caution: '注意',
  forbidden: '别点'
}

export const GOAL_LABEL: Record<Goal, string> = {
  none: '无特殊',
  fat_loss: '减脂',
  muscle_gain: '增肌',
  sugar_control: '控糖'
}

export const DEFAULT_PROFILE: UserProfile = {
  gender: 'female',
  age: 25,
  height_cm: 165,
  weight_kg: 55,
  activity: 'light',
  goal: 'none',
  allergens: [],
  conditions: [],
  dietary: []
}

export type Taste = 'spicy' | 'light' | 'soup' | 'any'

export const TASTE_OPTIONS: { value: Taste; label: string }[] = [
  { value: 'spicy', label: '想吃辣' },
  { value: 'light', label: '清淡点' },
  { value: 'soup', label: '汤汤水水' },
  { value: 'any', label: '都行' }
]

export function tasteLabel(t: Taste): string {
  return TASTE_OPTIONS.find((o) => o.value === t)?.label ?? ''
}

/**
 * 菜品对象与用户档案 —— 整个项目的地基。
 * 拍照识别结果与地域菜品库共用同一结构，任何字段变更必须同步到 decisions 文档。
 */

/**
 * 过敏原大类（12 类）。
 * 唯一真源：C 角色交付包 03_禁忌库/allergens.json
 * （八大类 GB 7718-2011 附录C + 项目扩展 4 类）。
 * 只到「大类」，不到具体食材——食材→大类的映射见 ingredient_allergen_map.json。
 */
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
  /** 中文译名；原文已是中文时与 name 相同 */
  name_zh: string | null
  region: string | null
  city: string | null
  ingredients: string[]
  /** 食材中文译名，与 ingredients 一一对应 */
  ingredients_zh: string[]
  method: string | null
  flavors: string[]
  /** 0=不辣 1=微辣 2=中辣 3=特辣；识别不出为 null */
  spicy_level: 0 | 1 | 2 | 3 | null
  allergens: Allergen[]
  tags: string[]
  reference_price: number | null
  /** photo = 用户拍照识别，library = 地域菜品库 */
  source: 'photo' | 'library'
  /** 视觉识别置信度 0-1，人工录入填 1 */
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

/** 健康评估结果：每道菜一条 */
export interface DishAssessment {
  dish_id: string
  level: RiskLevel
  /** 命中的规则，如 "含虾皮 → 海鲜过敏" */
  reasons: string[]
  /** 依据来源，如 "八大类过敏原清单" */
  citations: string[]
  suggestion: string | null
}

/** 视觉模型返回的原始结构（未补 id/source） */
export type DishDraft = Omit<Dish, 'id' | 'source'>

/** 默认档案：用户未填档时的兜底，评估接口与 Agent 共用 */
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

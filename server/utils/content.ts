/**
 * 菜品内容库：语言视角（250 条）与复刻视角（25 条）。
 * 数据来自 C 交付包 04_内容库，构建期打包。
 */
import languageRaw from '../../seed/language.json'
import recipeRaw from '../../seed/recipe.json'

export interface LanguageView {
  dish_id: string
  what_it_is: string
  how_to_order: string
  culture: string
}

export interface RecipeIngredient {
  name: string
  amount: string
}

export interface Substitution {
  from: string
  to: string
  for: string
  note: string
}

export interface RecipeView {
  id: string
  dish_id: string
  name: string
  difficulty: string
  time_min: number
  serves: number
  ingredients: RecipeIngredient[]
  steps: string[]
  substitutions: Substitution[]
  tips: string[]
  allergen_note: string
}

const languages = new Map<string, LanguageView>(
  ((languageRaw as unknown as { entries: LanguageView[] }).entries ?? []).map((e) => [e.dish_id, e])
)

const recipes = new Map<string, RecipeView>(
  ((recipeRaw as unknown as { entries: RecipeView[] }).entries ?? []).map((e) => [e.dish_id, e])
)

export function getLanguageView(dishId: string): LanguageView | null {
  return languages.get(dishId) ?? null
}

export function getRecipeView(dishId: string): RecipeView | null {
  return recipes.get(dishId) ?? null
}

/** 有多少菜有语言视角 / 复刻菜谱，用于验收与文档 */
export function contentStats() {
  return { language: languages.size, recipe: recipes.size }
}


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

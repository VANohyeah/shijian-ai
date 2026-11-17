
import kbRaw from '../../seed/knowledge.json'
import type { Dish, DishAssessment, RiskLevel, UserProfile } from '../../shared/types'

export interface KnowledgeEntry {
  id: string
  title: string
  keywords: string
  category: string
  body: string
  source: string
  confidence: string
}

const entries: KnowledgeEntry[] =
  (kbRaw as unknown as { entries: KnowledgeEntry[] }).entries ?? []

const CATEGORY_HINT: Record<string, string[]> = {
  痛风: ['purine'],
  高血压: ['sodium'],
  糖尿病: ['sugar'],
  肾病: ['sodium', 'protein'],
  孕期: ['pregnancy', 'allergen'],
  fat_loss: ['calorie', 'oil'],
  sugar_control: ['sugar'],
  muscle_gain: ['protein']
}

function tokenize(entry: KnowledgeEntry): string[] {
  return `${entry.keywords} ${entry.title} ${entry.category}`
    .split(/\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

const index = entries.map((e) => ({ entry: e, tokens: tokenize(e) }))

export interface Retrieved {
  id: string
  title: string
  source: string
  category: string

  body: string
}

export function retrieve(query: string, categoryHints: string[] = [], limit = 2): Retrieved[] {
  const text = query.toLowerCase()
  if (!text) return []

  const scored = index
    .map(({ entry, tokens }) => {
      let score = 0
      for (const t of tokens) {
        if (t.length >= 2 && text.includes(t)) score += t.length >= 4 ? 3 : 2
      }
      if (categoryHints.includes(entry.category)) score += 4
      return { entry, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map(({ entry }) => ({
    id: entry.id,
    title: entry.title,
    source: entry.source,
    category: entry.category,
    body: entry.body
  }))
}

export function enrichWithKnowledge(
  assessments: DishAssessment[],
  dishes: Dish[],
  profile: UserProfile
): (DishAssessment & { references: Retrieved[] })[] {
  const hints = [
    ...profile.conditions.flatMap((c) => CATEGORY_HINT[c] ?? []),
    profile.goal !== 'none' ? (CATEGORY_HINT[profile.goal] ?? []) : []
  ].flat()

  return assessments.map((a) => {

    if (a.level === 'safe' && a.reasons.length === 0) {
      return { ...a, references: [] }
    }

    const dish = dishes.find((d) => d.id === a.dish_id)
    const query = [
      dish?.name ?? '',
      ...(dish?.ingredients ?? []),
      ...(dish?.allergens ?? []),
      ...a.reasons
    ].join(' ')

    const references = retrieve(query, hints, 2)

    const extraCitations = references.map((r) => `${r.title}（${r.source}）`)

    return {
      ...a,
      citations: [...new Set([...a.citations, ...extraCitations])],
      references
    }
  })
}

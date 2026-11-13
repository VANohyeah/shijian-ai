/**
 * 知识检索（RAG 的「R」）。
 *
 * 数据：C 交付的 52 条知识（03_禁忌库/knowledge_entries.json），构建期打包。
 * 检索：关键词匹配 + 类别加权，纯内存计算。
 *   - 不引入 SQLite FTS：52 条语料规模下，一次线性扫描比建表更简单，也不会有部署期文件依赖
 *   - 没有向量检索：DeepSeek 无 embedding 接口，引入就等于多养一个服务（见决策记录）
 *
 * 返回结果必须带 source，前端据此展示「依据」。
 */
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

/** 慢病/目标 → 知识类别，用于加权 */
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
  /** 条目正文：Agent 回答「为什么」时需要，缺了只能念标题 */
  body: string
}

/** 检索：给定自由文本，返回最相关的知识条目 */
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

/**
 * 给评估结果补上可检索的依据。
 * 规则引擎给出「为什么」，知识库给出「依据出处」——两者分开，答辩时更好讲。
 */
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
    // 没有判定理由的菜（safe 且无说明）不附依据，避免噪音
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

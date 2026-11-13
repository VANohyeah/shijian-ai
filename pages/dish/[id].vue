<script setup lang="ts">
import type { Dish, DishAssessment } from '~/shared/types'

const route = useRoute()
const router = useRouter()

interface LanguageView {
  what_it_is: string
  how_to_order: string
  culture: string
}
interface RecipeIngredient {
  name: string
  amount: string
}
interface Substitution {
  from: string
  to: string
  for: string
  note: string
}
interface RecipeView {
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

const dish = ref<Dish | null>(null)
const language = ref<LanguageView | null>(null)
const recipe = ref<RecipeView | null>(null)
const assessment = ref<DishAssessment | null>(null)
const loading = ref(true)
const error = ref('')
const tab = ref<'language' | 'recipe'>('language')

/* Agent：模型自己决定调哪些工具，trace 摊开给人看 */
interface TraceRow {
  round: number
  tool: string
  args: unknown
  ok: boolean
  ms: number
  preview: string
}
const agentAnswer = ref('')
const agentTrace = ref<TraceRow[]>([])
const agentRounds = ref(0)
const agentBusy = ref(false)
const agentError = ref('')
const showTrace = ref(true)

async function askAgent() {
  if (!dish.value || agentBusy.value) return
  agentBusy.value = true
  agentAnswer.value = ''
  agentTrace.value = []
  agentError.value = ''

  try {
    const deviceId = localStorage.getItem('shijian_device_id') ?? ''
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        question: `这道「${dish.value.name_zh || dish.value.name}」我能不能吃？为什么？`,
        dishes: [dish.value]
      })
    })
    if (!res.ok) {
      agentError.value = 'HTTP ' + res.status + '：' + (await res.text())
      return
    }
    const data = (await res.json()) as { answer: string; trace: TraceRow[]; rounds: number }
    agentAnswer.value = data.answer
    agentTrace.value = data.trace ?? []
    agentRounds.value = data.rounds ?? 0
  } catch (err) {
    agentError.value = String(err)
  } finally {
    agentBusy.value = false
  }
}

const LEVEL_TEXT = { safe: '✅ 可以吃', caution: '⚠️ 注意', forbidden: '⛔ 别点' } as const

onMounted(async () => {
  const id = String(route.params.id ?? '')
  try {
    const deviceId = localStorage.getItem('shijian_device_id') ?? ''
    const res = await fetch(`/api/dishes/${encodeURIComponent(id)}?deviceId=${encodeURIComponent(deviceId)}`)
    if (!res.ok) {
      error.value = `HTTP ${res.status}：${await res.text()}`
      return
    }
    const data = await res.json()
    dish.value = data.dish
    language.value = data.language
    recipe.value = data.recipe
    assessment.value = data.assessment
    if (!data.available.language && data.available.recipe) tab.value = 'recipe'
  } catch (err) {
    error.value = String(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="wrap">
    <button class="back" @click="router.back()">← 返回</button>

    <p v-if="loading" class="hint">加载中…</p>
    <p v-if="error" class="err">{{ error }}</p>

    <template v-if="dish">
      <header>
        <h1>{{ dish.name_zh || dish.name }}</h1>
        <p class="sub">
          {{ dish.region }}<template v-if="dish.method"> · {{ dish.method }}</template>
          <template v-if="dish.reference_price !== null"> · ¥{{ dish.reference_price }}</template>
        </p>
      </header>

      <div v-if="assessment" class="verdict">
        <span :class="['badge', assessment.level]">{{ LEVEL_TEXT[assessment.level] }}</span>
        <ul>
          <li v-for="r in assessment.reasons" :key="r">{{ r }}</li>
        </ul>
        <p class="cites">依据：{{ assessment.citations.join('；') }}</p>
      </div>

      <div class="agent">
        <button class="btn" :disabled="agentBusy" @click="askAgent">
          {{ agentBusy ? '正在查…（它会自己决定查什么）' : '问问它为什么' }}
        </button>

        <p v-if="agentBusy" class="hint">模型正在决定调用哪个工具，通常 5–15 秒</p>
        <p v-if="agentError" class="err">{{ agentError }}</p>

        <div v-if="agentAnswer" class="agent-body">
          <p class="answer">{{ agentAnswer }}</p>

          <details :open="showTrace" class="trace">
            <summary>调用链（{{ agentTrace.length }} 次工具调用 · {{ agentRounds }} 轮）</summary>
            <div v-for="(t, i) in agentTrace" :key="i" class="trace-row">
              <span class="idx">{{ i + 1 }}</span>
              <code class="tool">{{ t.tool }}</code>
              <span class="preview">{{ t.preview }}</span>
              <span class="ms">{{ t.ms }}ms</span>
            </div>
          </details>
        </div>
      </div>

      <p v-if="dish.ingredients.length" class="ing">
        食材：{{ (dish.ingredients_zh.length ? dish.ingredients_zh : dish.ingredients).join('、') }}
      </p>
      <p v-if="dish.allergens.length" class="warn">⚠ 可能含：{{ dish.allergens.join('、') }}</p>

      <nav class="tabs">
        <button :class="{ on: tab === 'language' }" :disabled="!language" @click="tab = 'language'">
          语言视角
        </button>
        <button :class="{ on: tab === 'recipe' }" :disabled="!recipe" @click="tab = 'recipe'">
          复刻视角
        </button>
      </nav>

      <section v-if="tab === 'language' && language" class="card">
        <h3>这是什么</h3>
        <p>{{ language.what_it_is }}</p>
        <h3>怎么点</h3>
        <p class="quote">{{ language.how_to_order }}</p>
        <h3>来点文化</h3>
        <p>{{ language.culture }}</p>
      </section>

      <section v-if="tab === 'recipe' && recipe" class="card">
        <p class="meta">
          {{ recipe.difficulty }} · 约 {{ recipe.time_min }} 分钟 · {{ recipe.serves }} 人份
        </p>

        <h3>备料</h3>
        <ul class="ings">
          <li v-for="i in recipe.ingredients" :key="i.name">
            <span>{{ i.name }}</span><span class="amt">{{ i.amount }}</span>
          </li>
        </ul>

        <h3>步骤</h3>
        <ol class="steps">
          <li v-for="(s, idx) in recipe.steps" :key="idx">{{ s }}</li>
        </ol>

        <template v-if="recipe.substitutions.length">
          <h3>能不能换料</h3>
          <div v-for="s in recipe.substitutions" :key="s.from + s.to" class="sub">
            <p class="sub-line">{{ s.from }} → <strong>{{ s.to }}</strong></p>
            <p class="sub-for">适用于：{{ s.for }}</p>
            <p class="sub-note">{{ s.note }}</p>
          </div>
        </template>

        <h3>要点</h3>
        <ul class="tips">
          <li v-for="t in recipe.tips" :key="t">{{ t }}</li>
        </ul>

        <p class="allergen">{{ recipe.allergen_note }}</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 20px 80px;
  font-family: system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  color: #1f2937;
}
.back {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 13px;
  padding: 0 0 12px;
}
h1 {
  font-size: 24px;
  margin: 0 0 6px;
}
.sub {
  color: #6b7280;
  font-size: 13px;
  margin: 0 0 16px;
}
.verdict {
  border-radius: 10px;
  background: #f9fafb;
  padding: 12px 14px;
  margin-bottom: 14px;
}
.verdict ul {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 13px;
}
.badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}
.badge.safe { background: #ecfdf5; color: #047857; }
.badge.caution { background: #fffbeb; color: #b45309; }
.badge.forbidden { background: #fef2f2; color: #b91c1c; }
.ing, .warn { font-size: 13px; margin: 6px 0; }
.warn { color: #b91c1c; }
.cites { margin: 8px 0 0; font-size: 12px; color: #9ca3af; }
.tabs {
  display: flex;
  gap: 8px;
  margin: 18px 0 12px;
}
.tabs button {
  flex: 1;
  padding: 9px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}
.tabs button.on {
  background: #111827;
  color: #fff;
  border-color: #111827;
}
.tabs button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 18px;
}
h3 {
  font-size: 14px;
  margin: 16px 0 6px;
  color: #111827;
}
h3:first-child { margin-top: 0; }
.card p { font-size: 14px; line-height: 1.75; margin: 0; color: #374151; }
.quote {
  border-left: 3px solid #e5e7eb;
  padding-left: 10px;
  color: #4b5563;
}
.meta { font-size: 13px; color: #6b7280; }
.ings { list-style: none; padding: 0; margin: 0; font-size: 13px; }
.ings li {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px dashed #f1f3f5;
}
.amt { color: #9ca3af; }
.steps { font-size: 13px; line-height: 1.8; padding-left: 20px; color: #374151; }
.sub {
  border: 1px solid #eef0f3;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.sub-line { font-size: 13px; }
.sub-for { font-size: 12px; color: #6b7280; }
.sub-note { font-size: 12px; color: #9ca3af; }
.tips { font-size: 13px; padding-left: 20px; color: #374151; line-height: 1.8; }
.allergen {
  margin-top: 14px !important;
  font-size: 12px !important;
  color: #9ca3af !important;
  background: #f9fafb;
  padding: 10px;
  border-radius: 8px;
}
.hint { color: #6b7280; font-size: 13px; }
.agent {
  margin: 14px 0;
}
.agent-body {
  margin-top: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fcfdfe;
}
.answer {
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.75;
  margin: 0;
}
.trace {
  margin-top: 10px;
  font-size: 13px;
}
.trace summary {
  cursor: pointer;
  color: #6b7280;
}
.trace-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 0;
  border-top: 1px dashed #eef0f3;
  font-size: 12px;
}
.idx {
  color: #9ca3af;
  width: 14px;
}
.tool {
  font-family: Consolas, monospace;
  background: #eef2ff;
  color: #3730a3;
  padding: 1px 6px;
  border-radius: 5px;
}
.preview {
  flex: 1;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ms {
  color: #9ca3af;
}
.err { color: #b91c1c; font-size: 13px; white-space: pre-wrap; }
</style>

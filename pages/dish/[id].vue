<script setup lang="ts">
import type { Dish, DishAssessment } from '~/shared/types'
import { describeError } from '~/composables/errors'

const route = useRoute()
const router = useRouter()


function goBack() {
  if (window.history.length > 1) router.back()
  else navigateTo('/cities')
}

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


const subline = computed(() => {
  const d = dish.value
  if (!d) return ''
  const bits = [d.region]
  if (d.method) bits.push(d.method)
  if (d.reference_price !== null) bits.push(`¥${d.reference_price}`)
  return bits.join(' · ')
})


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
      agentError.value = describeError(res, '把它问明白')
      return
    }
    const data = (await res.json()) as { answer: string; trace: TraceRow[] }
    agentAnswer.value = data.answer
    agentTrace.value = data.trace ?? []
  } catch (err) {
    agentError.value = describeError(err, '把它问明白')
  } finally {
    agentBusy.value = false
  }
}

onMounted(async () => {
  const id = String(route.params.id ?? '')
  try {
    const deviceId = localStorage.getItem('shijian_device_id') ?? ''
    const res = await fetch(`/api/dishes/${encodeURIComponent(id)}?deviceId=${encodeURIComponent(deviceId)}`)
    if (!res.ok) {
      error.value = describeError(res, '打开这道菜')
      return
    }
    const data = await res.json()
    dish.value = data.dish
    language.value = data.language
    recipe.value = data.recipe
    assessment.value = data.assessment
    if (!data.available.language && data.available.recipe) tab.value = 'recipe'
  } catch (err) {
    error.value = describeError(err, '打开这道菜')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="wrap wrap--read">
    <button class="back" @click="goBack">← 返回</button>

    <p v-if="loading" class="hint">加载中…</p>
    <p v-if="error" class="err">{{ error }}</p>

    <template v-if="dish">
      <PageHead kicker="菜品判断" :title="dish.name_zh || dish.name" :lede="subline" />


      <section v-if="assessment" class="verdict">
        <VerdictBadge :level="assessment.level" />
        <ul class="verdict__reasons">
          <li v-for="r in assessment.reasons" :key="r">{{ r }}</li>
        </ul>
        <p class="verdict__cite">依据：{{ assessment.citations.join('；') }}</p>
      </section>


      <section v-if="dish.ingredients.length || dish.allergens.length" class="facts">
        <p v-if="dish.ingredients.length">
          <span class="facts__k">食材</span>
          {{ (dish.ingredients_zh.length ? dish.ingredients_zh : dish.ingredients).join('、') }}
        </p>
        <p v-if="dish.allergens.length" class="facts__warn">
          <span class="facts__k">可能含</span>
          {{ dish.allergens.join('、') }}
        </p>
      </section>


      <section class="agent">
        <button class="btn btn--ghost btn--sm" :disabled="agentBusy" @click="askAgent">
          {{ agentBusy ? '正在查…' : '问问它为什么' }}
        </button>
        <p v-if="agentBusy" class="hint">正在翻你的档案和食材资料，大概半分钟</p>
        <p v-if="agentError" class="err">{{ agentError }}</p>

        <div v-if="agentAnswer" class="agent__body">
          <p class="agent__answer">{{ agentAnswer }}</p>

          <details :open="showTrace" class="trace">
            <summary>它刚才翻了这些（{{ agentTrace.length }} 次）</summary>
            <div v-for="(t, i) in agentTrace" :key="i" class="trace__row">
              <span class="trace__idx">{{ i + 1 }}</span>
              <code class="trace__tool">{{ t.tool }}</code>
              <span class="trace__preview">{{ t.preview }}</span>
              <span class="trace__ms">{{ t.ms }}ms</span>
            </div>
          </details>
        </div>
      </section>


      <nav class="tabs">
        <button
          :class="{ on: tab === 'language' }"
          :disabled="!language"
          :title="language ? '' : '这道菜还没有语言视角的资料'"
          @click="tab = 'language'"
        >
          语言视角
        </button>
        <button
          :class="{ on: tab === 'recipe' }"
          :disabled="!recipe"
          :title="recipe ? '' : '这道菜还没有复刻的资料'"
          @click="tab = 'recipe'"
        >
          复刻视角
        </button>
      </nav>

      <section v-if="tab === 'language' && language" class="paper">
        <h3>这是什么</h3>
        <p>{{ language.what_it_is }}</p>
        <h3>怎么点</h3>
        <p class="quote">{{ language.how_to_order }}</p>
        <h3>来点文化</h3>
        <p>{{ language.culture }}</p>
      </section>

      <section v-if="tab === 'recipe' && recipe" class="paper">
        <p class="paper__meta">
          {{ recipe.difficulty }} · 约 {{ recipe.time_min }} 分钟 · {{ recipe.serves }} 人份
        </p>

        <h3>备料</h3>
        <ul class="ings">
          <li v-for="i in recipe.ingredients" :key="i.name">
            <span>{{ i.name }}</span><span class="ings__amt">{{ i.amount }}</span>
          </li>
        </ul>

        <h3>步骤</h3>
        <ol class="steps">
          <li v-for="(s, idx) in recipe.steps" :key="idx">{{ s }}</li>
        </ol>

        <template v-if="recipe.substitutions.length">
          <h3>能不能换料</h3>
          <div v-for="s in recipe.substitutions" :key="s.from + s.to" class="sub">
            <p class="sub__line">{{ s.from }} → <strong>{{ s.to }}</strong></p>
            <p class="sub__for">适用于：{{ s.for }}</p>
            <p class="sub__note">{{ s.note }}</p>
          </div>
        </template>

        <h3>要点</h3>
        <ul class="tips">
          <li v-for="t in recipe.tips" :key="t">{{ t }}</li>
        </ul>

        <p class="paper__allergen">{{ recipe.allergen_note }}</p>
      </section>
    </template>
  </main>
</template>

<style scoped>

.back {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
  padding: 0 0 8px;
}


.verdict {
  padding: 20px 22px;
  border: 2px solid var(--line);
  border-radius: var(--radius);
  background: var(--lifted);
}

.verdict__reasons {
  margin: 12px 0 0;
  padding-left: 18px;
  font-size: 15px;
  line-height: 1.8;
  color: var(--ink);
}

.verdict__cite {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--muted);
}


.facts {
  margin-top: 20px;
  padding: 0 22px;
  font-size: 14px;
  line-height: 1.9;
  color: var(--ink-muted);
}

.facts__k {
  display: inline-block;
  min-width: 3.6em;
  margin-right: 6px;
  color: var(--sepia);
  letter-spacing: 0.08em;
}

.facts__warn {
  color: var(--brick);
}

.facts__warn .facts__k {
  color: var(--brick);
}


.agent {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 2px solid var(--line);
}

.agent .hint,
.agent .err {
  margin-top: 10px;
}

.agent__body {
  margin-top: 16px;
}

.agent__answer {
  white-space: pre-wrap;
  font-size: 15px;
  line-height: 1.85;
  margin: 0;
  color: var(--ink);
}

.trace {
  margin-top: 14px;
  font-size: 12px;
}

.trace summary {
  cursor: pointer;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.trace__row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 0;
  border-top: 1px dashed var(--line);
}

.trace__idx {
  width: 14px;
  color: var(--muted);
}

.trace__tool {
  font-family: Consolas, monospace;
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--cream);
  color: var(--sepia);
}

.trace__preview {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
}

.trace__ms {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}


.tabs {
  display: flex;
  gap: 8px;
  margin: 28px 0 16px;
}

.tabs button {
  flex: 1;
  padding: 11px;
  border: 2px solid var(--line);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ink-muted);
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 0.1em;
  transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease),
    color var(--dur) var(--ease);
}

.tabs button:hover {
  border-color: var(--sepia);
  color: var(--sepia);
}

.tabs button.on {
  border-color: var(--sepia);
  background: var(--sepia);
  color: var(--cream);
}


.tabs button:disabled {
  border-style: dashed;
  color: var(--muted);
  opacity: 0.6;
  cursor: not-allowed;
}

.tabs button:disabled:hover {
  border-color: var(--line);
  color: var(--muted);
}

.paper {
  margin-top: 4px;
  padding: 22px 24px;
  border: 2px solid var(--line);
  border-radius: var(--radius);
  background: var(--lifted);
}

.paper p {
  margin: 0;
  font-size: 15px;
  line-height: 1.85;
  color: var(--ink);
}

h3 {
  margin: 22px 0 8px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: var(--sepia);
}

h3:first-child {
  margin-top: 0;
}

.paper__meta {
  margin-bottom: 12px !important;
  font-size: 13px !important;
  color: var(--muted) !important;
}

.quote {
  padding-left: 12px;
  border-left: 3px solid var(--line-strong);
}

.ings {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 14px;
}

.ings li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
  border-bottom: 1px dashed var(--line);
}

.ings__amt {
  color: var(--muted);
}

.steps {
  margin: 0;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.9;
  color: var(--ink);
}

.sub {
  padding: 12px 14px;
  margin-bottom: 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.sub__line {
  font-size: 14px !important;
}

.sub__for,
.sub__note {
  margin-top: 4px !important;
  font-size: 13px !important;
  color: var(--muted) !important;
}

.tips {
  margin: 0;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.9;
  color: var(--ink);
}

.paper__allergen {
  margin-top: 18px !important;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--cream);
  font-size: 13px !important;
  line-height: 1.8 !important;
  color: var(--muted) !important;
}
</style>

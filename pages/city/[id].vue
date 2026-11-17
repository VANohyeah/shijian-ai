<script setup lang="ts">
import { describeError } from '~/composables/errors'
import { useDeviceId, useProfile } from '~/composables/useProfile'
import type { Dish, DishAssessment, Taste } from '~/shared/types'
import { LEVEL_LABEL, TASTE_OPTIONS, tasteLabel } from '~/shared/types'

const route = useRoute()
const { deviceId, ensure } = useDeviceId()
const { profile, load: loadProfile } = useProfile()

const city = ref<{ name: string; region: string; intro: string } | null>(null)
const dishes = ref<Dish[]>([])
const assessments = ref<Record<string, DishAssessment>>({})
const favorites = ref<Dish[]>([])
const summary = ref<{ total: number; safe: number; caution: number; forbidden: number } | null>(null)
const error = ref('')
const loading = ref(true)

onMounted(async () => {
  ensure()
  await loadProfile()
  await load()
  await refreshFavs()
})

async function refreshFavs() {
  try {
    const res = await fetch(`/api/user/data?deviceId=${encodeURIComponent(deviceId.value)}`)
    if (res.ok) favorites.value = ((await res.json()).favorites ?? []) as Dish[]
  } catch {

  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const id = String(route.params.id ?? '')
    const res = await fetch(`/api/cities/${encodeURIComponent(id)}/dishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: profile.value })
    })
    if (!res.ok) {
      error.value = describeError(res, '拿这座城市的菜')
      return
    }
    const data = (await res.json()) as {
      city: { name: string; region: string; intro: string }
      dishes: Dish[]
      assessments: DishAssessment[] | null
      summary: typeof summary.value
    }
    city.value = data.city
    dishes.value = data.dishes
    summary.value = data.summary
    const map: Record<string, DishAssessment> = {}
    for (const a of data.assessments ?? []) map[a.dish_id] = a
    assessments.value = map

    await fetch('/api/user/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: deviceId.value,
        source: 'city',
        title: data.city.name + ' · 本地特色菜',
        dishes: data.dishes,
        summary: data.summary
      })
    }).catch(() => {})

    startTalk()
  } catch (err) {
    error.value = describeError(err, '拿这座城市的菜')
  } finally {
    loading.value = false
  }
}

const allOpen = ref(false)
const allHeight = ref(0)
const allInner = ref<HTMLElement | null>(null)

async function toggleAll() {
  if (!allOpen.value) {
    await nextTick()
    allHeight.value = allInner.value?.scrollHeight ?? 0
  }
  allOpen.value = !allOpen.value
}

interface Line {
  who: 'bot' | 'me'
  text: string

  kind?: 'ask' | 'think'
  tag?: string
}

interface OrderResult {
  plan: { dish: Dish; assessment: DishAssessment }[]
  total: number
  count: number
  people: number
  budget: number | null
  excluded: { dish: Dish; level: string; reasons: string[] }[]
  notes: string[]
  summary: { safe: number; caution: number }
  think: string
  thinkBy: 'ai' | 'rule'
}

const lines = ref<Line[]>([])

const step = ref(0)
const people = ref(2)
const taste = ref<Taste>('any')
const budget = ref<number | null>(null)
const order = ref<OrderResult | null>(null)
const ordering = ref(false)

let talkToken = 0

const PEOPLE_OPTIONS = [2, 3, 4, 6]
const BUDGET_OPTIONS: (number | null)[] = [150, 250, 400, null]

function say(who: 'bot' | 'me', text: string, kind?: 'ask' | 'think', tag?: string) {
  lines.value.push({ who, text, kind, tag })
}

function startTalk() {
  talkToken += 1
  lines.value = []
  order.value = null
  step.value = 0
  budget.value = null
  taste.value = 'any'
  people.value = 2

  allOpen.value = false
  say('bot', '来，配一桌。先说几个人？')
}

function pickPeople(n: number) {
  people.value = n
  say('me', `${n} 个人`)
  step.value = 1
  say('bot', '想吃什么口？')
}

function pickTaste(t: Taste) {
  taste.value = t
  say('me', TASTE_OPTIONS.find((o) => o.value === t)?.label ?? '')
  step.value = 2
  say('bot', '预算大概多少？')
}

async function pickBudget(b: number | null) {
  budget.value = b
  say('me', b === null ? '不限' : `${b} 元以内`)
  step.value = 3


  const money = b === null ? '预算不限' : `${b} 元`
  say(
    'bot',
    `我看看这城的 ${dishes.value.length} 道菜：${people.value} 个人，${tasteLabel(taste.value)}，${money}。`,
    'think',
    '它在算'
  )

  await runOrder()
}

async function runOrder() {
  if (ordering.value || !dishes.value.length) return
  const myToken = talkToken
  ordering.value = true
  try {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: deviceId.value,
        dishes: dishes.value,
        people: people.value,
        taste: taste.value,
        budget: budget.value,
        profile: profile.value
      })
    })
    if (!res.ok) {
      say('bot', describeError(res, '配这一桌'))
      return
    }
    const data = (await res.json()) as OrderResult

    if (myToken !== talkToken) return
    order.value = data
    say('bot', data.think, 'think', data.thinkBy === 'ai' ? '它在想' : '它在算')
  } catch (err) {
    say('bot', describeError(err, '配这一桌'))
  } finally {
    ordering.value = false
  }
}

async function toggleFav(dish: Dish) {
  const exists = favorites.value.some((f) => f.id === dish.id)
  const res = await fetch('/api/user/favorite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: deviceId.value, dish, action: exists ? 'remove' : 'add' })
  })
  if (res.ok) favorites.value = ((await res.json()).favorites ?? []) as Dish[]
}
</script>

<template>
  <main class="wrap wrap--read">
    <PageHead
      back-to="/cities"
      back-label="全部城市"
      kicker="地域菜"
      :title="city?.name ?? '城市'"
      :lede="city?.intro"
    />

    <p v-if="loading" class="hint">正在翻这座城的菜单…</p>
    <p v-if="error" class="err">{{ error }}</p>


    <section v-if="dishes.length" class="talk" aria-label="配一桌">
      <div
        v-for="(l, i) in lines"
        :key="i"
        :class="['bubble', l.who, l.kind === 'think' ? 'is-think' : '']"
      >
        <span v-if="l.tag" class="think-tag">{{ l.tag }}</span>
        <TypingText
          v-if="l.who === 'bot'"
          :text="l.text"
          :speed="l.kind === 'think' ? 22 : 28"
        />
        <template v-else>{{ l.text }}</template>
      </div>

      <div v-if="step === 0" class="opts">
        <button v-for="n in PEOPLE_OPTIONS" :key="n" class="opt" @click="pickPeople(n)">
          {{ n }} 个人
        </button>
      </div>
      <div v-else-if="step === 1" class="opts">
        <button v-for="o in TASTE_OPTIONS" :key="o.value" class="opt" @click="pickTaste(o.value)">
          {{ o.label }}
        </button>
      </div>
      <div v-else-if="step === 2" class="opts">
        <button
          v-for="b in BUDGET_OPTIONS"
          :key="String(b)"
          class="opt"
          :disabled="ordering"
          @click="pickBudget(b)"
        >
          {{ b === null ? '不限' : b + ' 元以内' }}
        </button>
      </div>
    </section>


    <section v-if="order && order.count" class="menu">
      <header class="menu__head">
        <p class="menu__kicker">{{ city?.name }} · {{ order.people }} 人</p>
        <h2 class="menu__title">今晚这一桌</h2>
      </header>

      <ul class="menu__list">
        <li
          v-for="(p, idx) in order.plan"
          :key="p.dish.id"
          class="menu__row"
          :style="{ '--stagger-index': idx }"
        >
          <span class="menu__name">{{ p.dish.name }}</span>
          <VerdictBadge :level="p.assessment.level" />
          <span class="menu__price">¥{{ p.dish.reference_price ?? '—' }}</span>
        </li>
      </ul>

      <footer class="menu__foot">
        <span>合计 ¥{{ order.total }}</span>
        <span v-if="order.budget !== null">预算 ¥{{ order.budget }}，还剩 ¥{{ order.budget - order.total }}</span>
      </footer>

      <p v-for="n in order.notes" :key="n" class="hint">{{ n }}</p>
      <button class="btn ghost menu__again" @click="startTalk">再配一桌</button>
    </section>


    <section v-if="order && order.count" class="all">
      <button class="all__toggle" type="button" :aria-expanded="allOpen" @click="toggleAll">
        <span class="all__mark" aria-hidden="true">{{ allOpen ? '－' : '＋' }}</span>
        {{ allOpen ? '收起' : `再看看这 ${dishes.length} 道` }}
      </button>

      <div
        class="all__panel"
        :class="{ 'is-open': allOpen }"
        :style="{ '--sk-content-height': (allHeight || 600) + 'px' }"
      >
        <div ref="allInner" class="all__inner">
          <p v-if="summary" class="summary">
            共 {{ summary.total }} 道：{{ LEVEL_LABEL.safe }} {{ summary.safe }} ·
            {{ LEVEL_LABEL.caution }} {{ summary.caution }} · {{ LEVEL_LABEL.forbidden }}
            {{ summary.forbidden }}
          </p>

          <DishCard
            v-for="d in dishes"
            :key="d.id"
            :dish="d"
            :assessment="assessments[d.id]"
            :faved="favorites.some((f) => f.id === d.id)"
            @toggle-fav="toggleFav"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>

.talk {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 6px 0 20px;
}

.bubble {
  max-width: 34em;
  padding: 11px 15px;
  border-radius: var(--radius);
  font-size: 15px;
  line-height: 1.7;
}

.bubble.bot {
  align-self: flex-start;
  background: var(--lifted);
  border: 1px solid var(--line);
}

.bubble.me {
  align-self: flex-end;
  background: var(--sepia);
  color: var(--cream);
}

.bubble.is-think {
  border-style: dashed;
  color: var(--muted);
}

.think-tag {
  display: inline-block;
  margin-right: 8px;
  padding: 1px 7px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--sepia);
  vertical-align: 1px;
}

.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 2px 0 6px;
}

.opt {
  padding: 9px 16px;
  border: 2px solid var(--line);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 0.04em;
  transition: border-color var(--dur) var(--ease), background-color var(--dur) var(--ease);
}

.opt:hover {
  border-color: var(--sepia);
  background: var(--lifted);
}

.opt:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.menu {
  margin: 0 0 28px;
  padding: 24px 26px 20px;
  border: 2px solid var(--sepia);
  border-radius: var(--radius);
  background: var(--lifted);
}

.menu__head {
  padding-bottom: 12px;
  margin-bottom: 6px;
  border-bottom: 2px solid var(--sepia);
}

.menu__kicker {
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--muted);
}

.menu__title {
  margin-top: 6px;
  font-size: 26px;
  letter-spacing: 0.14em;
}

.menu__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.menu__row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed var(--line);

  opacity: 0;
  animation: stagger-in 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--stagger-index, 0) * 70ms + 200ms);
}

@keyframes stagger-in {
  from {
    opacity: 0;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .menu__row {
    animation: none;
    opacity: 1;
    transform: none;
  }
}

.menu__name {
  flex: 1;
  font-family: var(--serif);
  font-size: 16px;
  color: var(--ink);
}

.menu__price {
  flex: none;
  font-size: 13px;
  color: var(--olive);
  font-variant-numeric: tabular-nums;
}

.menu__foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 20px;
  margin-top: 14px;
  font-size: 14px;
  color: var(--ink);
}

.menu__again {
  margin-top: 16px;
}

.all {
  margin-top: 8px;
}

.all__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 0;
  border: 0;
  border-top: 2px solid var(--line);
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  transition: color var(--dur) var(--ease);
}

.all__toggle:hover {
  color: var(--sepia);
}

.all__mark {
  color: var(--sepia);
  font-size: 15px;
}

.all__panel {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  transition: max-height 350ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 350ms cubic-bezier(0.4, 0, 0.2, 1), padding 350ms cubic-bezier(0.4, 0, 0.2, 1);
}

.all__panel.is-open {
  max-height: var(--sk-content-height, 600px);
  opacity: 1;
  padding-top: 8px;
  padding-bottom: 12px;
}

.all__inner {
  min-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .all__panel {
    transition: none;
  }
}

.summary {
  margin: 10px 0;
  font-size: 13px;
  color: var(--ink);
  background: var(--cream);
  padding: 9px 12px;
  border-radius: var(--radius);
}
</style>

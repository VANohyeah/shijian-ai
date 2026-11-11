<script setup lang="ts">
import type { Dish, DishAssessment } from '~/shared/types'

const route = useRoute()
const { deviceId, ensure } = useDeviceId()
const { profile, load: loadProfile } = useProfile()

const city = ref<{ name: string; region: string; intro: string } | null>(null)
const dishes = ref<Dish[]>([])
const assessments = ref<Record<string, DishAssessment>>({})
const favorites = ref<Dish[]>([])
const summary = ref<{ total: number; safe: number; caution: number; forbidden: number } | null>(null)

const people = ref(2)
const budget = ref(200)
const plan = ref<{ count: number; total: number; plan: { dish: Dish; assessment: DishAssessment }[]; excluded: unknown[]; notes: string[]; summary: { safe: number; caution: number } } | null>(null)
const planning = ref(false)
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
    /* 忽略 */
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
      error.value = 'HTTP ' + res.status + '：' + (await res.text())
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
  } catch (err) {
    error.value = String(err)
  } finally {
    loading.value = false
  }
}

async function makePlan() {
  if (!dishes.value.length || planning.value) return
  planning.value = true
  plan.value = null
  try {
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: deviceId.value,
        dishes: dishes.value,
        people: people.value,
        budget: budget.value,
        profile: profile.value
      })
    })
    if (res.ok) plan.value = await res.json()
  } finally {
    planning.value = false
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
  <main class="wrap">
    <NuxtLink to="/cities" class="muted">← 全部城市</NuxtLink>

    <h1 v-if="city">{{ city.name }}</h1>
    <p v-if="city" class="muted">{{ city.intro }}</p>

    <p v-if="loading" class="hint">加载中…</p>
    <p v-if="error" class="err">{{ error }}</p>

    <p v-if="summary" class="summary">
      共 {{ summary.total }} 道：可以吃 {{ summary.safe }} · 注意 {{ summary.caution }} · 别点
      {{ summary.forbidden }}
    </p>

    <div class="card">
      <div class="row">
        <span class="muted">配一桌：</span>
        <input v-model.number="people" type="number" min="1" max="10" class="input" style="width: 64px" />
        <span class="muted">人，预算</span>
        <input v-model.number="budget" type="number" step="20" class="input" style="width: 84px" />
        <span class="muted">元</span>
        <button class="btn" :disabled="planning || !dishes.length" @click="makePlan">
          {{ planning ? '正在配…' : '帮我配一桌' }}
        </button>
      </div>

      <div v-if="plan" style="margin-top: 12px">
        <p class="summary">
          配了 {{ plan.count }} 道 · 合计 ¥{{ plan.total }} · 可吃 {{ plan.summary.safe }} · 注意
          {{ plan.summary.caution }}
        </p>
        <div v-for="p in plan.plan" :key="p.dish.id" class="mini">
          <div>
            <strong>{{ p.dish.name }}</strong>
            <span class="orig">¥{{ p.dish.reference_price }}</span>
          </div>
          <VerdictBadge :level="p.assessment.level" />
        </div>
        <p v-if="plan.excluded.length" class="hint">
          已剔除 {{ plan.excluded.length }} 道：命中过敏或忌口
        </p>
        <p v-for="n in plan.notes" :key="n" class="hint">{{ n }}</p>
      </div>
    </div>

    <DishCard
      v-for="d in dishes"
      :key="d.id"
      :dish="d"
      :assessment="assessments[d.id]"
      :faved="favorites.some((f) => f.id === d.id)"
      @toggle-fav="toggleFav"
    />
  </main>
</template>

<style scoped>
.summary {
  margin: 10px 0;
  font-size: 13px;
  color: #374151;
  background: #f9fafb;
  padding: 9px 12px;
  border-radius: 9px;
}
</style>

<script setup lang="ts">
import { describeError } from '~/composables/errors'
import { useDeviceId, useProfile } from '~/composables/useProfile'
import type { Dish, RiskLevel } from '~/shared/types'
import { LEVEL_LABEL } from '~/shared/types'

interface HistoryEntry {
  id: string
  createdAt: string
  source: 'photo' | 'city'
  title: string
  dishes: Dish[]
  summary: { total: number; safe: number; caution: number; forbidden: number } | null
}

const { deviceId, ensure } = useDeviceId()
const { profile, load: loadProfile } = useProfile()

const favorites = ref<Dish[]>([])
const history = ref<HistoryEntry[]>([])
const error = ref('')
const loading = ref(true)

const openId = ref('')

const detail = ref<Record<string, Record<string, { level: RiskLevel; reasons: string[] }>>>({})
const detailLoading = ref('')
const detailError = ref('')

onMounted(async () => {
  ensure()
  await loadProfile()
  await refresh()
})

async function refresh() {
  loading.value = true
  try {
    const res = await fetch(`/api/user/data?deviceId=${encodeURIComponent(deviceId.value)}`)
    if (!res.ok) {
      error.value = describeError(res, '读你的收藏')
      return
    }
    const data = (await res.json()) as { favorites: Dish[]; history: HistoryEntry[] }
    favorites.value = data.favorites ?? []
    history.value = data.history ?? []
  } catch (err) {
    error.value = describeError(err, '读你的收藏')
  } finally {
    loading.value = false
  }
}

async function unfav(dish: Dish) {
  const res = await fetch('/api/user/favorite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: deviceId.value, dish, action: 'remove' })
  })
  if (res.ok) favorites.value = ((await res.json()).favorites ?? []) as Dish[]
}

async function toggle(entry: HistoryEntry) {
  if (openId.value === entry.id) {
    openId.value = ''
    return
  }
  openId.value = entry.id
  detailError.value = ''
  if (detail.value[entry.id]) return

  detailLoading.value = entry.id
  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dishes: entry.dishes, profile: profile.value })
    })
    if (!res.ok) {
      detailError.value = describeError(res, '把这一桌重新看一遍')
      return
    }
    const data = (await res.json()) as {
      assessments: { dish_id: string; level: RiskLevel; reasons: string[] }[]
    }
    const map: Record<string, { level: RiskLevel; reasons: string[] }> = {}
    for (const a of data.assessments) map[a.dish_id] = { level: a.level, reasons: a.reasons }
    detail.value = { ...detail.value, [entry.id]: map }
  } catch (err) {
    detailError.value = describeError(err, '把这一桌重新看一遍')
  } finally {
    detailLoading.value = ''
  }
}

function fmt(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`
}
</script>

<template>
  <main class="wrap wrap--read">
    <PageHead
      back-to="/"
      back-label="回首页"
      kicker="跟着这台设备"
      title="我的"
    />

    <p v-if="loading" class="hint">正在翻…</p>
    <p v-if="error" class="err">{{ error }}</p>

    <section class="block">
      <header class="block__head">
        <h2>收藏<span class="count">{{ favorites.length }}</span></h2>
      </header>

      <p v-if="!favorites.length" class="block__empty">
        还空着。看到想留的菜，点一下卡片上的 ☆。
      </p>

      <div v-for="f in favorites" :key="f.id" class="row">
        <div class="row__main">
          <NuxtLink :to="`/dish/${f.id}`" class="dish-name">{{ f.name }}</NuxtLink>
          <span class="row__sub">
            {{ f.region }}<template v-if="f.allergens.length"> · 含 {{ f.allergens.join('、') }}</template>
          </span>
        </div>
        <button class="row__act" type="button" @click="unfav(f)">移除</button>
      </div>
    </section>

    <section class="block">
      <header class="block__head">
        <h2>历史记录<span class="count">{{ history.length }}</span></h2>
      </header>

      <p v-if="!history.length" class="block__empty">拍过的菜单、逛过的城，这儿都替你记着。</p>

      <ul class="hist">
        <li v-for="h in history" :key="h.id" class="hist__item">
          <button
            class="hist__row"
            type="button"
            :aria-expanded="openId === h.id"
            @click="toggle(h)"
          >
            <span class="hist__main">
              <strong class="hist__title">{{ h.title }}</strong>
              <span class="row__sub">
                {{ h.source === 'city' ? '地域推荐' : '拍照识别' }} · {{ fmt(h.createdAt) }}
                <template v-if="h.summary">
                  · {{ LEVEL_LABEL.safe }} {{ h.summary.safe }} / {{ LEVEL_LABEL.caution }}
                  {{ h.summary.caution }} / {{ LEVEL_LABEL.forbidden }} {{ h.summary.forbidden }}
                </template>
              </span>
            </span>
            <span class="hist__count">{{ h.dishes.length }} 道</span>
            <span class="hist__chev" :class="{ 'is-open': openId === h.id }" aria-hidden="true">›</span>
          </button>

          <div v-if="openId === h.id" class="hist__detail">
            <p v-if="detailLoading === h.id" class="hint">把这一桌重新过一遍…</p>
            <p v-else-if="detailError" class="err">{{ detailError }}</p>
            <ul v-else class="dishlist">
              <li v-for="d in h.dishes" :key="d.id" class="dishlist__row">
                <NuxtLink :to="`/dish/${d.id}`" class="dishlist__name">{{ d.name }}</NuxtLink>
                <VerdictBadge
                  v-if="detail[h.id]?.[d.id]"
                  :level="detail[h.id][d.id].level"
                />
                <span class="dishlist__price">¥{{ d.reference_price ?? '—' }}</span>
              </li>
            </ul>
            <p class="hint">判定是按你现在的档案重新算的。</p>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>

.block + .block {
  margin-top: 48px;
}

.block__head {
  padding-bottom: 12px;
  margin-bottom: 4px;
  border-bottom: 2px solid var(--line);
}

.block__head h2 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 24px;
  letter-spacing: 0.1em;
}

.count {
  font-family: var(--sans);
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.block__empty {
  padding: 16px 0 0;
  font-size: 14px;
  color: var(--muted);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}

.row__main {
  min-width: 0;
}

.row__sub {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--muted);
}

.row__act {
  flex: none;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 12px;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}

.row__act:hover {
  border-color: var(--brick);
  color: var(--brick);
}

.hist {
  list-style: none;
  margin: 0;
  padding: 0;
}

.hist__item {
  border-bottom: 1px solid var(--line);
}

.hist__row {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 18px 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.hist__row:hover .hist__title {
  color: var(--sepia);
}

.hist__main {
  flex: 1;
  min-width: 0;
}

.hist__title {
  font-family: var(--serif);
  font-weight: 500;
  font-size: 17px;
  color: var(--ink);
  transition: color var(--dur) var(--ease);
}

.hist__count {
  flex: none;
  font-size: 13px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.hist__chev {
  flex: none;
  width: 18px;
  font-size: 18px;
  line-height: 1;
  color: var(--muted);
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.hist__chev.is-open {
  transform: rotate(90deg);
  color: var(--sepia);
}

.hist__detail {
  padding: 4px 0 20px 18px;
  border-left: 2px solid var(--line);
  margin-bottom: 4px;
}

.dishlist {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
}

.dishlist__row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px dashed var(--line);
}

.dishlist__name {
  flex: 1;
  font-size: 15px;
  color: var(--ink);
  border-bottom: 1px dashed transparent;
}

.dishlist__name:hover {
  border-bottom-color: var(--line-strong);
  color: var(--sepia);
}

.dishlist__price {
  flex: none;
  font-size: 13px;
  color: var(--olive);
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .hist__chev {
    transition: none;
  }
}
</style>

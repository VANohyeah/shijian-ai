<script setup lang="ts">
import type { Dish } from '~/shared/types'

interface HistoryEntry {
  id: string
  createdAt: string
  source: 'photo' | 'city'
  title: string
  dishes: Dish[]
  summary: { total: number; safe: number; caution: number; forbidden: number } | null
}

const { deviceId, ensure } = useDeviceId()
const { load: loadProfile } = useProfile()

const favorites = ref<Dish[]>([])
const history = ref<HistoryEntry[]>([])
const error = ref('')
const loading = ref(true)

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
      error.value = 'HTTP ' + res.status
      return
    }
    const data = (await res.json()) as { favorites: Dish[]; history: HistoryEntry[] }
    favorites.value = data.favorites ?? []
    history.value = data.history ?? []
  } catch (err) {
    error.value = String(err)
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

function fmt(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`
}
</script>

<template>
  <main class="wrap">
    <h1>我的</h1>
    <p class="muted">收藏的菜和历史记录。数据跟着这台设备走。</p>

    <p v-if="loading" class="hint">加载中…</p>
    <p v-if="error" class="err">{{ error }}</p>

    <section>
      <h2>收藏（{{ favorites.length }}）</h2>
      <p v-if="!favorites.length" class="hint">还没有收藏。在菜品卡片上点 ☆。</p>
      <div v-for="f in favorites" :key="f.id" class="mini">
        <div>
          <NuxtLink :to="`/dish/${f.id}`" class="dish-name">{{ f.name }}</NuxtLink>
          <span class="orig">
            {{ f.region }}<template v-if="f.allergens.length"> · 含 {{ f.allergens.join('、') }}</template>
          </span>
        </div>
        <button class="btn ghost" style="padding: 4px 10px; font-size: 12px" @click="unfav(f)">
          移除
        </button>
      </div>
    </section>

    <section>
      <h2>历史记录（{{ history.length }}）</h2>
      <p v-if="!history.length" class="hint">识别菜单或查看城市后，这里会自动留下记录。</p>
      <div v-for="h in history" :key="h.id" class="mini">
        <div>
          <strong>{{ h.title }}</strong>
          <span class="orig">
            {{ h.source === 'city' ? '地域推荐' : '拍照识别' }} · {{ fmt(h.createdAt) }}
            <template v-if="h.summary">
              · 可吃 {{ h.summary.safe }} / 注意 {{ h.summary.caution }} / 别点 {{ h.summary.forbidden }}
            </template>
          </span>
        </div>
        <span class="muted">{{ h.dishes.length }} 道</span>
      </div>
    </section>
  </main>
</template>

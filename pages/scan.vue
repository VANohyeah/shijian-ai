<script setup lang="ts">
import type { Dish, DishAssessment } from '~/shared/types'

const { deviceId, ensure } = useDeviceId()
const { profile, load: loadProfile } = useProfile()

const dishes = ref<Dish[]>([])
const assessments = ref<Record<string, DishAssessment>>({})
const favorites = ref<Dish[]>([])
const busy = ref(false)
const error = ref('')
const preview = ref('')
const meta = ref('')

onMounted(async () => {
  ensure()
  await loadProfile()
  await refreshFavs()
})

async function refreshFavs() {
  try {
    const res = await fetch(`/api/user/data?deviceId=${encodeURIComponent(deviceId.value)}`)
    if (res.ok) {
      const data = (await res.json()) as { favorites: Dish[] }
      favorites.value = data.favorites ?? []
    }
  } catch {
    /* 收藏读不到不影响识别 */
  }
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  preview.value = URL.createObjectURL(file)
  dishes.value = []
  assessments.value = {}
  error.value = ''
  meta.value = ''
  busy.value = true

  try {
    const { base64, mime } = await compress(file)
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mime })
    })
    if (!res.ok) {
      error.value = 'HTTP ' + res.status + '：' + (await res.text())
      return
    }
    const data = (await res.json()) as { dishes: Dish[]; count: number; model: string }
    dishes.value = data.dishes ?? []
    meta.value = `识别到 ${data.count} 道 · ${data.model}`
    if (!dishes.value.length) {
      error.value = '没有识别出菜品，换张更清晰的图试试'
      return
    }

    await evaluate()
    await record()
  } catch (err) {
    error.value = String(err)
  } finally {
    busy.value = false
  }
}

async function evaluate() {
  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dishes: dishes.value, profile: profile.value })
  })
  if (!res.ok) return
  const data = (await res.json()) as {
    assessments: (DishAssessment & { references?: { title: string; source: string }[] })[]
  }
  const map: Record<string, DishAssessment> = {}
  for (const a of data.assessments) map[a.dish_id] = a
  assessments.value = map
}

async function record() {
  try {
    await fetch('/api/user/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: deviceId.value,
        source: 'photo',
        title: `${dishes.value[0]?.name ?? '菜单'} 等 ${dishes.value.length} 道`,
        dishes: dishes.value,
        summary: null
      })
    })
  } catch {
    /* 历史失败不影响主流程 */
  }
}

async function toggleFav(dish: Dish) {
  const exists = favorites.value.some((f) => f.id === dish.id)
  const res = await fetch('/api/user/favorite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: deviceId.value,
      dish,
      action: exists ? 'remove' : 'add'
    })
  })
  if (res.ok) {
    const data = (await res.json()) as { favorites: Dish[] }
    favorites.value = data.favorites
  }
}

async function compress(file: File): Promise<{ base64: string; mime: string }> {
  const bitmap = await createImageBitmap(file)
  const max = 1280
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const url = canvas.toDataURL('image/jpeg', 0.85)
  bitmap.close?.()
  return { base64: url.split(',')[1] ?? '', mime: 'image/jpeg' }
}
</script>

<template>
  <main class="wrap">
    <h1>拍菜单</h1>
    <p class="muted">拍一张菜单或外卖截图，识别后会自动按你的档案分级。</p>

    <div class="card">
      <input type="file" accept="image/*" :disabled="busy" @change="onFile" />
      <p v-if="busy" class="hint">识别中…（大模型看图，通常 5–15 秒）</p>
      <p v-if="meta" class="hint">{{ meta }}</p>
      <p v-if="error" class="err">{{ error }}</p>
      <img v-if="preview" :src="preview" class="preview" alt="菜单预览" />
    </div>

    <div v-if="dishes.length">
      <h2>识别结果</h2>
      <DishCard
        v-for="d in dishes"
        :key="d.id"
        :dish="d"
        :assessment="assessments[d.id]"
        :faved="favorites.some((f) => f.id === d.id)"
        @toggle-fav="toggleFav"
      />
    </div>
  </main>
</template>

<style scoped>
.preview {
  display: block;
  margin-top: 12px;
  max-width: 100%;
  max-height: 300px;
  border-radius: 10px;
  border: 1px solid #eee;
}
</style>

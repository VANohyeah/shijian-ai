<script setup lang="ts">
import { describeError } from '~/composables/errors'
import { useDeviceId, useProfile } from '~/composables/useProfile'
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

const editingId = ref('')
const editName = ref('')
const editIngredients = ref('')

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
  editingId.value = ''
  busy.value = true

  try {
    const { base64, mime } = await compress(file)
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mime })
    })
    if (!res.ok) {
      error.value = describeError(res, '识别这张菜单')
      return
    }
    const data = (await res.json()) as { dishes: Dish[]; count: number; model: string }
    dishes.value = data.dishes ?? []
    meta.value = `认出 ${data.count} 道菜`
    if (!dishes.value.length) {
      error.value = '这一张没认出来。换个角度，或者手端稳一点再按一次。'
      return
    }

    await evaluate()
    await record()
  } catch (err) {
    error.value = describeError(err, '识别这张菜单')
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

function startEdit(d: Dish) {
  editingId.value = d.id
  editName.value = d.name_zh || d.name
  editIngredients.value = d.ingredients.join('、')
}

function cancelEdit() {
  editingId.value = ''
}

async function saveEdit() {
  const d = dishes.value.find((x) => x.id === editingId.value)
  if (!d) return

  const name = editName.value.trim()
  if (!name) {
    error.value = '好歹给个菜名'
    return
  }
  const ings = editIngredients.value
    .split(/[、,，;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  d.name = name
  d.name_zh = name
  d.ingredients = ings
  d.ingredients_zh = ings

  d.allergens = []
  d.confidence = 1

  editingId.value = ''
  error.value = ''
  await evaluate()
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
  <main class="wrap wrap--read">
    <PageHead
      back-to="/"
      back-label="回首页"
      kicker="视觉识别"
      title="拍菜单"
    />

    <label class="drop" :class="{ 'is-busy': busy }">
      <input type="file" accept="image/*" :disabled="busy" @change="onFile" />

      <img v-if="preview" :src="preview" class="drop__shot" alt="菜单预览" />
      <template v-else>
        <span class="drop__main">{{ busy ? '正在认这张照片…' : '点一下，选张菜单' }}</span>
        <span class="drop__sub">手机拍的、外卖截图都行，十几秒出结果</span>
      </template>
    </label>

    <p v-if="meta" class="drop__meta">{{ meta }}</p>
    <p v-if="error" class="err">{{ error }}</p>

    <section v-if="dishes.length" class="result">
      <h2 class="result__title">这一桌，逐道看</h2>

      <template v-for="d in dishes" :key="d.id">
        <div v-if="editingId === d.id" class="card edit">
          <p class="hint" style="margin-top: 0">菜名或料不对？几样之间用顿号隔开。</p>
          <div class="row" style="margin-bottom: 8px">
            <input v-model="editName" class="input" style="flex: 1" placeholder="菜名" />
          </div>
          <div class="row">
            <input
              v-model="editIngredients"
              class="input"
              style="flex: 1"
              placeholder="如：虾、蟹、奶酪"
            />
            <button class="btn" @click="saveEdit">保存，重看一遍</button>
            <button class="btn ghost" @click="cancelEdit">取消</button>
          </div>
        </div>

        <DishCard
          v-else
          :dish="d"
          :assessment="assessments[d.id]"
          :faved="favorites.some((f) => f.id === d.id)"
          editable
          @toggle-fav="toggleFav"
          @edit="startEdit"
        />
      </template>
    </section>
  </main>
</template>

<style scoped>

.drop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 300px;
  padding: 36px 24px;
  border: 2px dashed var(--line-strong);
  border-radius: var(--radius);
  background: var(--lifted);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), background-color var(--dur) var(--ease);
}

.drop:hover,
.drop:focus-within {
  border-color: var(--sepia);
  background: var(--cream);
}

.drop.is-busy {
  cursor: progress;
}

.drop input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.drop__main {
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: var(--sepia);
}

.drop__sub {
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.drop__shot {
  max-width: 100%;
  max-height: 320px;
  border-radius: var(--radius);
}

.drop__meta {
  margin-top: 12px;
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.result {
  margin-top: 40px;
}

.result__title {
  padding-bottom: 10px;
  margin-bottom: 18px;
  border-bottom: 2px solid var(--line);
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0.16em;
}

.edit {
  border-color: var(--sepia);
  background: var(--lifted);
}
</style>

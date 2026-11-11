<script setup lang="ts">
import type { Dish } from '~/shared/types'

/* ---------------- ① 流式对话 ---------------- */

const question = ref('用一句话介绍川菜')
const answer = ref('')
const streaming = ref(false)
const chatError = ref('')

async function send() {
  if (streaming.value || !question.value.trim()) return
  streaming.value = true
  answer.value = ''
  chatError.value = ''

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: question.value }] })
    })

    if (!res.ok || !res.body) {
      chatError.value = `HTTP ${res.status}：${await res.text()}`
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content
          if (delta) answer.value += delta
        } catch {
          /* 半包，忽略 */
        }
      }
    }
  } catch (err) {
    chatError.value = String(err)
  } finally {
    streaming.value = false
  }
}

/* ---------------- ② 菜单识别 ---------------- */

const previewUrl = ref('')
const dishes = ref<Dish[]>([])
const analyzing = ref(false)
const dishError = ref('')
const meta = ref('')

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  previewUrl.value = URL.createObjectURL(file)
  dishes.value = []
  dishError.value = ''
  meta.value = ''
  analyzing.value = true

  try {
    const { base64, mime } = await readAsBase64(file)
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mime })
    })

    if (!res.ok) {
      dishError.value = `HTTP ${res.status}：${await res.text()}`
      return
    }

    const data = (await res.json()) as { dishes: Dish[]; count: number; provider: string; model: string }
    dishes.value = data.dishes ?? []
    meta.value = `${data.provider} / ${data.model} · 识别到 ${data.count} 道`
    if (dishes.value.length === 0) dishError.value = '没有识别出菜品，换张更清晰的图试试'
    else
      await recordHistory(
        'photo',
        `${dishes.value[0]?.name ?? '菜单'} 等 ${dishes.value.length} 道`,
        dishes.value,
        null
      )
  } catch (err) {
    dishError.value = String(err)
  } finally {
    analyzing.value = false
  }
}

/**
 * 读图并压缩：长边限制 1280px、JPEG 0.85。
 * 手机原图动辄 4-5MB，直接上传会让识图多等好几秒。
 */
async function readAsBase64(file: File): Promise<{ base64: string; mime: string }> {
  const bitmap = await createImageBitmap(file)
  const max = 1280
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.drawImage(bitmap, 0, 0, w, h)

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  bitmap.close?.()
  return { base64: dataUrl.split(',')[1] ?? '', mime: 'image/jpeg' }
}

/* ---------------- ③ 健康评估 ---------------- */

const ALLERGEN_OPTIONS = ['含麸质谷物', '甲壳类', '鱼类', '蛋类', '花生', '大豆', '乳制品', '坚果', '贝类/软体', '芝麻', '酒精', '亚硫酸盐']
const CONDITION_OPTIONS = ['痛风', '高血压', '糖尿病', '肾病', '孕期']

const profile = reactive({
  allergens: [] as string[],
  conditions: [] as string[],
  goal: 'none'
})

interface Assessment {
  dish_id: string
  level: 'safe' | 'caution' | 'forbidden'
  reasons: string[]
  citations: string[]
  suggestion: string | null
}

const assessments = ref<Record<string, Assessment>>({})
const summary = ref<{ total: number; safe: number; caution: number; forbidden: number } | null>(null)
const assessing = ref(false)
const assessError = ref('')

async function assess() {
  if (!dishes.value.length || assessing.value) return
  assessing.value = true
  assessError.value = ''
  summary.value = null

  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dishes: dishes.value, profile })
    })
    if (!res.ok) {
      assessError.value = `HTTP ${res.status}：${await res.text()}`
      return
    }
    const data = (await res.json()) as { assessments: Assessment[]; summary: typeof summary.value }
    const map: Record<string, Assessment> = {}
    for (const a of data.assessments) map[a.dish_id] = a
    assessments.value = map
    summary.value = data.summary
  } catch (err) {
    assessError.value = String(err)
  } finally {
    assessing.value = false
  }
}

const LEVEL_TEXT = { safe: '✅ 可以吃', caution: '⚠️ 注意', forbidden: '⛔ 别点' } as const

/* ---------------- ④ 地域推荐 ---------------- */

interface CityInfo {
  id: string
  name: string
  area: string
  region: string
  intro: string
  dishCount: number
}

const cities = ref<CityInfo[]>([])
const areas = ref<string[]>([])
const selectedCity = ref('')
const cityDishes = ref<Dish[]>([])
const cityAssessments = ref<Record<string, Assessment>>({})
const citySummary = ref<{ total: number; safe: number; caution: number; forbidden: number } | null>(null)
const cityLoading = ref(false)
const cityError = ref('')

onMounted(async () => {
  ensureDeviceId()
  await Promise.all([refreshUserData(), loadProfileFromServer()])
  try {
    const res = await fetch('/api/cities')
    const data = (await res.json()) as { cities: CityInfo[]; areas: string[] }
    cities.value = data.cities
    areas.value = data.areas
  } catch (err) {
    cityError.value = '城市列表加载失败：' + String(err)
  }
})

async function loadCity() {
  if (!selectedCity.value || cityLoading.value) return
  cityLoading.value = true
  cityError.value = ''
  citySummary.value = null

  try {
    const res = await fetch('/api/cities/' + selectedCity.value + '/dishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: selectedCity.value, profile })
    })
    if (!res.ok) {
      cityError.value = `HTTP ${res.status}：${await res.text()}`
      return
    }
    const data = (await res.json()) as {
      city: { name: string }
      dishes: Dish[]
      assessments: Assessment[] | null
      summary: typeof citySummary.value
    }
    cityDishes.value = data.dishes
    const map: Record<string, Assessment> = {}
    for (const a of data.assessments ?? []) map[a.dish_id] = a
    cityAssessments.value = map
    citySummary.value = data.summary

    await recordHistory(
      'city',
      `${data.city.name} · 本地特色菜`,
      data.dishes,
      data.summary ?? null
    )
  } catch (err) {
    cityError.value = String(err)
  } finally {
    cityLoading.value = false
  }
}

/* ---------------- ⑤ 收藏与历史 ---------------- */

interface FavoriteDish extends Dish {
  favoritedAt: string
}

interface HistoryEntry {
  id: string
  createdAt: string
  source: 'photo' | 'city'
  title: string
  dishes: Dish[]
  summary: { total: number; safe: number; caution: number; forbidden: number } | null
}

const deviceId = ref('')
const favorites = ref<FavoriteDish[]>([])
const history = ref<HistoryEntry[]>([])
const userError = ref('')
const favBusy = ref('')

/** 设备 ID 暂代账号：接真实登录后换成 userId，接口不用动 */
function ensureDeviceId() {
  let id = localStorage.getItem('shijian_device_id')
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    localStorage.setItem('shijian_device_id', id)
  }
  deviceId.value = id
}

async function refreshUserData() {
  if (!deviceId.value) return
  try {
    const res = await fetch(`/api/user/data?deviceId=${encodeURIComponent(deviceId.value)}`)
    if (!res.ok) return
    const data = (await res.json()) as { favorites: FavoriteDish[]; history: HistoryEntry[] }
    favorites.value = data.favorites ?? []
    history.value = data.history ?? []
  } catch (err) {
    userError.value = String(err)
  }
}

function isFav(id: string) {
  return favorites.value.some((f) => f.id === id)
}

async function toggleFavorite(d: Dish) {
  if (!deviceId.value || favBusy.value) return
  favBusy.value = d.id
  try {
    const res = await fetch('/api/user/favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: deviceId.value,
        dish: d,
        action: isFav(d.id) ? 'remove' : 'add'
      })
    })
    if (!res.ok) {
      userError.value = `HTTP ${res.status}：${await res.text()}`
      return
    }
    const data = (await res.json()) as { favorites: FavoriteDish[] }
    favorites.value = data.favorites
  } catch (err) {
    userError.value = String(err)
  } finally {
    favBusy.value = ''
  }
}

async function recordHistory(
  source: 'photo' | 'city',
  title: string,
  dishList: Dish[],
  s: { total: number; safe: number; caution: number; forbidden: number } | null
) {
  if (!deviceId.value || !dishList.length) return
  try {
    await fetch('/api/user/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceId.value, source, title, dishes: dishList, summary: s })
    })
    await refreshUserData()
  } catch {
    /* 历史记录失败不影响主流程 */
  }
}

/* ---------------- 档案持久化 ---------------- */

const profileSaving = ref(false)
const profileHint = ref('')

async function loadProfileFromServer() {
  if (!deviceId.value) return
  try {
    const res = await fetch('/api/profile?deviceId=' + encodeURIComponent(deviceId.value))
    if (!res.ok) return
    const data = (await res.json()) as { profile: any; complete: boolean }
    if (data.complete && data.profile) {
      profile.allergens = data.profile.allergens ?? []
      profile.conditions = data.profile.conditions ?? []
      profile.goal = data.profile.goal ?? 'none'
      profileHint.value = '已读取上次保存的档案'
    }
  } catch {
    /* 读不到不影响使用 */
  }
}

async function saveProfileToServer() {
  if (!deviceId.value || profileSaving.value) return
  profileSaving.value = true
  profileHint.value = ''
  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceId.value, profile })
    })
    if (!res.ok) {
      profileHint.value = '保存失败：' + (await res.text())
      return
    }
    profileHint.value = '档案已保存，换设备前记得同步'
  } catch (err) {
    profileHint.value = String(err)
  } finally {
    profileSaving.value = false
  }
}

/* ---------------- 点菜组合 ---------------- */

const people = ref(2)
const budget = ref(200)
const plan = ref<any>(null)
const planning = ref(false)
const planError = ref('')

async function makePlan() {
  const pool = cityDishes.value.length ? cityDishes.value : dishes.value
  if (!pool.length || planning.value) return
  planning.value = true
  planError.value = ''
  plan.value = null
  try {
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: deviceId.value,
        dishes: pool,
        people: people.value,
        budget: budget.value,
        profile
      })
    })
    if (!res.ok) {
      planError.value = 'HTTP ' + res.status + '：' + (await res.text())
      return
    }
    plan.value = await res.json()
  } catch (err) {
    planError.value = String(err)
  } finally {
    planning.value = false
  }
}

function dishLink(d: Dish) {
  return '/dish/' + d.id
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}


</script>

<template>
  <main class="wrap">
    <header>
      <h1>食鉴 AI · 开发自测页</h1>
      <p class="sub">A 的 Day 1 验收：流式对话 + 菜单识别。这不是最终界面，B 会重做。</p>
    </header>

    <section class="card">
      <h2>① 流式对话</h2>
      <div class="row">
        <input v-model="question" :disabled="streaming" placeholder="问点什么" @keyup.enter="send" />
        <button :disabled="streaming" @click="send">{{ streaming ? '输出中…' : '发送' }}</button>
      </div>
      <pre v-if="answer" class="output">{{ answer }}</pre>
      <p v-if="streaming" class="hint">正在逐字返回，如果一次性蹦出全文，说明中间层做了缓冲。</p>
      <p v-if="chatError" class="err">{{ chatError }}</p>
    </section>

    <section class="card">
      <h2>② 菜单识别</h2>
      <input type="file" accept="image/*" @change="onFileChange" />
      <img v-if="previewUrl" :src="previewUrl" class="preview" alt="菜单预览" />
      <p v-if="analyzing" class="hint">识别中…</p>
      <p v-if="meta" class="hint">{{ meta }}</p>
      <p v-if="dishError" class="err">{{ dishError }}</p>

      <div v-for="(d, i) in dishes" :key="d.id" class="dish">
        <div class="dish-head">
          <div>
            <strong>{{ i + 1 }}. {{ d.name_zh || d.name }}</strong>
            <span v-if="d.name_zh && d.name_zh !== d.name" class="orig">{{ d.name }}</span>
          </div>
          <div class="head-right">
            <span v-if="d.reference_price !== null" class="price">¥{{ d.reference_price }}</span>
            <button class="fav" :disabled="favBusy === d.id" @click="toggleFavorite(d)">
              {{ isFav(d.id) ? '★ 已收藏' : '☆ 收藏' }}
            </button>
          </div>
        </div>
        <div class="tags">
          <span v-if="d.region" class="tag">{{ d.region }}</span>
          <span v-if="d.method" class="tag">{{ d.method }}</span>
          <span v-if="d.spicy_level !== null" class="tag">
            {{ ['不辣', '微辣', '中辣', '特辣'][d.spicy_level] }}
          </span>
        </div>
        <p v-if="d.ingredients.length" class="line">
          食材：{{ d.ingredients_zh.length ? d.ingredients_zh.join('、') : d.ingredients.join('、') }}
          <span v-if="d.ingredients_zh.length" class="orig">{{ d.ingredients.join(', ') }}</span>
        </p>
        <p v-if="d.allergens.length" class="line warn">⚠ 可能含：{{ d.allergens.join('、') }}</p>
        <p class="conf">置信度 {{ (d.confidence * 100).toFixed(0) }}%</p>

        <div v-if="assessments[d.id]" class="assess">
          <span :class="['badge', assessments[d.id].level]">{{ LEVEL_TEXT[assessments[d.id].level] }}</span>
          <ul class="reasons">
            <li v-for="r in assessments[d.id].reasons" :key="r">{{ r }}</li>
          </ul>
          <p v-if="assessments[d.id].suggestion" class="suggest">{{ assessments[d.id].suggestion }}</p>
          <p class="cites">依据：{{ assessments[d.id].citations.join('；') }}</p>
        </div>
      </div>

      <details v-if="dishes.length" class="raw">
        <summary>查看原始 JSON</summary>
        <pre class="output">{{ JSON.stringify(dishes, null, 2) }}</pre>
      </details>
    </section>

    <section class="card">
      <h2>③ 健康评估</h2>
      <p class="hint">先上传菜单识别出菜品，再选身体状况，最后点评估。</p>

      <div class="group">
        <span class="label">过敏原</span>
        <label v-for="a in ALLERGEN_OPTIONS" :key="a" class="chk">
          <input v-model="profile.allergens" type="checkbox" :value="a" /> {{ a }}
        </label>
      </div>

      <div class="group">
        <span class="label">身体状况</span>
        <label v-for="c in CONDITION_OPTIONS" :key="c" class="chk">
          <input v-model="profile.conditions" type="checkbox" :value="c" /> {{ c }}
        </label>
      </div>

      <div class="group">
        <span class="label">饮食目标</span>
        <select v-model="profile.goal" class="sel">
          <option value="none">无特殊</option>
          <option value="fat_loss">减脂</option>
          <option value="muscle_gain">增肌</option>
          <option value="sugar_control">控糖</option>
        </select>
      </div>

      <div class="row">
        <button :disabled="!dishes.length || assessing" @click="assess">
          {{ assessing ? '评估中…' : '评估这桌菜' }}
        </button>
        <button class="ghost" :disabled="profileSaving" @click="saveProfileToServer">
          {{ profileSaving ? '保存中…' : '保存档案' }}
        </button>
      </div>
      <p v-if="profileHint" class="hint">{{ profileHint }}</p>

      <p v-if="summary" class="summary">
        共 {{ summary.total }} 道：可以吃 {{ summary.safe }} · 注意 {{ summary.caution }} · 别点
        {{ summary.forbidden }}
      </p>
      <p v-if="assessError" class="err">{{ assessError }}</p>
    </section>

    <section class="card">
      <h2>④ 地域特色菜推荐</h2>
      <p class="hint">
        选一个城市，直接用上面的过敏原/身体状况设置，看哪些本地菜你能吃。
      </p>

      <div class="group">
        <span class="label">城市</span>
        <select v-model="selectedCity" class="sel">
          <option value="">请选择</option>
          <optgroup v-for="area in areas" :key="area" :label="area">
            <option v-for="c in cities.filter((x) => x.area === area)" :key="c.id" :value="c.id">
              {{ c.name }}（{{ c.dishCount }} 道）
            </option>
          </optgroup>
        </select>
        <button :disabled="!selectedCity || cityLoading" @click="loadCity">
          {{ cityLoading ? '加载中…' : '看本地特色菜' }}
        </button>
      </div>

      <div class="group">
        <span class="label">配一桌</span>
        <input v-model.number="people" type="number" min="1" max="10" class="num" />
        <span class="unit">人</span>
        <input v-model.number="budget" type="number" min="0" step="20" class="num" />
        <span class="unit">元以内</span>
        <button :disabled="planning || (!cityDishes.length && !dishes.length)" @click="makePlan">
          {{ planning ? '正在配…' : '帮我配一桌' }}
        </button>
      </div>
      <p v-if="planError" class="err">{{ planError }}</p>

      <div v-if="plan" class="plan">
        <p class="summary">
          配了 {{ plan.count }} 道 · 合计 ¥{{ plan.total }} · 可吃 {{ plan.summary.safe }} · 注意
          {{ plan.summary.caution }}
        </p>
        <div v-for="p in plan.plan" :key="p.dish.id" class="mini">
          <div>
            <strong>{{ p.dish.name }}</strong>
            <span class="orig">¥{{ p.dish.reference_price }} · {{ p.assessment.level }}</span>
          </div>
          <span class="cnt">{{ LEVEL_TEXT[p.assessment.level] }}</span>
        </div>
        <p v-if="plan.excluded.length" class="hint">
          已剔除 {{ plan.excluded.length }} 道：命中过敏或忌口，不参与配菜
        </p>
        <p v-for="n in plan.notes" :key="n" class="hint">{{ n }}</p>
      </div>

      <p v-if="citySummary" class="summary">
        共 {{ citySummary.total }} 道：可以吃 {{ citySummary.safe }} · 注意
        {{ citySummary.caution }} · 别点 {{ citySummary.forbidden }}
      </p>
      <p v-if="cityError" class="err">{{ cityError }}</p>

      <div v-for="d in cityDishes" :key="d.id" class="dish">
        <div class="dish-head">
          <div>
            <NuxtLink :to="dishLink(d)" class="dish-link">{{ d.name }}</NuxtLink>
            <span class="orig">{{ d.region }} · {{ d.method }}</span>
          </div>
          <div class="head-right">
            <span v-if="d.reference_price !== null" class="price">¥{{ d.reference_price }}</span>
            <button class="fav" :disabled="favBusy === d.id" @click="toggleFavorite(d)">
              {{ isFav(d.id) ? '★ 已收藏' : '☆ 收藏' }}
            </button>
          </div>
        </div>
        <p v-if="d.ingredients.length" class="line">食材：{{ d.ingredients.join('、') }}</p>
        <p v-if="d.allergens.length" class="line warn">⚠ 可能含：{{ d.allergens.join('、') }}</p>

        <div v-if="cityAssessments[d.id]" class="assess">
          <span :class="['badge', cityAssessments[d.id].level]">
            {{ LEVEL_TEXT[cityAssessments[d.id].level] }}
          </span>
          <ul class="reasons">
            <li v-for="r in cityAssessments[d.id].reasons" :key="r">{{ r }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>⑤ 我的收藏与历史</h2>
      <p v-if="userError" class="err">{{ userError }}</p>

      <h3>收藏（{{ favorites.length }}）</h3>
      <p v-if="!favorites.length" class="hint">还没有收藏。在上面任意菜品卡片点「☆ 收藏」。</p>
      <div v-for="f in favorites" :key="f.id" class="mini">
        <div>
          <strong>{{ f.name }}</strong>
          <span class="orig">{{ f.region || '' }} {{ f.allergens.length ? '· 含 ' + f.allergens.join('、') : '' }}</span>
        </div>
        <button class="fav" @click="toggleFavorite(f)">移除</button>
      </div>

      <h3>历史记录（{{ history.length }}）</h3>
      <p v-if="!history.length" class="hint">识别菜单或查看城市后，这里会自动留下记录。</p>
      <div v-for="h in history" :key="h.id" class="mini">
        <div>
          <strong>{{ h.title }}</strong>
          <span class="orig">
            {{ h.source === 'city' ? '地域推荐' : '拍照识别' }} · {{ fmtTime(h.createdAt) }}
            <template v-if="h.summary">
              · 可吃 {{ h.summary.safe }} / 注意 {{ h.summary.caution }} / 别点 {{ h.summary.forbidden }}
            </template>
          </span>
        </div>
        <span class="cnt">{{ h.dishes.length }} 道</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 760px;
  margin: 0 auto;
  padding: 32px 20px 80px;
  font-family: system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  color: #1f2937;
}
h1 {
  font-size: 22px;
  margin: 0 0 6px;
}
.sub {
  color: #6b7280;
  font-size: 13px;
  margin: 0 0 24px;
}
.card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 18px;
  background: #fff;
}
h2 {
  font-size: 15px;
  margin: 0 0 12px;
  color: #111827;
}
.row {
  display: flex;
  gap: 8px;
}
input:not([type='file']) {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
}
button {
  padding: 9px 16px;
  border: 0;
  border-radius: 8px;
  background: #111827;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.output {
  margin-top: 14px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.preview {
  display: block;
  margin-top: 12px;
  max-width: 100%;
  max-height: 320px;
  border-radius: 8px;
  border: 1px solid #eee;
}
.hint {
  color: #6b7280;
  font-size: 12px;
}
.err {
  color: #b91c1c;
  font-size: 13px;
  white-space: pre-wrap;
}
.dish {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fcfdfe;
}
.dish-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.orig {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #9ca3af;
  font-weight: 400;
}
.price {
  color: #b45309;
  font-weight: 600;
}
.tags {
  margin-top: 6px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
}
.line {
  margin: 6px 0 0;
  font-size: 13px;
  color: #374151;
}
.warn {
  color: #b91c1c;
}
.conf {
  margin: 6px 0 0;
  font-size: 12px;
  color: #9ca3af;
}
.raw {
  margin-top: 16px;
  font-size: 13px;
}

/* ---- 健康评估 ---- */
.assess {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e5e7eb;
}
.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}
.badge.safe {
  background: #ecfdf5;
  color: #047857;
}
.badge.caution {
  background: #fffbeb;
  color: #b45309;
}
.badge.forbidden {
  background: #fef2f2;
  color: #b91c1c;
}
.reasons {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 13px;
  color: #374151;
}
.reasons li {
  margin: 2px 0;
}
.suggest {
  margin: 6px 0 0;
  font-size: 13px;
  color: #4b5563;
}
.cites {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
}
.group {
  margin: 10px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.label {
  font-size: 13px;
  color: #6b7280;
  min-width: 62px;
}
.chk {
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.sel {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
}
.summary {
  margin-top: 12px;
  font-size: 13px;
  color: #374151;
  background: #f9fafb;
  padding: 8px 12px;
  border-radius: 8px;
}

/* ---- 收藏与历史 ---- */
.head-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fav {
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}
.fav:hover {
  border-color: #9ca3af;
}
h3 {
  font-size: 14px;
  margin: 18px 0 8px;
  color: #111827;
}
.mini {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}
.cnt {
  color: #9ca3af;
  font-size: 12px;
  white-space: nowrap;
}
.ghost {
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
}
.dish-link {
  color: #111827;
  font-weight: 600;
  text-decoration: none;
  border-bottom: 1px dashed #d1d5db;
}
.dish-link:hover { border-bottom-color: #111827; }
.num {
  width: 72px;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
}
.unit { font-size: 13px; color: #6b7280; }
.plan {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fcfdfe;
}
</style>

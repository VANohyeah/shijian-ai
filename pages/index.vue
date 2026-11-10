<script setup lang="ts">
import type { Dish } from '~/shared/types/dish'

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
    const res = await fetch('/api/dish/analyze', {
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

const ALLERGEN_OPTIONS = ['海鲜', '花生', '坚果', '乳制品', '麸质', '蛋', '大豆', '鱼']
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
    const res = await fetch('/api/dish/assess', {
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
          <span v-if="d.reference_price !== null" class="price">¥{{ d.reference_price }}</span>
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
      </div>

      <p v-if="summary" class="summary">
        共 {{ summary.total }} 道：可以吃 {{ summary.safe }} · 注意 {{ summary.caution }} · 别点
        {{ summary.forbidden }}
      </p>
      <p v-if="assessError" class="err">{{ assessError }}</p>
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
</style>

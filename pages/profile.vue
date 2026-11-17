<script setup lang="ts">
import { useProfile } from '~/composables/useProfile'
import { useAuth } from '~/composables/useAuth'

const { profile, saving, load, save, filled } = useProfile()
const { user, sync: syncAuth, logout } = useAuth()
const route = useRoute()

useHead({ title: '你的情况 · 食鉴' })

const step = ref(1)
const errors = ref<Record<string, string>>({})
const hint = ref('')

const wasNew = ref(false)

const STEPS = [
  { no: '壹', label: '基本情况' },
  { no: '贰', label: '日常与目标' },
  { no: '叁', label: '禁忌' }
] as const

onMounted(async () => {
  syncAuth()
  await load()
  wasNew.value = !filled.value
})

async function onLogout() {
  logout()
  await navigateTo('/')
}

function validate(target: number) {
  const e: Record<string, string> = {}
  if (target === 1) {
    const p = profile.value
    if (!p.age || p.age < 1 || p.age > 120) e.age = '年龄填 1–120'
    if (!p.height_cm || p.height_cm < 80 || p.height_cm > 250) e.height_cm = '身高填 80–250 cm'
    if (!p.weight_kg || p.weight_kg < 20 || p.weight_kg > 300) e.weight_kg = '体重填 20–300 kg'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

function next() {
  if (!validate(step.value)) return
  hint.value = ''
  step.value = Math.min(3, step.value + 1)
}

function prev() {
  hint.value = ''
  step.value = Math.max(1, step.value - 1)
  validate(step.value)
}

async function onSave() {
  for (const s of [1, 2, 3]) {
    if (!validate(s)) {
      step.value = s
      return
    }
  }
  const res = await save()
  if (!res.ok) {
    hint.value = '保存失败：' + res.message
    return
  }
  hint.value = '存好了。往后拍菜单、看城市菜，都按这份判。'


  if (wasNew.value) {
    await navigateTo('/')
    return
  }


  const next = String(route.query.next ?? '')
  if (next.startsWith('/') && !next.startsWith('//')) await navigateTo(next)
}
</script>

<template>
  <main class="wrap wrap--read">
    <PageHead
      back-to="/"
      back-label="回首页"
      kicker="说一遍就够"
      title="你的情况"
    />

    <nav class="steps" aria-label="填写进度">
      <div
        v-for="(s, i) in STEPS"
        :key="s.no"
        class="steps__item"
        :class="{ 'is-on': step === i + 1, 'is-done': step > i + 1 }"
        :aria-current="step === i + 1 ? 'step' : undefined"
      >
        <span class="no">{{ s.no }}</span>
        <span class="lb">{{ s.label }}</span>
      </div>
    </nav>

    <div class="card">

      <ProfileForm v-model="profile" :step="step" :errors="errors" />
    </div>

    <div class="acts">
      <button v-if="step > 1" type="button" class="btn-ghost" @click="prev">上一步</button>
      <button v-if="step < 3" type="button" class="btn" @click="next">下一步</button>
      <button v-else type="button" class="btn" :disabled="saving" @click="onSave">
        {{ saving ? '保存中…' : '保存这份情况' }}
      </button>
      <span v-if="hint" class="hint">{{ hint }}</span>
    </div>

    <div class="account">
      <p>
        现在用的是
        <b>{{ user || '访客' }}</b>
      </p>
      <button v-if="user" type="button" class="btn-ghost" @click="onLogout">退出登录</button>
      <NuxtLink v-else to="/login" class="btn-ghost">登录 / 注册</NuxtLink>
    </div>
  </main>
</template>

<style scoped>

.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 24px 0 20px;
}

.steps__item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 12px 14px;
  border: 2px solid var(--rule);
  border-radius: var(--r);
  background: var(--paper);
  transition: background-color 300ms cubic-bezier(0.33, 1, 0.68, 1),
    border-color 300ms cubic-bezier(0.33, 1, 0.68, 1), color 300ms cubic-bezier(0.33, 1, 0.68, 1);
}

.steps__item.is-on {
  background: var(--sepia);
  border-color: var(--sepia);
  color: var(--cream);
}

.steps__item.is-done {
  border-color: var(--sepia);
  color: var(--sepia);
}

.no {
  font-family: var(--serif);
  font-weight: 900;
  font-size: 15px;
  letter-spacing: 0.06em;
}

.lb {
  font-size: 13px;
  letter-spacing: 0.08em;
  opacity: 0.9;
}

.card {
  background: var(--paper-lifted);
  border: 2px solid var(--rule);
  border-radius: var(--r);
  padding: 24px;
}

.acts {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 24px;
}

.btn,
.btn-ghost {
  padding: 12px 24px;
  border-radius: var(--r);
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background-color 300ms cubic-bezier(0.33, 1, 0.68, 1),
    border-color 300ms cubic-bezier(0.33, 1, 0.68, 1), color 300ms cubic-bezier(0.33, 1, 0.68, 1);
}

.btn {
  border: 2px solid var(--sepia);
  background: var(--sepia);
  color: var(--cream);
}

.btn:hover {
  background: var(--sepia-deep);
  border-color: var(--sepia-deep);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-ghost {
  border: 2px solid var(--rule);
  background: transparent;
  color: var(--ink-muted);
}

.btn-ghost:hover {
  border-color: var(--sepia);
  color: var(--sepia);
}

.hint {
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-muted);
}

.account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 2px solid var(--line);
  font-size: 14px;
  color: var(--ink-muted);
}

.account b {
  color: var(--ink);
  font-weight: 500;
}

.account .btn-ghost {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}
</style>

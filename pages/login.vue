<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

useHead({ title: '登录 · 食鉴' })

const { user, sync, login, register } = useAuth()
const route = useRoute()

const mode = ref<'login' | 'register'>('login')
const name = ref('')
const pass = ref('')
const error = ref('')
const busy = ref(false)

onMounted(() => {
  sync()

  if (user.value) navigateTo('/cities')
})

async function submit() {
  if (busy.value) return
  error.value = ''

  const res = mode.value === 'login' ? login(name.value, pass.value) : register(name.value, pass.value)
  if (!res.ok) {
    error.value = res.message
    return
  }

  busy.value = true
  const next = String(route.query.next ?? '')

  const fallback = mode.value === 'register' ? '/profile' : '/cities'
  await navigateTo(next.startsWith('/') && !next.startsWith('//') ? next : fallback)
}
</script>

<template>
  <main class="wrap login-page">
    <PageHead kicker="这台设备上的账号" title="登录 / 注册" />

    <div class="panel">
      <div class="modes" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'login'"
          :class="['mode', { on: mode === 'login' }]"
          @click="mode = 'login'; error = ''"
        >
          登录
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'register'"
          :class="['mode', { on: mode === 'register' }]"
          @click="mode = 'register'; error = ''"
        >
          注册
        </button>
      </div>

      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span class="field__k">名字</span>
          <input
            v-model="name"
            class="input"
            type="text"
            autocomplete="username"
            placeholder="两到十六个字"
          />
        </label>

        <label class="field">
          <span class="field__k">密码</span>
          <input
            v-model="pass"
            class="input"
            type="password"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            placeholder="六位以上"
          />
        </label>

        <p v-if="error" class="err">{{ error }}</p>

        <button class="btn submit" type="submit" :disabled="busy">
          {{ mode === 'login' ? '登录' : '注册并登录' }}
        </button>
      </form>

      <p class="note"></p>
    </div>
  </main>
</template>

<style scoped>

.login-page {
  max-width: 560px;
}

.panel {
  padding: 28px;
  border: 2px solid var(--line);
  border-radius: var(--radius);
  background: var(--lifted);
}

.modes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 24px;
}

.mode {
  padding: 11px;
  border: 2px solid var(--line);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  font-size: 15px;
  letter-spacing: 0.1em;
  transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease),
    color var(--dur) var(--ease);
}

.mode:hover {
  border-color: var(--sepia);
  color: var(--sepia);
}

.mode.on {
  border-color: var(--sepia);
  background: var(--sepia);
  color: var(--cream);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field__k {
  font-size: 13px;
  letter-spacing: 0.14em;
  color: var(--muted);
}

.field .input {
  background: var(--cream);
}

.submit {
  margin-top: 4px;
  width: 100%;
}

.note {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  font-size: 12px;
  line-height: 1.8;
  color: var(--muted);
}
</style>

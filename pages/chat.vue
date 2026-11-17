<script setup lang="ts">
import { describeError } from '~/composables/errors'
import { useProfile } from '~/composables/useProfile'
import { GOAL_LABEL } from '~/shared/types'
import type { Dish } from '~/shared/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const { profile, load: loadProfile } = useProfile()

const messages = ref<Message[]>([])
const input = ref('')
const streaming = ref(false)
const error = ref('')

const SUGGESTIONS = [
  '我海鲜过敏、痛风，水煮鱼还能吃吗',
  '减脂期，川菜馆该怎么点',
  '高嘌呤到底是个啥'
]

onMounted(async () => {
  await loadProfile()
  messages.value.push({
    role: 'assistant',
    content: '我按这份档案答：' + describeProfile()
  })
})

function describeProfile() {
  const parts: string[] = []
  if (profile.value.allergens.length) parts.push('过敏原 ' + profile.value.allergens.join('、'))
  if (profile.value.conditions.length) parts.push('身体状况 ' + profile.value.conditions.join('、'))
  if (profile.value.goal !== 'none') parts.push('目标 ' + GOAL_LABEL[profile.value.goal])
  return parts.length ? parts.join('；') : '还空着（去「你的情况」补两句，答案能准一截）'
}

function systemPrompt() {
  return [
    '你是食鉴，一个中餐饮食安全助手。',
    '用户档案：' + describeProfile() + '。',
    '回答要求：',
    '1. 先给结论（能吃 / 注意 / 别吃），再给理由；',
    '2. 涉及过敏原时，宁可多提醒一句；',
    '3. 不确定就说不确定，并建议向店员确认；',
    '4. 不给医疗诊断，只做饮食禁忌提示；',
    '5. 中文回答，简洁，不超过 200 字。'
  ].join('\n')
}

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || streaming.value) return

  input.value = ''
  error.value = ''
  messages.value.push({ role: 'user', content })
  const reply = ref('')
  messages.value.push({ role: 'assistant', content: '' })
  const target = messages.value[messages.value.length - 1]
  streaming.value = true

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt() },
          ...messages.value.slice(0, -1).map((m) => ({ role: m.role, content: m.content }))
        ]
      })
    })

    if (!res.ok || !res.body) {
      error.value = describeError(res, '把这句话问出去')
      messages.value.pop()
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
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const payload = t.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content
          if (delta) target.content += delta
        } catch {

        }
      }
    }
  } catch (err) {
    error.value = describeError(err, '把这句话问出去')
  } finally {
    streaming.value = false
  }
}
</script>

<template>
  <main class="wrap wrap--read chat-page">
    <PageHead back-to="/" back-label="回首页" kicker="不懂就问" title="问食鉴" />

    <div class="chat" :class="{ 'is-empty': messages.length <= 1 }">
      <div v-for="(m, i) in messages" :key="i" :class="['msg', m.role]">
        <p v-if="m.content">{{ m.content }}</p>
        <span v-else class="typing">…</span>
      </div>
    </div>

    <p v-if="error" class="err">{{ error }}</p>


    <div class="suggest" v-if="messages.length <= 1">
      <button v-for="s in SUGGESTIONS" :key="s" class="chip" @click="send(s)">{{ s }}</button>
    </div>

    <div class="bar">
      <input
        v-model="input"
        class="input"
        style="flex: 1"
        placeholder="比如：我花生过敏，宫保鸡丁能吃吗"
        :disabled="streaming"
        @keyup.enter="send()"
      />
      <button class="btn" :disabled="streaming || !input.trim()" @click="send()">
        {{ streaming ? '回答中…' : '发送' }}
      </button>
    </div>
  </main>
</template>

<style scoped>

.chat-page {
  display: flex;
  flex-direction: column;
}

.chat-page :deep(.page-head) {
  padding-bottom: 16px;
  margin-bottom: 20px;
}

.chat-page :deep(.page-head__back) {
  margin-bottom: 12px;
}

.chat-page :deep(.page-head__title) {
  font-size: clamp(24px, 3vw, 32px);
}

.chat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  margin: 0 0 16px;
}

.chat.is-empty {
  justify-content: center;
}

.msg {
  max-width: 34em;
  padding: 11px 15px;
  border-radius: var(--radius);
  font-size: 15px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.msg p {
  margin: 0;
}

.msg.user {
  align-self: flex-end;
  background: var(--sepia);
  color: var(--cream);
}

.msg.assistant {
  align-self: flex-start;
  background: var(--lifted);
  border: 1px solid var(--line);
}

.typing {
  color: var(--muted);
}

.suggest {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.chip {
  padding: 8px 14px;
  border: 2px solid var(--line);
  border-radius: var(--radius);
  background: var(--lifted);
  font-size: 13px;
  letter-spacing: 0.04em;
  cursor: pointer;
  color: var(--ink);
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}

.chip:hover {
  border-color: var(--sepia);
  color: var(--sepia);
}

.bar {
  display: flex;
  gap: 12px;
  align-items: stretch;
  margin-top: auto;
  background: var(--cream);
}

.bar .btn {
  flex: none;
  padding-left: 26px;
  padding-right: 26px;
}

.bar .btn:disabled {
  background: transparent;
  border-color: var(--line-strong);
  color: var(--muted);
  opacity: 1;
}

.bar .btn:disabled:hover {
  background: transparent;
  border-color: var(--line-strong);
  color: var(--muted);
}
</style>

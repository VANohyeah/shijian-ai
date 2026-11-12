<script setup lang="ts">
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
  '减脂期在川菜馆怎么点菜',
  '帮我解释一下什么是高嘌呤食物'
]

onMounted(async () => {
  await loadProfile()
  messages.value.push({
    role: 'assistant',
    content:
      '我是食鉴。可以问我「这道菜我能不能吃」「怎么点更稳」「为什么不能吃」。\n' +
      '我会结合你的档案回答。档案里现在是：' +
      describeProfile()
  })
})

function describeProfile() {
  const parts: string[] = []
  if (profile.value.allergens.length) parts.push('过敏原 ' + profile.value.allergens.join('、'))
  if (profile.value.conditions.length) parts.push('身体状况 ' + profile.value.conditions.join('、'))
  if (profile.value.goal !== 'none') {
    const map: Record<string, string> = {
      fat_loss: '减脂',
      muscle_gain: '增肌',
      sugar_control: '控糖'
    }
    parts.push('目标 ' + map[profile.value.goal])
  }
  return parts.length ? parts.join('；') : '还没填（去「我的档案」补一下更准）'
}

/** 把档案作为系统提示带进对话，避免模型凭空猜测 */
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
      error.value = 'HTTP ' + res.status + '：' + (await res.text())
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
          /* 半包，忽略 */
        }
      }
    }
  } catch (err) {
    error.value = String(err)
  } finally {
    streaming.value = false
  }
}
</script>

<template>
  <main class="wrap">
    <h1>问食鉴</h1>
    <p class="muted">结合你的档案回答「能不能吃、怎么点」。不构成医疗建议。</p>

    <div class="chat">
      <div v-for="(m, i) in messages" :key="i" :class="['msg', m.role]">
        <p v-if="m.content">{{ m.content }}</p>
        <span v-else class="typing">…</span>
      </div>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <div class="suggest" v-if="messages.length <= 1">
      <button v-for="s in SUGGESTIONS" :key="s" class="chip" @click="send(s)">{{ s }}</button>
    </div>

    <div class="row bar">
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
.chat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 14px 0;
}
.msg {
  max-width: 88%;
  padding: 10px 13px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
}
.msg p {
  margin: 0;
}
.msg.user {
  align-self: flex-end;
  background: #111827;
  color: #fff;
}
.msg.assistant {
  align-self: flex-start;
  background: #fff;
  border: 1px solid #ebedf0;
}
.typing {
  color: #9ca3af;
}
.suggest {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.chip {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  color: #374151;
}
.bar {
  position: sticky;
  bottom: 12px;
  background: #fbfbfc;
  padding-top: 10px;
}
</style>

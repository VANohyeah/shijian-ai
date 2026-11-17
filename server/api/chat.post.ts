import { providerChain, type ChatMessage } from '../utils/ai'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ messages?: ChatMessage[] }>(event)
  const messages = body?.messages

  if (!Array.isArray(messages) || messages.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'messages 不能为空' })
  }
  if (messages.length > 40) {
    throw createError({ statusCode: 400, statusMessage: '对话轮次过多，请新建会话' })
  }

  const providers = providerChain()
  if (providers.length === 0) {
    throw createError({
      statusCode: 500,
      statusMessage: '服务端未配置 GLM_API_KEY 或 DEEPSEEK_API_KEY'
    })
  }

  let lastError = ''

  for (const provider of providers) {
    for (const model of provider.textModels) {
      try {
        const upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`
          },
          body: JSON.stringify({ model, messages, stream: true, temperature: 0.3 })
        })

        if (!upstream.ok || !upstream.body) {
          lastError = `${provider.label}/${model}: ${(await upstream.text()).slice(0, 200)}`
          continue
        }

        setResponseHeaders(event, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
          'X-AI-Provider': provider.id,
          'X-AI-Model': model
        })

        return sendStream(event, upstream.body as ReadableStream)
      } catch (err) {
        lastError = `${provider.label}/${model}: ${String(err).slice(0, 200)}`
      }
    }
  }

  throw createError({ statusCode: 502, statusMessage: `所有模型均不可用：${lastError}` })
})


import type { H3Event } from 'h3'
import { getDeepSeekProvider, getGlmProvider, resolveProvider } from '../utils/ai'

export default defineEventHandler((event: H3Event) => {

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')

  const glm = getGlmProvider()
  const deepseek = getDeepSeekProvider()
  const text = resolveProvider('text')
  const vision = resolveProvider('vision')

  return {
    ok: true,
    time: new Date().toISOString(),
    providers: {
      glm: glm ? { configured: true, baseUrl: glm.baseUrl, text: glm.textModels, vision: glm.visionModels } : { configured: false },
      deepseek: deepseek
        ? { configured: true, baseUrl: deepseek.baseUrl, text: deepseek.textModels, vision: deepseek.visionModels }
        : { configured: false }
    },
    active: {
      text: text ? { provider: text.id, models: text.textModels } : null,
      vision: vision ? { provider: vision.id, models: vision.visionModels } : null
    },
    ready: Boolean(text && vision)
  }
})

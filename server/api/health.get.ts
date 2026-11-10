/**
 * 健康检查：一眼看出服务端配了哪家模型、走的是谁。
 * 不要把 Key 本身返回出去，只说有没有、长度对不对。
 */
import type { H3Event } from 'h3'

export default defineEventHandler((event: H3Event) => {
  // 显式声明 charset，浏览器之外的客户端才不会把中文读成乱码
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

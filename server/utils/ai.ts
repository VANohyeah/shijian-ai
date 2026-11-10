/**
 * AI 供应商解析：支持智谱 GLM 与 DeepSeek，同一套 OpenAI 兼容协议。
 *
 * 设计目标：换个供应商只改 .env，不改代码；模型名写错或该型号未开通时，
 * 自动在候选列表里继续尝试，而不是整体 500。
 */

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatContentPart[]
}

export type ProviderId = 'glm' | 'deepseek'

export interface AiProvider {
  id: ProviderId
  label: string
  baseUrl: string
  apiKey: string
  textModels: string[]
  visionModels: string[]
}

function env(name: string): string {
  return (process.env[name] ?? '').trim()
}

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 智谱 GLM；未配置 Key 时返回 null */
export function getGlmProvider(): AiProvider | null {
  const apiKey = env('GLM_API_KEY')
  if (!apiKey) return null

  return {
    id: 'glm',
    label: '智谱 GLM',
    baseUrl: env('GLM_BASE_URL') || 'https://open.bigmodel.cn/api/paas/v4',
    apiKey,
    textModels: splitList(env('GLM_TEXT_MODELS') || 'glm-4-flash,glm-5.3-flash'),
    // 视觉模型候选：前者免费额度大，后者是最新多模态；逐个尝试，第一个能用的生效
    visionModels: splitList(env('GLM_VISION_MODELS') || 'glm-4v-flash,glm-4v-plus-0111,glm-5.3-flash')
  }
}

/** DeepSeek；其 flash 型号同时支持视觉 */
export function getDeepSeekProvider(): AiProvider | null {
  const apiKey = env('DEEPSEEK_API_KEY')
  if (!apiKey) return null

  const model = env('DEEPSEEK_MODEL') || 'deepseek-flash'
  return {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: env('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com',
    apiKey,
    textModels: [model],
    visionModels: [model]
  }
}

/**
 * 选择供应商。
 * kind = 'text' 时用于对话；'vision' 时用于识图。
 * AI_PROVIDER=glm|deepseek 可强制指定，否则智谱优先（视觉能力更稳），缺失时回落到另一家。
 */
export function resolveProvider(kind: 'text' | 'vision'): AiProvider | null {
  const glm = getGlmProvider()
  const deepseek = getDeepSeekProvider()
  const pref = env('AI_PROVIDER').toLowerCase()

  if (pref === 'glm') return glm ?? deepseek
  if (pref === 'deepseek') return deepseek ?? glm

  // 视觉默认优先智谱：GLM 系列原生多模态，识图更稳
  return kind === 'vision' ? glm ?? deepseek : glm ?? deepseek
}

/** 所有已配置的供应商，按优先级排列（用于逐家重试） */
export function providerChain(): AiProvider[] {
  const list = [getGlmProvider(), getDeepSeekProvider()].filter(Boolean) as AiProvider[]
  const pref = env('AI_PROVIDER').toLowerCase()
  if (pref === 'deepseek') return list.sort((a) => (a.id === 'deepseek' ? -1 : 1))
  if (pref === 'glm') return list.sort((a) => (a.id === 'glm' ? -1 : 1))
  return list.sort((a) => (a.id === 'glm' ? -1 : 1))
}

/**
 * 图片的两种传法。
 * 智谱与 OpenAI 系对 base64 前缀的接受程度不同，这里都生成，逐个尝试。
 */
export function buildImageVariants(base64: string, mime: string): string[] {
  const safeMime = mime || 'image/jpeg'
  return [`data:${safeMime};base64,${base64}`, base64]
}

export function buildVisionMessages(
  imageUrl: string,
  prompt: string,
  system: string
): ChatMessage[] {
  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }
  ]
}

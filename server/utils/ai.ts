

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

export function getGlmProvider(): AiProvider | null {
  const apiKey = env('GLM_API_KEY')
  if (!apiKey) return null

  return {
    id: 'glm',
    label: '智谱 GLM',
    baseUrl: env('GLM_BASE_URL') || 'https://open.bigmodel.cn/api/paas/v4',
    apiKey,
    textModels: splitList(env('GLM_TEXT_MODELS') || 'glm-4-flash,glm-5.3-flash'),

    visionModels: splitList(env('GLM_VISION_MODELS') || 'glm-4v-flash,glm-4v-plus-0111,glm-5.3-flash')
  }
}

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

export function resolveProvider(kind: 'text' | 'vision'): AiProvider | null {
  const glm = getGlmProvider()
  const deepseek = getDeepSeekProvider()
  const pref = env('AI_PROVIDER').toLowerCase()

  if (pref === 'glm') return glm ?? deepseek
  if (pref === 'deepseek') return deepseek ?? glm


  return kind === 'vision' ? glm ?? deepseek : glm ?? deepseek
}

export function providerChain(): AiProvider[] {
  const list = [getGlmProvider(), getDeepSeekProvider()].filter(Boolean) as AiProvider[]
  const pref = env('AI_PROVIDER').toLowerCase()
  if (pref === 'deepseek') return list.sort((a) => (a.id === 'deepseek' ? -1 : 1))
  if (pref === 'glm') return list.sort((a) => (a.id === 'glm' ? -1 : 1))
  return list.sort((a) => (a.id === 'glm' ? -1 : 1))
}

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

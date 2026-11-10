/**
 * 菜单图片 -> 菜品 JSON 列表。
 *
 * v2 变更（2026-11-09）：
 *   - 返回 { dishes: Dish[] }，不再只取第一道菜（分类式菜单会把标题错当菜名）
 *   - 统一空值：空字符串一律转 null，避免前端出现 "region": ""
 *
 * 容错策略：供应商优先 GLM，模型按候选列表逐个试，图片按 data URI / 裸 base64 两种传法逐个试。
 */
import { ALLERGENS, type Allergen, type Dish } from '../../shared/types'

const SYSTEM_PROMPT =
  '你是菜单识别器。只输出一个 JSON 对象，不要解释，不要 markdown 代码块。'

const SCHEMA_HINT = `先判断菜单的结构，再输出。中文菜单常见结构是「系列标题 → 多个口味」，价格常写在系列标题那一行（如"至尊系列 9寸/48元 12寸/78元"）。

输出格式：
{
  "groups": [
    {
      "title": "至尊系列",            // 分类标题，没有分类就填 null
      "price": 48,                    // 该系列的价格；有多个尺寸取最小尺寸的价格；没有填 null
      "items": [
        {
          "name": "SWEET SRIRACHA DYNAMITE",        // 原文菜名，照抄不要改
          "name_zh": "甜辣酱轰炸比萨",               // 中文译名；原文就是中文则与 name 相同
          "ingredients": ["Honey Sriracha","chicken","pineapple"],   // 原文食材，最多6个
          "ingredients_zh": ["蜂蜜是拉差酱","鸡肉","菠萝"],          // 与上一条一一对应，数量必须相同
          "allergens": [],            // 只能从 含麸质谷物/甲壳类/鱼类/蛋类/花生/大豆/乳制品/坚果/贝类·软体/芝麻/酒精/亚硫酸盐 中选
          "spicy_level": 1,           // 0不辣 1微辣 2中辣 3特辣，看不出填 null
          "method": "烤",             // 做法，看不出填 null
          "confidence": 0.9
        }
      ]
    }
  ]
}

规则（很重要，逐条遵守）：
1. 分类标题（"至尊系列""精选系列""纯珍比萨"）不是菜品，不要当成菜名。
2. 标题下面的口味名（"超级至尊""海鲜至尊""榴莲多多"）才是菜名，要全部列出，最多 8 道。
3. 价格写在标题行时，该系列下所有口味共用这个价格。
4. ingredients 从菜名合理推断："海鲜至尊" → ["虾","蟹","贝类"]；"榴莲多多" → ["榴莲","奶酪"]。推不出就留空数组。
5. **双语要求**：name 照抄原文；name_zh 给中文译名（原文是中文则与 name 相同）；ingredients_zh 与 ingredients 一一对应、数量一致，翻译要通顺（如 "crust" → "饼底"，"Sriracha" → "是拉差辣酱"）。
6. allergens 要按食材推导，宁可多报不可漏报：
   - 含 crust / 面团 / 面粉 / 面包 / 饼底 / 面条 → "含麸质谷物"
   - 含 cheese / 奶酪 / 芝士 / 黄油 / 奶油 → "乳制品"
   - 含 shrimp / 蟹 / 龙虾 → "甲壳类"；含贝/蚝/鱿鱼 → "贝类/软体"；含三文鱼/金枪鱼/鳕鱼/鱼 → "鱼类"
   - 含花生 → "花生"；含杏仁/核桃/腰果 → "坚果"；含鸡蛋/蛋液 → "蛋类"；含豆腐/豆浆/酱油 → "大豆"；含芝麻/麻酱 → "芝麻"；含黄酒/白酒/啤酒 → "酒精"
   - 确实不含以上任何一类才留空数组。
7. 图中若没有任何可点菜品，返回 {"groups": []}。
8. 只输出 JSON，不要任何其他字符。`

/** 从模型输出里抽出 JSON，容忍 ```json 包裹与首尾杂字 */
function extractJson(raw: string): any | null {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

/** 空字符串 -> null，去除无意义值 */
function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' || t === 'null' || t === '未知' ? null : t
}

function strList(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x !== '')
    .slice(0, max)
}

function normalizeOne(parsed: any, index: number, group?: { title?: string | null; price?: number | null }): Dish {
  const groupTags = group?.title ? [group.title] : []
  const itemPrice = typeof parsed?.reference_price === 'number' ? parsed.reference_price : null
  const name = str(parsed?.name) ?? '未识别菜品'
  const ingredients = strList(parsed?.ingredients, 6)
  const ingredientsZh = strList(parsed?.ingredients_zh, 6)

  return {
    id: `photo_${Date.now()}_${index}`,
    name,
    // 原文本身含中文时，中文名缺省等于原名
    name_zh: str(parsed?.name_zh) ?? (/[\u4e00-\u9fa5]/.test(name) ? name : null),
    region: str(parsed?.region),
    city: str(parsed?.city),
    ingredients,
    // 数量对不上时截到等长，避免前端错位
    ingredients_zh: ingredientsZh.slice(0, ingredients.length),
    method: str(parsed?.method),
    flavors: strList(parsed?.flavors, 5),
    spicy_level: [0, 1, 2, 3].includes(parsed?.spicy_level) ? parsed.spicy_level : null,
    allergens: strList(parsed?.allergens, 8).filter((a) =>
      (ALLERGENS as readonly string[]).includes(a)
    ) as Allergen[],
    tags: [...groupTags, ...strList(parsed?.tags, 6)].slice(0, 8),
    reference_price: itemPrice ?? (typeof group?.price === 'number' ? group.price : null),
    source: 'photo',
    confidence:
      typeof parsed?.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0
  }
}

/**
 * 展平模型输出。
 * 主格式：{ groups: [{ title, price, items: [{...}] }] }
 * 兼容：{ dishes: [...] } / 裸数组 / 单个对象
 */
function normalizeDishes(parsed: any): Dish[] {
  const out: Dish[] = []

  if (Array.isArray(parsed?.groups)) {
    for (const group of parsed.groups) {
      if (!group || typeof group !== 'object') continue
      const title = str(group.title)
      const price = typeof group.price === 'number' ? group.price : null
      const items = Array.isArray(group.items) ? group.items : []

      for (const item of items) {
        const obj = typeof item === 'string' ? { name: item } : item
        if (!obj || typeof obj !== 'object' || !str(obj.name)) continue
        out.push(normalizeOne(obj, out.length, { title, price }))
        if (out.length >= 8) break
      }
      if (out.length >= 8) break
    }
    return out
  }

  const legacy = Array.isArray(parsed?.dishes)
    ? parsed.dishes
    : Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && parsed.name
        ? [parsed]
        : []

  return legacy
    .filter((d: any) => d && typeof d === 'object' && str(d.name))
    .slice(0, 8)
    .map((d: any, i: number) => normalizeOne(d, i))
}

export default defineEventHandler(async (event) => {
  const { imageBase64, mime } = await readBody<{ imageBase64?: string; mime?: string }>(event)

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '缺少 imageBase64' })
  }
  if (imageBase64.length > 8_000_000) {
    throw createError({ statusCode: 413, statusMessage: '图片过大，请压缩到长边 1600px 以内' })
  }

  const providers = providerChain()
  if (providers.length === 0) {
    throw createError({
      statusCode: 500,
      statusMessage: '服务端未配置 GLM_API_KEY 或 DEEPSEEK_API_KEY'
    })
  }

  const prompt = `识别这张菜单图片里的可点菜品。\n${SCHEMA_HINT}`
  const urlVariants = buildImageVariants(imageBase64, mime || 'image/jpeg')

  const attempts: string[] = []
  let tried = 0

  for (const provider of providers) {
    for (const model of provider.visionModels) {
      for (const [variantIndex, url] of urlVariants.entries()) {
        if (tried >= 8) break
        tried += 1

        try {
          const upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${provider.apiKey}`
            },
            body: JSON.stringify({
              model,
              temperature: 0,
              messages: buildVisionMessages(url, prompt, SYSTEM_PROMPT)
            })
          })

          if (!upstream.ok) {
            attempts.push(`${provider.label}/${model}#${variantIndex}: ${(await upstream.text()).slice(0, 160)}`)
            continue
          }

          const payload: any = await upstream.json()
          const raw: string = payload?.choices?.[0]?.message?.content ?? ''
          const parsed = extractJson(typeof raw === 'string' ? raw : JSON.stringify(raw))

          if (!parsed) {
            attempts.push(`${provider.label}/${model}#${variantIndex}: 无有效 JSON -> ${String(raw).slice(0, 120)}`)
            continue
          }

          const dishes = normalizeDishes(parsed)
          console.info(`[dish] ok via ${provider.label}/${model}#${variantIndex}, dishes=${dishes.length}`)

          setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
          setResponseHeader(event, 'X-AI-Provider', provider.id)
          setResponseHeader(event, 'X-AI-Model', model)

          return { dishes, count: dishes.length, provider: provider.id, model }
        } catch (err) {
          attempts.push(`${provider.label}/${model}#${variantIndex}: ${String(err).slice(0, 120)}`)
        }
      }
    }
  }

  throw createError({
    statusCode: 502,
    statusMessage: `识图失败，已尝试 ${tried} 次。最后一次：${attempts[attempts.length - 1] ?? '无'}`
  })
})

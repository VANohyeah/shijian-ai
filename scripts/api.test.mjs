/**
 * 接口集成测试。
 *
 * 用法：先起服务，再跑测试
 *   npm run dev            # 或 npm run build && node .output/server/index.mjs
 *   node --test scripts/api.test.mjs
 *
 * 自定义地址：BASE=http://localhost:3100 node --test scripts/api.test.mjs
 *
 * 为什么测接口而不是单元测试：
 *   规则引擎是纯函数，但它的输入来自请求体、输出要经过序列化。
 *   从 HTTP 边界测，能同时覆盖「规则对不对」和「接口契约对不对」。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

const BASE = process.env.BASE || 'http://localhost:3000'

const dish = (id, name, ingredients, allergens = []) => ({
  id,
  name,
  name_zh: name,
  region: '测试',
  city: null,
  ingredients,
  ingredients_zh: ingredients,
  method: '炒',
  flavors: [],
  spicy_level: 1,
  allergens,
  tags: [],
  reference_price: 30,
  source: 'photo',
  confidence: 1
})

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  assert.equal(res.ok, true, `${path} 返回 ${res.status}`)
  return res.json()
}

test('健康检查：服务可用', async () => {
  const res = await fetch(`${BASE}/api/health`)
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.ok, true)
})

test('城市库：30 城 / 250 道', async () => {
  const data = await (await fetch(`${BASE}/api/cities`)).json()
  assert.equal(data.total, 30)
  assert.equal(data.dishTotal, 250)
  const chengdu = data.cities.find((c) => c.id === 'chengdu')
  assert.ok(chengdu, '应包含成都')
  assert.equal(chengdu.dishCount, 9)
})

test('判定：过敏命中一律 forbidden', async () => {
  const data = await post('/api/evaluate', {
    dishes: [dish('t1', '红烧鱼', ['鲤鱼', '酱油'])],
    profile: { allergens: ['鱼类'] }
  })
  assert.equal(data.assessments[0].level, 'forbidden')
  assert.ok(data.assessments[0].reasons.length > 0, '必须给出理由')
})

test('判定：「鱼香肉丝」不能误判为鱼类', async () => {
  const data = await post('/api/evaluate', {
    dishes: [dish('t2', '鱼香肉丝', ['猪肉', '木耳', '泡椒'])],
    profile: { allergens: ['鱼类'] }
  })
  assert.equal(data.assessments[0].level, 'safe')
})

test('判定：痛风命中高嘌呤食材为 caution', async () => {
  const data = await post('/api/evaluate', {
    dishes: [dish('t3', '夫妻肺片', ['牛杂', '红油'])],
    profile: { conditions: ['痛风'] }
  })
  assert.equal(data.assessments[0].level, 'caution')
})

test('判定：结论必须带依据', async () => {
  const data = await post('/api/evaluate', {
    dishes: [dish('t4', '腊肉炒饭', ['腊肉', '米饭'])],
    profile: { conditions: ['高血压'] }
  })
  assert.ok(data.assessments[0].citations.length > 0, 'citations 不能为空')
})

test('配菜：预算不能被突破，forbidden 必须被剔除', async () => {
  const dishes = [
    dish('p1', '麻婆豆腐', ['豆腐'], ['大豆']),
    dish('p2', '回锅肉', ['五花肉']),
    dish('p3', '开水白菜', ['白菜', '高汤']),
    dish('p4', '清蒸鲈鱼', ['鲈鱼'], ['鱼类'])
  ]
  const data = await post('/api/plan', {
    dishes,
    people: 3,
    budget: 100,
    profile: { allergens: ['鱼类'] }
  })
  assert.ok(data.total <= 100, `超预算：${data.total}`)
  const names = data.plan.map((p) => p.dish.name)
  assert.ok(!names.includes('清蒸鲈鱼'), '鱼类过敏者不应配到鲈鱼')
})

test('菜品详情：语言视角与复刻菜谱可用', async () => {
  const data = await (await fetch(`${BASE}/api/dishes/dish_chengdu_01`)).json()
  assert.equal(data.dish.name, '麻婆豆腐')
  assert.equal(data.available.language, true)
  assert.equal(data.available.recipe, true)
  assert.ok(data.recipe.steps.length > 0, '菜谱应有步骤')
})

test('档案：读写往返一致', async () => {
  const deviceId = 'dev_test_' + Date.now()
  const profile = {
    gender: 'male',
    age: 30,
    height_cm: 178,
    weight_kg: 80,
    activity: 'light',
    goal: 'fat_loss',
    allergens: ['甲壳类'],
    conditions: ['痛风'],
    dietary: []
  }
  const put = await fetch(`${BASE}/api/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, profile })
  })
  assert.equal(put.ok, true)

  const got = await (await fetch(`${BASE}/api/profile?deviceId=${deviceId}`)).json()
  assert.equal(got.complete, true)
  assert.deepEqual(got.profile.allergens, ['甲壳类'])
  assert.equal(got.profile.age, 30)
})

test('Agent：问「能不能吃」必须调用档案与判定工具', { timeout: 120000 }, async () => {
  // 先建一份档案，确保 agent 有东西可读
  const deviceId = 'dev_agent_' + Date.now()
  await fetch(`${BASE}/api/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      profile: { allergens: ['大豆'], conditions: [], goal: 'fat_loss' }
    })
  })

  const res = await fetch(`${BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, question: '我能吃麻婆豆腐吗？' })
  })
  assert.equal(res.ok, true, `agent 返回 ${res.status}`)

  const data = await res.json()
  const tools = data.trace.map((t) => t.tool)
  assert.ok(tools.includes('get_profile'), '必须调用 get_profile')
  assert.ok(tools.includes('assess_dishes'), '必须调用 assess_dishes')
  assert.ok(data.answer.includes('别点'), '结论里必须出现「别点」')
  assert.ok(data.answer.includes('大豆'), '必须指出具体过敏原')
})

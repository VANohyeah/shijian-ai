/**
 * 健康评估规则引擎（纯函数，无框架依赖，便于测试与复用）
 *
 * 判定优先级（写死，不允许模型自由发挥）：
 *   过敏  >  孕期  >  慢病  >  目标
 *
 * 过敏命中一律 forbidden，不允许降级 —— 这是产品底线。
 *
 * 数据来源：八大类过敏原（公开标准）、常见膳食禁忌常识（项目自建规则库）。
 * 输出必须带依据，禁止编造。
 */
import type {
  Allergen,
  Condition,
  Dish,
  DishAssessment,
  RiskLevel,
  UserProfile
} from '../../shared/types'

/** 关键词 → 过敏原。模型漏报时的兜底推断。12 类与 C 的 allergens.json 对齐。 */
const ALLERGEN_KEYWORDS: Record<Allergen, string[]> = {
  含麸质谷物: [
    '面粉', '饼底', '面团', '面包', '面条', '小麦', '酥皮', '拉面', '馒头', '饺子皮',
    '挂糊', '面酱', '煎饼', '烧饼', '馍', '油条', '馄饨', '荷叶饼'
  ],
  甲壳类: ['虾', '蟹', '龙虾', '小龙虾', '虾仁', '虾皮', '蟹粉'],
  鱼类: [
    '三文鱼', '金枪鱼', '鳕鱼', '鲈鱼', '草鱼', '带鱼', '沙丁', '凤尾鱼', '鱼片',
    '酸菜鱼', '水煮鱼', '鲅鱼', '鱼头', '鱼'
  ],
  蛋类: ['鸡蛋', '蛋液', '蛋黄', '鹌鹑蛋', '皮蛋', '咸蛋', '蛋皮'],
  花生: ['花生', '花生酱'],
  大豆: ['豆腐', '酱油', '豆豉', '豆浆', '毛豆', '豆瓣', '腐竹', '豆干', '味噌', '黄豆', '豆皮'],
  乳制品: ['奶酪', '芝士', '牛奶', '奶油', '黄油', '酸奶', '乳酪', '淡奶', '炼乳', '双皮奶'],
  坚果: ['杏仁', '核桃', '腰果', '榛子', '开心果', '松子', '碧根果'],
  '贝类/软体': ['贝', '蚝', '牡蛎', '鱿鱼', '章鱼', '扇贝', '蛤', '海参', '鲍', '墨鱼', '花甲', '蛏'],
  芝麻: ['芝麻', '芝麻酱', '麻酱', '香油', '芝麻油'],
  酒精: ['黄酒', '白酒', '啤酒', '花雕', '糟', '醉', '米酒', '酒酿'],
  亚硫酸盐: ['红酒', '果干', '话梅', '蜜饯', '干白']
}

/** 各慢病 / 目标对应的禁忌关键词 */
const CONDITION_KEYWORDS: Record<Condition, { words: string[]; note: string }> = {
  痛风: {
    words: ['内脏', '肝', '腰花', '大肠', '沙丁', '凤尾', '贝', '蟹', '浓汤', '高汤', '老火汤', '啤酒'],
    note: '高嘌呤食物，痛风人群需限制'
  },
  高血压: {
    words: ['腌', '咸', '腊', '火腿', '卤', '酱菜', '泡菜', '咸鱼', '豆豉', '腐乳', '榨菜'],
    note: '高钠食物，高血压人群需控制'
  },
  糖尿病: {
    words: ['糖醋', '拔丝', '蜜汁', '糖', '可乐', '果汁', '蛋糕', '冰淇淋', '甜'],
    note: '含糖量较高，需控制血糖'
  },
  肾病: {
    words: ['腌', '咸', '腊', '卤', '酱', '浓汤', '高汤'],
    note: '钠含量偏高，肾病人群需注意'
  },
  孕期: {
    words: ['刺身', '生蚝', '醉', '溏心', '寿司', '生鱼', '生腌'],
    note: '生食或含酒精，孕期不建议'
  }
}

/** 目标相关的高油 / 高蛋白关键词 */
const GOAL_KEYWORDS = {
  fat_loss: { words: ['油炸', '炸', '干锅', '红烧', '五花肉', '酥', '爆炒', '奶油', '芝士'], note: '油脂偏高，减脂期建议控制' },
  muscle_gain: { words: ['鸡胸', '牛肉', '鱼', '虾', '蛋', '豆腐'], note: '蛋白质来源，适合增肌' },
  sugar_control: { words: ['糖醋', '拔丝', '蜜汁', '糖', '甜', '可乐'], note: '含糖偏高，控糖期建议回避' }
} as const

const LEVEL_ORDER: Record<RiskLevel, number> = { safe: 0, caution: 1, forbidden: 2 }

function textOf(dish: Dish): string {
  return [dish.name, dish.name_zh ?? '', ...dish.ingredients, ...dish.ingredients_zh, ...dish.tags]
    .join(' ')
    .toLowerCase()
}

/**
 * 推断该菜品含有的过敏原。
 * 模型返回的 + 关键词兜底推断，取并集。
 */
export function inferAllergens(dish: Dish): Allergen[] {
  const text = textOf(dish)
  const found = new Set<Allergen>(dish.allergens)

  for (const [allergen, words] of Object.entries(ALLERGEN_KEYWORDS) as [Allergen, string[]][]) {
    for (const w of words) {
      if (text.includes(w.toLowerCase())) {
        found.add(allergen)
        break
      }
    }
  }

  // 陷阱：「鱼香肉丝」没有鱼。只有当「鱼」的唯一证据是「鱼香」时才剔除
  if (text.includes('鱼香') && found.has('鱼类') && !dish.allergens.includes('鱼类')) {
    const otherFishWord = ALLERGEN_KEYWORDS.鱼类.filter((w) => w !== '鱼' && text.includes(w))
    if (otherFishWord.length === 0) found.delete('鱼类')
  }

  return [...found]
}

function hit(words: readonly string[], text: string): string | null {
  for (const w of words) {
    if (text.includes(w.toLowerCase())) return w
  }
  return null
}

/**
 * 评估单道菜。
 */
export function assessDish(dish: Dish, profile: UserProfile): DishAssessment {
  const text = textOf(dish)
  const inferred = inferAllergens(dish)
  const reasons: string[] = []
  const citations: string[] = []
  let level: RiskLevel = 'safe'

  const raise = (next: RiskLevel) => {
    if (LEVEL_ORDER[next] > LEVEL_ORDER[level]) level = next
  }

  // ---- 1. 过敏（最高优先级，命中即 forbidden）----
  const allergyHits = inferred.filter((a) => profile.allergens.includes(a))
  if (allergyHits.length > 0) {
    raise('forbidden')
    reasons.push(`含「${allergyHits.join('、')}」，与你档案中的过敏原冲突`)
    citations.push('八大类过敏原清单 · 交叉检测')
  }

  // ---- 2. 孕期 ----
  if (profile.conditions.includes('孕期')) {
    const w = hit(CONDITION_KEYWORDS.孕期.words, text)
    if (w) {
      raise('forbidden')
      reasons.push(`含「${w}」：${CONDITION_KEYWORDS.孕期.note}`)
      citations.push('孕期饮食禁忌（项目自建规则库 P-01）')
    }
    const heavyMetal = hit(['金枪鱼', '剑鱼', '鲨鱼', '方头鱼'], text)
    if (heavyMetal) {
      raise('caution')
      reasons.push(`含「${heavyMetal}」，汞含量偏高，孕期建议限量`)
      citations.push('孕期饮食禁忌（项目自建规则库 P-02）')
    }
  }

  // ---- 3. 慢病 ----
  for (const condition of profile.conditions) {
    if (condition === '孕期') continue
    const rule = CONDITION_KEYWORDS[condition]
    if (!rule) continue
    const w = hit(rule.words, text)
    if (w) {
      raise('caution')
      reasons.push(`含「${w}」：${rule.note}`)
      citations.push(`慢病饮食限制（项目自建规则库 C-${condition}）`)
    }
  }

  // ---- 4. 饮食目标 ----
  if (profile.goal !== 'none') {
    const rule = GOAL_KEYWORDS[profile.goal as keyof typeof GOAL_KEYWORDS]
    if (rule) {
      const w = hit(rule.words, text)
      if (w) {
        // 增肌目标是正向信息，不提升风险等级
        if (profile.goal === 'muscle_gain') {
          reasons.push(`含「${w}」：${rule.note}`)
        } else {
          raise('caution')
          reasons.push(`含「${w}」：${rule.note}`)
          citations.push(`饮食目标匹配（项目自建规则库 G-${profile.goal}）`)
        }
      }
    }
  }

  // ---- 5. 忌口（宗教戒律 / 素食）----
  if (profile.dietary.includes('素食') && hit(['肉', '猪', '牛', '羊', '鸡', '鸭', '鱼', '虾', '蟹'], text)) {
    raise('forbidden')
    reasons.push('含动物性食材，与素食忌口冲突')
    citations.push('用户忌口设置')
  }
  if (profile.dietary.includes('清真') && hit(['猪', '五花肉', '培根', '火腿', '腊肉'], text)) {
    raise('forbidden')
    reasons.push('含猪肉类食材，与清真忌口冲突')
    citations.push('用户忌口设置')
  }

  const suggestion =
    level === 'forbidden'
      ? '建议换一道，或向店员确认能否去掉该食材'
      : level === 'caution'
        ? '可以吃，但建议控制份量或搭配清淡菜品'
        : null

  return {
    dish_id: dish.id,
    level,
    reasons,
    citations: [...new Set(citations)],
    suggestion
  }
}

/** 评估整桌菜，并给出汇总 */
export function assessMenu(dishes: Dish[], profile: UserProfile) {
  const assessments = dishes.map((d) => assessDish(d, profile))
  const summary = {
    total: assessments.length,
    safe: assessments.filter((a) => a.level === 'safe').length,
    caution: assessments.filter((a) => a.level === 'caution').length,
    forbidden: assessments.filter((a) => a.level === 'forbidden').length
  }
  return { assessments, summary }
}

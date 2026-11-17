<script setup lang="ts">
import type { Dish, DishAssessment } from '~/shared/types'

const props = defineProps<{
  dish: Dish
  assessment?: DishAssessment & { references?: { title: string; source: string }[] }
  faved?: boolean
  editable?: boolean
  linkTo?: string
}>()

const emit = defineEmits<{
  (e: 'toggle-fav', dish: Dish): void
  (e: 'edit', dish: Dish): void
}>()

const target = computed(() => props.linkTo ?? `/dish/${props.dish.id}`)
const title = computed(() => props.dish.name_zh || props.dish.name)

const original = computed(() =>
  props.dish.name_zh && props.dish.name_zh !== props.dish.name ? props.dish.name : ''
)

const ingredients = computed(() =>
  props.dish.ingredients_zh.length ? props.dish.ingredients_zh : props.dish.ingredients
)

const SPICY = ['不辣', '微辣', '中辣', '特辣'] as const
const meta = computed(() =>
  [props.dish.city, props.dish.region, props.dish.spicy_level === null ? '' : SPICY[props.dish.spicy_level]]
    .filter(Boolean)
    .join(' · ')
)

const lowConfidence = computed(() => props.dish.confidence < 0.5)
</script>

<template>
  <article class="dish" :class="assessment ? `lv-${assessment.level}` : ''">
    <div class="head">
      <div class="id">
        <NuxtLink :to="target" class="name">{{ title }}</NuxtLink>
        <span v-if="original" class="orig">{{ original }}</span>
      </div>

      <div class="acts">
        <span v-if="dish.reference_price !== null" class="price">¥{{ dish.reference_price }}</span>
        <button
          v-if="editable"
          type="button"
          class="act"
          title="认得不对？改一下菜名或料"
          aria-label="修改菜名或食材"
          @click="emit('edit', dish)"
        >
          改
        </button>
        <button
          v-if="faved !== undefined"
          type="button"
          class="act act--fav"
          :aria-pressed="faved"
          :aria-label="faved ? '取消收藏这道菜' : '收藏这道菜'"
          @click="emit('toggle-fav', dish)"
        >
          {{ faved ? '★' : '☆' }}
        </button>
      </div>
    </div>

    <p v-if="meta" class="meta">{{ meta }}</p>
    <p v-if="ingredients.length" class="line">食材：{{ ingredients.join('、') }}</p>
    <p v-if="dish.allergens.length" class="line line--warn">
      可能含：{{ dish.allergens.join('、') }}
    </p>
    <p v-if="lowConfidence" class="low">照片不一定看得准，名字和料你顺手核对一眼</p>

    <div v-if="assessment" class="verdict">
      <VerdictBadge :level="assessment.level" />
      <ul v-if="assessment.reasons.length" class="reasons">
        <li v-for="r in assessment.reasons" :key="r">{{ r }}</li>
      </ul>
      <p v-if="assessment.citations.length" class="cites">
        依据：{{ assessment.citations.join('；') }}
      </p>
    </div>
  </article>
</template>

<style scoped>
.dish {
  border: 2px solid var(--rule);
  border-radius: var(--r);
  padding: 13px 15px;
  margin-bottom: 12px;
  background: var(--paper-lifted);
  transition: border-color 300ms cubic-bezier(0.33, 1, 0.68, 1);
}

.dish.lv-safe {
  border-left-color: var(--forest);
}

.dish.lv-caution {
  border-left-color: var(--olive);
}

.dish.lv-forbidden {
  border-left-color: var(--brick);
}

.dish.lv-safe,
.dish.lv-caution,
.dish.lv-forbidden {
  border-left-width: 2px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.name {
  font-family: var(--serif);
  font-weight: 900;
  font-size: 22px;
  letter-spacing: 0.04em;
  line-height: 1.3;
  color: var(--sepia-deep);
  text-decoration: none;
  border-bottom: 1px dashed transparent;
  transition: border-color 300ms cubic-bezier(0.33, 1, 0.68, 1);
}

.name:hover {
  border-bottom-color: var(--sepia);
}

.name:focus-visible {
  outline: 2px solid var(--sepia);
  outline-offset: 3px;
}

.orig {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
}

.acts {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.price {
  font-family: var(--serif);
  font-weight: 700;
  font-size: 17px;
  color: var(--sepia);
  margin-right: 2px;
}

.act {
  position: relative;
  min-width: 32px;
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid var(--rule);
  border-radius: var(--r);
  background: transparent;
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 300ms cubic-bezier(0.33, 1, 0.68, 1),
    color 300ms cubic-bezier(0.33, 1, 0.68, 1);
}

.act::after {
  content: '';
  position: absolute;
  inset: -6px;
}

.act:hover {
  border-color: var(--sepia);
  color: var(--sepia);
}

.act:focus-visible {
  outline: 2px solid var(--sepia);
  outline-offset: 2px;
}

.act--fav[aria-pressed='true'] {
  color: var(--sepia);
  border-color: var(--sepia);
}

.meta {
  margin: 6px 0 0;
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
}

.line {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-muted);
}

.line--warn {
  color: var(--brick);
}

.low {
  margin: 8px 0 0;
  padding: 5px 9px;
  border-left: 2px solid var(--sand);
  background: rgba(212, 163, 115, 0.14);
  font-size: 12px;
  line-height: 1.6;
  color: var(--sepia-deep);
}

.verdict {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--rule);
}

.reasons {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink);
}

.cites {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-muted);
}
</style>

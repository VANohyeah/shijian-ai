<script setup lang="ts">
import type { Dish, DishAssessment } from '~/shared/types'

const props = defineProps<{
  dish: Dish
  assessment?: DishAssessment & { references?: { title: string; source: string }[] }
  faved?: boolean
  linkTo?: string
}>()

const emit = defineEmits<{ (e: 'toggle-fav', dish: Dish): void }>()

const target = computed(() => props.linkTo ?? `/dish/${props.dish.id}`)
const ingredients = computed(() =>
  props.dish.ingredients_zh.length ? props.dish.ingredients_zh : props.dish.ingredients
)
</script>

<template>
  <div class="dish">
    <div class="dish-head">
      <div>
        <NuxtLink :to="target" class="dish-name">{{ dish.name_zh || dish.name }}</NuxtLink>
        <span v-if="dish.name_zh && dish.name_zh !== dish.name" class="orig">{{ dish.name }}</span>
        <span v-else class="orig">
          {{ dish.region }}<template v-if="dish.method"> · {{ dish.method }}</template>
        </span>
      </div>
      <div class="row" style="gap: 10px">
        <span v-if="dish.reference_price !== null" class="price">¥{{ dish.reference_price }}</span>
        <button v-if="faved !== undefined" class="star" @click="emit('toggle-fav', dish)">
          {{ faved ? '★' : '☆' }}
        </button>
      </div>
    </div>

    <p v-if="ingredients.length" class="line">食材：{{ ingredients.join('、') }}</p>
    <p v-if="dish.allergens.length" class="line warn">⚠ 可能含：{{ dish.allergens.join('、') }}</p>

    <div v-if="assessment" class="assess">
      <VerdictBadge :level="assessment.level" />
      <ul v-if="assessment.reasons.length" class="reasons">
        <li v-for="r in assessment.reasons" :key="r">{{ r }}</li>
      </ul>
      <p v-if="assessment.citations.length" class="cites">
        依据：{{ assessment.citations.join('；') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.star {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 8px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1.4;
}
.assess {
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px dashed #e5e7eb;
}
</style>

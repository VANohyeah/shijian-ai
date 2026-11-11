<script setup lang="ts">
import type { DishAssessment, RiskLevel } from '~/shared/types'

defineProps<{ level: RiskLevel }>()

const TEXT: Record<RiskLevel, string> = {
  safe: '✅ 可以吃',
  caution: '⚠️ 注意',
  forbidden: '⛔ 别点'
}
</script>

<template>
  <span :class="['badge', level]">{{ TEXT[level] }}</span>
</template>

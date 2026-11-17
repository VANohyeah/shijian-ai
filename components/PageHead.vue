<script setup lang="ts">

defineProps<{

  kicker?: string
  title: string

  lede?: string

  backTo?: string
  backLabel?: string
}>()
</script>

<template>
  <header class="page-head">
    <NuxtLink v-if="backTo" :to="backTo" class="page-head__back">← {{ backLabel || '返回' }}</NuxtLink>

    <p v-if="kicker" class="page-head__kicker">{{ kicker }}</p>
    <h1 class="page-head__title">{{ title }}</h1>
    <p v-if="lede" class="page-head__lede">{{ lede }}</p>
  </header>
</template>

<style scoped>
.page-head {
  padding-bottom: 24px;
  margin-bottom: 32px;
  border-bottom: 2px solid var(--line);
}

.page-head__back {
  display: inline-block;
  margin-bottom: 20px;
  font-size: 13px;
  color: var(--muted);
  transition: color var(--dur) var(--ease);
}

.page-head__back:hover {
  color: var(--sepia);
}

.page-head__kicker {
  margin-bottom: 10px;
  font-size: 12px;
  letter-spacing: 0.22em;
  color: var(--muted);
}

.page-head__title {
  font-size: clamp(28px, 4vw, 40px);
  letter-spacing: 0.06em;
  line-height: 1.14;
}

.page-head__lede {
  max-width: 36em;
  margin-top: 12px;
  font-size: 15px;
  line-height: 1.9;
  color: var(--muted);
}
</style>

<script setup lang="ts">
import { describeError } from '~/composables/errors'

interface City {
  id: string
  name: string
  area: string
  region: string
  intro: string
  dishCount: number
}

const cities = ref<City[]>([])
const areas = ref<string[]>([])
const error = ref('')

onMounted(async () => {
  try {
    const res = await fetch('/api/cities')
    const data = (await res.json()) as { cities: City[]; areas: string[] }
    cities.value = data.cities
    areas.value = data.areas
  } catch (err) {
    error.value = describeError(err, '把城市列表取回来')
  }
})

function byArea(area: string) {
  return cities.value.filter((c) => c.area === area)
}
</script>

<template>
  <main class="wrap wrap--list">
    <PageHead
      back-to="/"
      back-label="回首页"
      kicker="30 城 · 250 道"
      title="找地方菜"
    />

    <p v-if="error" class="err">{{ error }}</p>

    <div class="areas">
      <section v-for="area in areas" :key="area" class="area">
        <h2 class="area__title">{{ area }}</h2>
        <div class="grid">
          <NuxtLink
            v-for="c in byArea(area)"
            :key="c.id"
            :to="`/city/${c.id}`"
            class="tile"
          >
            <strong>{{ c.name }}</strong>
            <span class="tile__meta">{{ c.region }} · {{ c.dishCount }} 道</span>
          </NuxtLink>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>

.areas {
  margin-top: 4px;
}

.area + .area {
  margin-top: 40px;
}

.area__title {
  padding-bottom: 10px;
  margin-bottom: 16px;
  border-bottom: 2px solid var(--line);
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0.16em;
  color: var(--sepia);
}

.grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

.tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 20px;
  will-change: transform;
  transition: transform 200ms cubic-bezier(0.33, 1, 0.68, 1),
    box-shadow 200ms cubic-bezier(0.33, 1, 0.68, 1), border-color var(--dur) var(--ease);
}

.tile:hover {
  transform: translateY(-3px);
  border-color: var(--line-strong);
  box-shadow: 0 10px 18px -10px rgba(139, 69, 19, 0.3), 0 3px 6px -4px rgba(139, 69, 19, 0.16);
}

@media (prefers-reduced-motion: reduce) {
  .tile {
    transition: none;
  }

  .tile:hover {
    transform: none;
  }
}

.tile strong {
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.04em;
  margin-bottom: 0;
}

.tile__meta {
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--muted);
}
</style>

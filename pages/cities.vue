<script setup lang="ts">
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
    error.value = String(err)
  }
})

function byArea(area: string) {
  return cities.value.filter((c) => c.area === area)
}
</script>

<template>
  <main class="wrap">
    <h1>找地方菜</h1>
    <p class="muted">30 座城市、250 道地方特色菜。点进去，每道菜都会按你的档案标出能不能吃。</p>

    <p v-if="error" class="err">{{ error }}</p>

    <section v-for="area in areas" :key="area">
      <h2>{{ area }}</h2>
      <div class="grid">
        <NuxtLink
          v-for="c in byArea(area)"
          :key="c.id"
          :to="`/city/${c.id}`"
          class="tile"
        >
          <strong>{{ c.name }}</strong>
          <span class="muted">{{ c.region }} · {{ c.dishCount }} 道</span>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>

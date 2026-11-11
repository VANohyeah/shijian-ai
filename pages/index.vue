<script setup lang="ts">
const { deviceId, ensure } = useDeviceId()
const { load: loadProfile } = useProfile()
const history = ref<{ id: string; title: string; createdAt: string; dishes: unknown[] }[]>([])

onMounted(async () => {
  ensure()
  await loadProfile()
  try {
    const res = await fetch(`/api/user/data?deviceId=${encodeURIComponent(deviceId.value)}`)
    if (res.ok) {
      const data = (await res.json()) as { history: typeof history.value }
      history.value = (data.history ?? []).slice(0, 3)
    }
  } catch {
    /* 首页不因历史失败而报错 */
  }
})

function fmt(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`
}
</script>

<template>
  <main class="wrap">
    <section class="hero">
      <h1>这顿饭，你能吃吗</h1>
      <p class="muted">
        拍一张菜单，它看懂每道菜的食材；结合你的过敏与身体状况，告诉你哪道别点、为什么。
      </p>
    </section>

    <div class="grid">
      <NuxtLink to="/scan" class="tile">
        <strong>📷 拍菜单</strong>
        <span class="muted">识别菜品 · 风险分级 · 可收藏</span>
      </NuxtLink>
      <NuxtLink to="/cities" class="tile">
        <strong>🗺️ 找地方菜</strong>
        <span class="muted">30 城 250 道 · 直接标出你能不能吃</span>
      </NuxtLink>
    </div>

    <section v-if="history.length">
      <h2>最近看过</h2>
      <div v-for="h in history" :key="h.id" class="mini">
        <div>
          <strong>{{ h.title }}</strong>
          <span class="orig">{{ fmt(h.createdAt) }}</span>
        </div>
        <span class="muted">{{ h.dishes.length }} 道</span>
      </div>
      <NuxtLink to="/favorites" class="muted">查看全部记录 →</NuxtLink>
    </section>

    <section v-else class="card">
      <p class="muted" style="margin: 0">
        还没有记录。先去
        <NuxtLink to="/profile">填一份档案</NuxtLink>，再去
        <NuxtLink to="/scan">拍一张菜单</NuxtLink>。
      </p>
    </section>
  </main>
</template>

<style scoped>
.hero {
  padding: 26px 0 20px;
}
.hero h1 {
  font-size: 26px;
  margin: 0 0 8px;
}
.hero p {
  max-width: 36em;
  line-height: 1.7;
}
</style>

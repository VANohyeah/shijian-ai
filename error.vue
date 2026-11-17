<script setup lang="ts">

const props = defineProps<{ error: { statusCode: number; statusMessage?: string } }>()

const is404 = computed(() => props.error.statusCode === 404)

function goHome() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <main class="wrap err-page">
    <p class="err-page__code">{{ error.statusCode }}</p>

    <h1>{{ is404 ? '这道菜不在菜单上' : '后厨出了点岔子' }}</h1>

    <p class="err-page__lede">
      <template v-if="is404">
        你要找的页面不在了，可能链接抄错了，或者这条记录已经被删掉。
      </template>
      <template v-else>
        {{ error.statusMessage || '请求没能完成。多半是模型或数据接口一时没响应，重试一次通常就好。' }}
      </template>
    </p>

    <div class="err-page__acts">
      <button class="btn" @click="goHome">回首页</button>
      <NuxtLink to="/cities" class="txt">或者看看哪座城市的菜你能吃</NuxtLink>
    </div>
  </main>
</template>

<style scoped>
.err-page {
  max-width: 620px;
  padding-top: 96px;
  padding-bottom: 96px;
}

.err-page__code {
  font-family: var(--serif);
  font-size: 64px;
  line-height: 1;
  letter-spacing: 0.06em;
  color: var(--line-strong);
}

.err-page__lede {
  margin-top: 14px;
  max-width: 34em;
  font-size: 15px;
  line-height: 1.9;
  color: var(--muted);
}

.err-page__acts {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 28px;
}

.txt {
  font-size: 13px;
  color: var(--muted);
  border-bottom: 1px dashed var(--line-strong);
  transition: color var(--dur) var(--ease);
}

.txt:hover {
  color: var(--sepia);
}
</style>

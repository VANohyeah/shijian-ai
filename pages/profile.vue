<script setup lang="ts">
const { profile, loaded, saving, load, save } = useProfile()
const hint = ref('')

onMounted(async () => {
  await load()
})

async function onSave() {
  const res = await save()
  hint.value = res.ok ? '已保存，之后每次识别都会用这份档案' : '保存失败：' + res.message
}
</script>

<template>
  <main class="wrap">
    <h1>我的档案</h1>
    <p class="muted">
      填一次就够。之后拍菜单、看城市菜，都会按这份档案判断。数据只存在本机，不上传第三方。
    </p>

    <div class="card">
      <p v-if="!loaded" class="hint">加载中…</p>
      <ProfileForm v-model="profile" />
      <div class="row" style="margin-top: 16px">
        <button class="btn" :disabled="saving" @click="onSave">
          {{ saving ? '保存中…' : '保存档案' }}
        </button>
        <span v-if="hint" class="hint">{{ hint }}</span>
      </div>
    </div>
  </main>
</template>

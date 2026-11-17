<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div>

    <AppHeader v-if="route.path !== '/'" />
    <NuxtPage />
    <SiteFoot v-if="route.path !== '/'" />
  </div>
</template>

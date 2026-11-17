<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'


const { user, sync } = useAuth()
onMounted(sync)
</script>

<template>
  <header class="nav">
    <NuxtLink to="/" class="brand">食鉴</NuxtLink>
    <nav>
      <NuxtLink to="/scan">拍菜单</NuxtLink>
      <NuxtLink to="/chat">问食鉴</NuxtLink>
      <NuxtLink to="/cities">找地方菜</NuxtLink>
      <NuxtLink to="/favorites">我的</NuxtLink>

      <NuxtLink v-if="!user" to="/login" class="signin">登录</NuxtLink>
      <NuxtLink v-else to="/profile" class="avatar" :aria-label="'账号 ' + user">
        {{ user.slice(0, 1) }}
      </NuxtLink>
    </nav>
  </header>
</template>

<style scoped>

.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px var(--pad);
  background: var(--lifted);
  border-bottom: 2px solid var(--sepia);
}

.brand {
  font-family: var(--serif);
  font-weight: 500;
  font-size: 21px;
  letter-spacing: 0.1em;
  color: var(--sepia);
  text-decoration: none;
}

nav {
  display: flex;
  gap: 26px;
  align-items: center;
}

nav a:not(.avatar):not(.signin) {
  position: relative;
  font-size: 15px;
  letter-spacing: 0.04em;
  color: var(--ink);
  text-decoration: none;
  padding-bottom: 3px;
  transition: color var(--dur) var(--ease);
}


nav a:not(.avatar):not(.signin)::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

nav a:not(.avatar):not(.signin):hover::after {
  transform: scaleX(1);
  transform-origin: left;
}

nav a:hover {
  color: var(--sepia);
}


nav a:not(.avatar):not(.signin).router-link-active {
  color: var(--sepia-deep);
  font-weight: 500;
}

nav a:not(.avatar):not(.signin).router-link-active::after {
  transform: scaleX(1);
  transform-origin: left;
  height: 2px;
}


.signin {
  padding: 5px 14px;
  border: 2px solid var(--sepia);
  border-radius: var(--radius);
  color: var(--sepia);
  font-size: 14px;
  letter-spacing: 0.08em;
  transition: background-color var(--dur) var(--ease), color var(--dur) var(--ease);
}

.signin:hover {
  background: var(--sepia);
  color: var(--cream) !important;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: var(--radius);
  background: var(--sepia);
  color: var(--cream) !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: background-color var(--dur) var(--ease);
}

.avatar:hover,
.avatar.router-link-active {
  background: var(--sepia-deep);
}

@media (prefers-reduced-motion: reduce) {
  nav a:not(.avatar):not(.signin)::after {
    transition: none;
  }
}
</style>

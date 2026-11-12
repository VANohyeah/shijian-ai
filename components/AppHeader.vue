<template>
  <header class="nav">
    <NuxtLink to="/" class="brand">食鉴</NuxtLink>
    <nav>
      <NuxtLink to="/scan">拍菜单</NuxtLink>
      <NuxtLink to="/chat">问食鉴</NuxtLink>
      <NuxtLink to="/cities">找地方菜</NuxtLink>
      <NuxtLink to="/favorites">我的</NuxtLink>
      <NuxtLink to="/profile" class="avatar" aria-label="档案">我</NuxtLink>
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
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #ebedf0;
}
.brand {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.5px;
  text-decoration: none;
}
nav {
  display: flex;
  gap: 14px;
  align-items: center;
}
nav a {
  font-size: 13px;
  color: #4b5563;
  text-decoration: none;
}
nav a:hover {
  color: #111827;
}
.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #111827;
  color: #fff !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
</style>

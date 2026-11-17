<template>
  <footer class="site-foot">
    <div class="site-foot__in">
      <p class="site-foot__sign">坐下点菜，先看哪道得让开</p>
    </div>
  </footer>
</template>

<style scoped>

.site-foot {
  border-top: 2px solid var(--line-strong);
  background: var(--lifted);
}

.site-foot__in {
  display: flex;
  justify-content: center;
  max-width: var(--max);
  margin: 0 auto;
  padding: 20px var(--pad) 22px;
}

.site-foot__sign {
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--muted);
}
</style>

<script setup lang="ts">
import type { RiskLevel } from '~/shared/types'
import { LEVEL_LABEL } from '~/shared/types'

defineProps<{ level: RiskLevel }>()


</script>

<template>
  <span :class="['vb', level]">
    <span class="mark" aria-hidden="true"></span>
    {{ LEVEL_LABEL[level] }}
  </span>
</template>

<style scoped>

.vb {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px 4px 10px;
  border-radius: var(--r);
  background: var(--forest);
  color: var(--cream);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.14em;
  line-height: 1.4;
  white-space: nowrap;
}


.mark {
  width: 9px;
  height: 9px;
  flex: none;
  background: var(--paper);
  border-radius: 50%;
}

.safe {
  background: var(--forest);
}

.caution {
  background: var(--olive);
}

.caution .mark {
  border-radius: 1px;
}

.forbidden {
  background: var(--brick);
}

.forbidden .mark {
  border-radius: 1px;
  transform: rotate(45deg);
}
</style>

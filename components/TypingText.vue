<script setup lang="ts">

const props = withDefaults(defineProps<{ text: string; speed?: number }>(), { speed: 28 })

const shown = ref('')
const done = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  if (reduce) {
    shown.value = props.text
    done.value = true
    return
  }

  let i = 0
  timer = setInterval(() => {
    i += 1
    shown.value = props.text.slice(0, i)
    if (i >= props.text.length) {
      done.value = true
      stop()
    }
  }, props.speed)
})

onBeforeUnmount(stop)
</script>

<template>
  <span class="typing">{{ shown }}<span v-if="!done" class="typing__caret" aria-hidden="true" /></span>
</template>

<style scoped>
.typing__caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.12em;
  background: currentColor;
  animation: caret-blink 1s steps(1) infinite;
}

@keyframes caret-blink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing__caret {
    animation: none;
    opacity: 0;
  }
}
</style>

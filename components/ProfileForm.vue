<script setup lang="ts">
import { ALLERGEN_OPTIONS, CONDITION_OPTIONS, type ProfileState } from '~/composables/useProfile'

const profile = defineModel<ProfileState>({ required: true })

const goals = [
  { value: 'none', label: '无特殊' },
  { value: 'fat_loss', label: '减脂' },
  { value: 'muscle_gain', label: '增肌' },
  { value: 'sugar_control', label: '控糖' }
]

const activities = [
  { value: 'sedentary', label: '久坐' },
  { value: 'light', label: '轻度活动' },
  { value: 'moderate', label: '中度活动' },
  { value: 'active', label: '高强度' }
]

function toggle(list: string[], value: string) {
  const i = list.indexOf(value)
  if (i >= 0) list.splice(i, 1)
  else list.push(value)
}
</script>

<template>
  <div class="form">
    <div class="row">
      <label>性别
        <select v-model="profile.gender" class="select">
          <option value="female">女</option>
          <option value="male">男</option>
        </select>
      </label>
      <label>年龄 <input v-model.number="profile.age" type="number" min="1" max="120" class="input num" /></label>
      <label>身高 <input v-model.number="profile.height_cm" type="number" class="input num" /> cm</label>
      <label>体重 <input v-model.number="profile.weight_kg" type="number" class="input num" /> kg</label>
    </div>

    <div class="row">
      <label>活动量
        <select v-model="profile.activity" class="select">
          <option v-for="a in activities" :key="a.value" :value="a.value">{{ a.label }}</option>
        </select>
      </label>
      <label>目标
        <select v-model="profile.goal" class="select">
          <option v-for="g in goals" :key="g.value" :value="g.value">{{ g.label }}</option>
        </select>
      </label>
    </div>

    <div class="block">
      <span class="label">过敏原（可多选）</span>
      <div class="chips">
        <button
          v-for="a in ALLERGEN_OPTIONS"
          :key="a"
          type="button"
          :class="['chip', { on: profile.allergens.includes(a) }]"
          @click="toggle(profile.allergens, a)"
        >
          {{ a }}
        </button>
      </div>
    </div>

    <div class="block">
      <span class="label">身体状况</span>
      <div class="chips">
        <button
          v-for="c in CONDITION_OPTIONS"
          :key="c"
          type="button"
          :class="['chip', { on: profile.conditions.includes(c) }]"
          @click="toggle(profile.conditions, c)"
        >
          {{ c }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
label {
  font-size: 13px;
  color: #4b5563;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.num {
  width: 74px;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.label {
  font-size: 13px;
  color: #4b5563;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  color: #374151;
}
.chip.on {
  background: #111827;
  color: #fff;
  border-color: #111827;
}
</style>

<script setup lang="ts">
import {
  ALLERGEN_OPTIONS,
  CONDITION_OPTIONS,
  type ProfileState
} from '~/composables/useProfile'
import { GOAL_LABEL } from '~/shared/types'

const props = defineProps<{ step: number; errors?: Record<string, string> }>()
const profile = defineModel<ProfileState>({ required: true })

const GOAL_ORDER = ['none', 'fat_loss', 'muscle_gain', 'sugar_control'] as const

const GOAL_DESC: Record<(typeof GOAL_ORDER)[number], string> = {
  none: '只盯过敏和忌口',
  fat_loss: '油多的、糖多的，我提醒你',
  muscle_gain: '高蛋白的菜，我给你加分',
  sugar_control: '糖高的菜，我圈出来'
}

const activities = [
  { value: 'sedentary', label: '久坐', desc: '一天坐满八个钟头' },
  { value: 'light', label: '轻度', desc: '一周动个一两回' },
  { value: 'moderate', label: '中度', desc: '一周动三四回' },
  { value: 'active', label: '高强度', desc: '天天在动' }
] as const

const DIETARY_OPTIONS = ['素食', '清真'] as const

function toggle(list: string[], value: string) {
  const i = list.indexOf(value)
  if (i >= 0) list.splice(i, 1)
  else list.push(value)
}
</script>

<template>
  <div class="form">

    <div v-if="props.step === 1" class="panel">
      <div class="row">
        <label class="field">
          <span class="lb">性别</span>
          <div class="seg">
            <button
              type="button"
              :class="{ on: profile.gender === 'female' }"
              @click="profile.gender = 'female'"
            >
              女
            </button>
            <button
              type="button"
              :class="{ on: profile.gender === 'male' }"
              @click="profile.gender = 'male'"
            >
              男
            </button>
          </div>
        </label>

        <label class="field">
          <span class="lb">年龄</span>
          <input
            v-model.number="profile.age"
            type="number"
            min="1"
            max="120"
            class="input"
            :class="{ bad: props.errors?.age }"
          />
          <span v-if="props.errors?.age" class="err">{{ props.errors.age }}</span>
        </label>
      </div>

      <div class="row">
        <label class="field">
          <span class="lb">身高</span>
          <span class="with-unit">
            <input
              v-model.number="profile.height_cm"
              type="number"
              class="input"
              :class="{ bad: props.errors?.height_cm }"
            />
            <em>cm</em>
          </span>
          <span v-if="props.errors?.height_cm" class="err">{{ props.errors.height_cm }}</span>
        </label>

        <label class="field">
          <span class="lb">体重</span>
          <span class="with-unit">
            <input
              v-model.number="profile.weight_kg"
              type="number"
              class="input"
              :class="{ bad: props.errors?.weight_kg }"
            />
            <em>kg</em>
          </span>
          <span v-if="props.errors?.weight_kg" class="err">{{ props.errors.weight_kg }}</span>
        </label>
      </div>

      <p class="note">只用来算 BMI 和热量档，不外传。</p>
    </div>


    <div v-else-if="props.step === 2" class="panel">
      <div class="block">
        <span class="lb">平时活动量</span>
        <div class="options">
          <button
            v-for="a in activities"
            :key="a.value"
            type="button"
            :class="['option', { on: profile.activity === a.value }]"
            @click="profile.activity = a.value"
          >
            <b>{{ a.label }}</b>
            <span>{{ a.desc }}</span>
          </button>
        </div>
      </div>

      <div class="block">
        <span class="lb">这阵子的目标</span>
        <div class="options">
          <button
            v-for="g in GOAL_ORDER"
            :key="g"
            type="button"
            :class="['option', { on: profile.goal === g }]"
            @click="profile.goal = g"
          >
            <b>{{ GOAL_LABEL[g] }}</b>
            <span>{{ GOAL_DESC[g] }}</span>
          </button>
        </div>
      </div>

      <div class="block">
        <span class="lb">饮食忌口</span>
        <div class="chips">
          <button
            v-for="d in DIETARY_OPTIONS"
            :key="d"
            type="button"
            :class="['chip', { on: profile.dietary.includes(d) }]"
            :aria-pressed="profile.dietary.includes(d)"
            @click="toggle(profile.dietary, d)"
          >
            {{ d }}
          </button>
        </div>
      </div>
    </div>


    <div v-else class="panel">
      <div class="block">
        <span class="lb">过敏原<em class="hint-inline">撞上就「别点」</em></span>
        <div class="chips">
          <button
            v-for="a in ALLERGEN_OPTIONS"
            :key="a"
            type="button"
            :class="['chip', { on: profile.allergens.includes(a) }]"
            :aria-pressed="profile.allergens.includes(a)"
            @click="toggle(profile.allergens, a)"
          >
            {{ a }}
          </button>
        </div>
      </div>

      <div class="block">
        <span class="lb">身体状况<em class="hint-inline">撞上升「注意」</em></span>
        <div class="chips">
          <button
            v-for="c in CONDITION_OPTIONS"
            :key="c"
            type="button"
            :class="['chip', { on: profile.conditions.includes(c) }]"
            :aria-pressed="profile.conditions.includes(c)"
            @click="toggle(profile.conditions, c)"
          >
            {{ c }}
          </button>
        </div>
      </div>

      <p class="note">
        不选也能用，只是我只能看过敏这一层。
      </p>
    </div>
  </div>
</template>

<style scoped>
.form {
  display: block;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.lb {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.12em;
  color: var(--ink-muted);
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.hint-inline {
  font-style: normal;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: var(--sepia);
  opacity: 0.75;
}

.input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--rule);
  border-radius: var(--r);
  background: var(--paper);
  color: var(--ink);
  font-family: inherit;
  font-size: 15px;
  transition: border-color 300ms cubic-bezier(0.33, 1, 0.68, 1);
}

.input:hover {
  border-color: var(--rule-strong);
}

.input:focus {
  outline: none;
  border-color: var(--sepia);
}

.input.bad {
  border-color: var(--brick);
}

.err {
  font-size: 12px;
  line-height: 1.5;
  color: var(--brick);
}

.with-unit {
  position: relative;
  display: block;
}

.with-unit em {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-style: normal;
  font-size: 12px;
  color: var(--ink-muted);
}

.seg {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  border: 2px solid var(--rule);
  border-radius: var(--r);
  overflow: hidden;
}

.seg button {
  padding: 10px 0;
  border: 0;
  background: var(--paper);
  color: var(--ink-muted);
  font-family: inherit;
  font-size: 15px;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background-color 300ms cubic-bezier(0.33, 1, 0.68, 1),
    color 300ms cubic-bezier(0.33, 1, 0.68, 1);
}

.seg button + button {
  border-left: 2px solid var(--rule);
}

.seg button.on {
  background: var(--sepia);
  color: var(--cream);
}

.block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.option {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 11px 13px;
  border: 2px solid var(--rule);
  border-radius: var(--r);
  background: var(--paper);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 300ms cubic-bezier(0.33, 1, 0.68, 1);
}

.option b {
  font-size: 15px;
  font-weight: 500;
  color: var(--ink);
}

.option span {
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink-muted);
}

.option.on {
  border-color: var(--sepia);
}

.option.on b {
  color: var(--sepia);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 8px 14px;
  border: 2px solid var(--rule);
  border-radius: var(--r);
  background: var(--paper);
  color: var(--ink-muted);
  font-family: inherit;
  font-size: 13px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background-color 300ms cubic-bezier(0.33, 1, 0.68, 1),
    border-color 300ms cubic-bezier(0.33, 1, 0.68, 1),
    color 300ms cubic-bezier(0.33, 1, 0.68, 1);
}

.chip:hover {
  border-color: var(--rule-strong);
}

.chip.on {
  background: var(--sepia);
  border-color: var(--sepia);
  color: var(--cream);
}

.note {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--ink-muted);
}
</style>

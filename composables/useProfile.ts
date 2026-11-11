/**
 * 档案与设备 ID 的共享逻辑。
 * 页面多了以后每个页面都写一遍 fetch 会失控，收敛到这里。
 */
import type { UserProfile } from '~/shared/types'

const DEVICE_KEY = 'shijian_device_id'

export function useDeviceId() {
  const deviceId = useState<string>('deviceId', () => '')

  function ensure() {
    if (!import.meta.client) return
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
      localStorage.setItem(DEVICE_KEY, id)
    }
    deviceId.value = id
  }

  return { deviceId, ensure }
}

export interface ProfileState {
  gender: 'male' | 'female'
  age: number
  height_cm: number
  weight_kg: number
  activity: 'sedentary' | 'light' | 'moderate' | 'active'
  goal: 'fat_loss' | 'muscle_gain' | 'sugar_control' | 'none'
  allergens: string[]
  conditions: string[]
  dietary: string[]
}

export const ALLERGEN_OPTIONS = [
  '含麸质谷物',
  '甲壳类',
  '鱼类',
  '蛋类',
  '花生',
  '大豆',
  '乳制品',
  '坚果',
  '贝类/软体',
  '芝麻',
  '酒精',
  '亚硫酸盐'
] as const

export const CONDITION_OPTIONS = ['痛风', '高血压', '糖尿病', '肾病', '孕期'] as const

export function defaultProfile(): ProfileState {
  return {
    gender: 'female',
    age: 25,
    height_cm: 165,
    weight_kg: 55,
    activity: 'light',
    goal: 'none',
    allergens: [],
    conditions: [],
    dietary: []
  }
}

export function useProfile() {
  const { deviceId, ensure } = useDeviceId()
  const profile = useState<ProfileState>('profile', defaultProfile)
  const loaded = useState<boolean>('profileLoaded', () => false)
  const saving = useState<boolean>('profileSaving', () => false)

  async function load() {
    if (!import.meta.client) return
    ensure()
    try {
      const res = await fetch(`/api/profile?deviceId=${encodeURIComponent(deviceId.value)}`)
      if (res.ok) {
        const data = (await res.json()) as { profile: UserProfile | null; complete: boolean }
        if (data.complete && data.profile) {
          Object.assign(profile.value, data.profile)
        }
      }
    } catch {
      /* 读不到就用默认档案 */
    } finally {
      loaded.value = true
    }
  }

  async function save() {
    if (!import.meta.client) return { ok: false }
    ensure()
    saving.value = true
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: deviceId.value, profile: profile.value })
      })
      return { ok: res.ok, message: res.ok ? '已保存' : await res.text() }
    } catch (err) {
      return { ok: false, message: String(err) }
    } finally {
      saving.value = false
    }
  }

  return { profile, loaded, saving, load, save }
}

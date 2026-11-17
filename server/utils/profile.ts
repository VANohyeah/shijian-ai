
import type { UserProfile } from '../../shared/types'
import { DEFAULT_PROFILE } from '../../shared/types'
import { getProfile } from './store'

export function mergeProfile(partial?: Partial<UserProfile> | null): UserProfile {
  return {
    ...DEFAULT_PROFILE,
    ...partial,
    allergens: partial?.allergens ?? [],
    conditions: partial?.conditions ?? [],
    dietary: partial?.dietary ?? []
  }
}

export interface ProfileSource {
  profile?: Partial<UserProfile>
  deviceId?: string
}

export async function resolveProfile(source?: ProfileSource | null): Promise<UserProfile> {
  if (source?.profile) return mergeProfile(source.profile)

  if (source?.deviceId && source.deviceId.length >= 8) {
    const saved = await getProfile(source.deviceId)
    if (saved) return saved
  }

  return mergeProfile(null)
}

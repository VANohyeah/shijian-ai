
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { Dish, UserProfile } from '../../shared/types'

export interface FavoriteDish extends Dish {
  favoritedAt: string
}

export interface HistoryEntry {
  id: string
  createdAt: string

  source: 'photo' | 'city'
  title: string
  dishes: Dish[]
  summary: { total: number; safe: number; caution: number; forbidden: number } | null
}

interface UserRecord {
  favorites: FavoriteDish[]
  history: HistoryEntry[]

  profile?: UserProfile
  profileUpdatedAt?: string
}

interface StoreShape {
  version: 1
  users: Record<string, UserRecord>
}

const DATA_DIR = process.env.USER_DATA_DIR || join(process.cwd(), 'data')
const DATA_FILE = join(DATA_DIR, 'user-data.json')
const MAX_FAVORITES = 200
const MAX_HISTORY = 50

let cache: StoreShape | null = null

function emptyStore(): StoreShape {
  return { version: 1, users: {} }
}

async function load(): Promise<StoreShape> {
  if (cache) return cache
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as StoreShape
    cache = parsed?.users ? parsed : emptyStore()
  } catch {
    cache = emptyStore()
  }
  return cache
}

async function persist(store: StoreShape): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const tmp = `${DATA_FILE}.tmp`
  await writeFile(tmp, JSON.stringify(store, null, 2), 'utf8')
  await rename(tmp, DATA_FILE)
}

function getUser(store: StoreShape, deviceId: string): UserRecord {
  if (!store.users[deviceId]) {
    store.users[deviceId] = { favorites: [], history: [] }
  }
  return store.users[deviceId]
}

export async function getFavorites(deviceId: string): Promise<FavoriteDish[]> {
  const store = await load()
  return getUser(store, deviceId).favorites
}

export async function addFavorite(deviceId: string, dish: Dish): Promise<FavoriteDish[]> {
  const store = await load()
  const user = getUser(store, deviceId)
  if (!user.favorites.some((f) => f.id === dish.id)) {
    user.favorites.unshift({ ...dish, favoritedAt: new Date().toISOString() })
    user.favorites = user.favorites.slice(0, MAX_FAVORITES)
    await persist(store)
  }
  return user.favorites
}

export async function removeFavorite(deviceId: string, dishId: string): Promise<FavoriteDish[]> {
  const store = await load()
  const user = getUser(store, deviceId)
  user.favorites = user.favorites.filter((f) => f.id !== dishId)
  await persist(store)
  return user.favorites
}

export async function getHistory(deviceId: string): Promise<HistoryEntry[]> {
  const store = await load()
  return getUser(store, deviceId).history
}

export async function addHistory(
  deviceId: string,
  entry: Omit<HistoryEntry, 'id' | 'createdAt'>
): Promise<HistoryEntry> {
  const store = await load()
  const user = getUser(store, deviceId)

  const record: HistoryEntry = {
    ...entry,
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString()
  }

  user.history.unshift(record)
  user.history = user.history.slice(0, MAX_HISTORY)
  await persist(store)
  return record
}

export async function getProfile(deviceId: string): Promise<UserProfile | null> {
  const store = await load()
  const user = store.users[deviceId]
  return user?.profile ?? null
}

export async function saveProfile(
  deviceId: string,
  profile: UserProfile
): Promise<{ profile: UserProfile; updatedAt: string }> {
  const store = await load()
  const user = getUser(store, deviceId)
  user.profile = profile
  user.profileUpdatedAt = new Date().toISOString()
  await persist(store)
  return { profile, updatedAt: user.profileUpdatedAt }
}


/**
 * 用户数据（收藏 / 历史）持久化。
 *
 * 取舍：用 JSON 文件而不是 SQLite。
 *   - 不引入原生模块（better-sqlite3 在没装 VS Build Tools 的机器上编译会炸）
 *   - 单实例演示场景，写入频率很低，文件锁风险可忽略
 *   - 数据可以直接打开看，答辩时能当场展示
 * 后续要上多用户/并发，把这一层换成 SQLite 即可，接口不变。
 */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { Dish } from '../../shared/types'

export interface FavoriteDish extends Dish {
  favoritedAt: string
}

export interface HistoryEntry {
  id: string
  createdAt: string
  /** photo = 拍菜单识别，city = 地域推荐 */
  source: 'photo' | 'city'
  title: string
  dishes: Dish[]
  summary: { total: number; safe: number; caution: number; forbidden: number } | null
}

interface UserRecord {
  favorites: FavoriteDish[]
  history: HistoryEntry[]
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

/** 原子写：先写临时文件再 rename，避免写一半断电把文件写坏 */
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

export async function clearHistory(deviceId: string): Promise<void> {
  const store = await load()
  const user = getUser(store, deviceId)
  user.history = []
  await persist(store)
}

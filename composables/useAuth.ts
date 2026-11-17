

const USERS_KEY = 'shijian_users'
const CURRENT_KEY = 'shijian_user'
const GUEST_KEY = 'shijian_guest_id'
const DEVICE_KEY = 'shijian_device_id'
const PROFILE_OK_KEY = 'shijian_profile_ok'

export interface StoredUser {
  name: string

  key: string
  at: number
}

function digest(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function accountDeviceId(name: string): string {
  return 'acc_' + digest(name.trim().toLowerCase())
}

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeUsers(list: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list))
}

function invalidateProfileFlag() {

  localStorage.removeItem(PROFILE_OK_KEY)
}

function enter(name: string) {
  localStorage.setItem(CURRENT_KEY, name)


  const now = localStorage.getItem(DEVICE_KEY) ?? ''
  if (now && !now.startsWith('acc_')) localStorage.setItem(GUEST_KEY, now)

  localStorage.setItem(DEVICE_KEY, accountDeviceId(name))
  invalidateProfileFlag()
}

export function useAuth() {
  const user = useState<string>('authUser', () => '')


  function sync() {
    if (!import.meta.client) return
    const name = localStorage.getItem(CURRENT_KEY) ?? ''
    if (!name) {
      user.value = ''
      return
    }

    const exists = readUsers().some((u) => u.name === name)
    user.value = exists ? name : ''
  }

  function register(name: string, pass: string): { ok: boolean; message: string } {
    const n = name.trim()
    if (n.length < 2) return { ok: false, message: '名字至少两个字' }
    if (n.length > 16) return { ok: false, message: '名字最多十六个字' }
    if (pass.length < 6) return { ok: false, message: '密码至少六位' }

    const list = readUsers()
    if (list.some((u) => u.name.toLowerCase() === n.toLowerCase())) {
      return { ok: false, message: '这个名字已经有人用了，换一个' }
    }

    list.push({ name: n, key: digest(n.toLowerCase() + ':' + pass), at: Date.now() })
    writeUsers(list)
    enter(n)
    user.value = n
    return { ok: true, message: '' }
  }

  function login(name: string, pass: string): { ok: boolean; message: string } {
    const n = name.trim()
    if (!n || !pass) return { ok: false, message: '名字和密码都得填' }

    const found = readUsers().find((u) => u.name.toLowerCase() === n.toLowerCase())
    if (!found) return { ok: false, message: '这台设备上没有这个账号，先注册' }
    if (found.key !== digest(n.toLowerCase() + ':' + pass)) {
      return { ok: false, message: '密码不对' }
    }

    enter(found.name)
    user.value = found.name
    return { ok: true, message: '' }
  }

  function logout() {
    localStorage.removeItem(CURRENT_KEY)

    const guest = localStorage.getItem(GUEST_KEY)
    if (guest) localStorage.setItem(DEVICE_KEY, guest)
    else localStorage.removeItem(DEVICE_KEY)

    invalidateProfileFlag()
    user.value = ''
  }

  return { user, sync, register, login, logout }
}


const OPEN = ['/', '/profile', '/cities', '/login']

export default defineNuxtRouteMiddleware(async (to) => {

  if (import.meta.server) return
  if (OPEN.includes(to.path)) return


  if (localStorage.getItem('shijian_profile_ok') === '1') return

  const deviceId = localStorage.getItem('shijian_device_id')

  const toFill = (fullPath: string) => ({ path: '/profile', query: { next: fullPath } })
  if (!deviceId) return navigateTo(toFill(to.fullPath))

  try {
    const data = await $fetch<{ profile: unknown | null }>('/api/user/data', {
      query: { deviceId }
    })
    if (!data.profile) return navigateTo(toFill(to.fullPath))
    localStorage.setItem('shijian_profile_ok', '1')
  } catch {

  }
})

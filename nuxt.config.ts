export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  typescript: { strict: true, typeCheck: false },
  app: {
    head: {
      title: '食鉴 AI',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '看得懂菜单，也看得懂你的 AI 美食助手' }
      ]
    }
  }
})

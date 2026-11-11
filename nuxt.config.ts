export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  typescript: { strict: true, typeCheck: false },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: '食鉴 · 看得懂菜单的 AI 美食助手',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '拍菜单，看懂食材与风险；选城市，知道哪道本地菜你能吃' }
      ]
    }
  }
})

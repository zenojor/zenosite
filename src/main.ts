import './assets/main.css'

import { createApp } from 'vue'
import App from '@/App.vue'
import { router } from '@/router'
import { initThemeMode } from '@/state/themeState'

const app = createApp(App)

initThemeMode()

app.use(router)

router.isReady().then(() => {
  app.mount('#app')
})

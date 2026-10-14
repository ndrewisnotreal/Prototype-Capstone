import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { installPrimeVue } from './app/primevue'
import './assets/styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
installPrimeVue(app)
app.mount('#app')

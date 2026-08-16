import { createApp } from 'vue'
import './main.css'
import App from './App.vue'
import {
  installColumnResizers,
} from './services/columnResizer.js'

const el = document.querySelector('#nc-bitwarden-app')
if (!el) {
  console.error('[nc_bitwarden] #nc-bitwarden-app nicht gefunden!')
} else {
  const app = createApp(App)
  app.config.errorHandler = (err, _vm, info) => {
    console.error('[nc_bitwarden] Vue-Fehler:', info, err)
  }
  app.mount(el)

  const removeColumnResizers =
    installColumnResizers(el)

  window.addEventListener(
    'pagehide',
    removeColumnResizers,
    { once: true },
  )
}

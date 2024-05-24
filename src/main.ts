import './assets/main.css'

import { createApp, markRaw } from 'vue'
import { createPinia } from 'pinia'
import type { Router } from 'vue-router';
import App from './App.vue'
import router from './router'

declare module 'pinia' {
    export interface PiniaCustomProperties {
      router: Router;
    }
}

const app = createApp(App)
const pinia = createPinia()

pinia.use(({ store }) => {
    store.router = markRaw(router);
});

app
    .use(pinia)
    .use(router)
    .mount('#app')

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';

import '~/styles/tokens.css';
import '~/styles/base.css';
import './str.polyfill.ts';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');

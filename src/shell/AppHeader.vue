<script setup lang="ts">
import { config } from '~/config';
import { useTheme } from '~/theme/useTheme';

const theme = useTheme();
</script>

<template>
  <header class="lc-header">
    <div class="lc-header__inner">
      <a class="lc-brand" href="./">
        <img class="lc-brand__logo" :src="theme.logo.value" alt="" />
        <span class="lc-brand__name">{{ theme.t('brand.name') }}</span>
        <span class="lc-brand__version">v{{ config.version }}</span>
      </a>

      <nav class="lc-header__actions">
        <a v-for="link in theme.links.value" :key="link.url" class="lc-header__link" :href="link.url"
          target="_blank" rel="noopener noreferrer">{{ link.label }}</a>

        <a v-if="config.sourceUrl" class="lc-icon-btn lc-source" :href="config.sourceUrl" target="_blank"
          rel="noopener noreferrer" :title="theme.t('nav.source')" :aria-label="theme.t('nav.source')">
          <!-- GitHub 的标志（Octocat）。 -->
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>

        <button v-if="theme.canToggleMode.value" class="lc-icon-btn" type="button"
          :title="theme.isDark.value ? theme.t('mode.light') : theme.t('mode.dark')"
          :aria-label="theme.isDark.value ? theme.t('mode.light') : theme.t('mode.dark')"
          @click="theme.toggleMode()">
          <svg v-if="theme.isDark.value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        </button>
      </nav>
    </div>
  </header>
</template>

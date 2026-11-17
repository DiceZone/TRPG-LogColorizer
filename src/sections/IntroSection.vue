<script setup lang="ts">
import { useTheme } from '~/theme/useTheme';
import { useWorkspace } from '~/workspace/useWorkspace';

const theme = useTheme();
const workspace = useWorkspace();
</script>

<template>
  <section class="lc-intro" data-section="intro">
    <h1 class="lc-intro__title">{{ workspace.logName.value || theme.t('intro.title') }}</h1>
    <p class="lc-intro__desc">{{ theme.t('intro.desc') }}</p>
    <p v-if="theme.t('intro.notice')" class="lc-intro__notice">{{ theme.t('intro.notice') }}</p>
  </section>
</template>

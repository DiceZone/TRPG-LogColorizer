<script setup lang="ts">
import { useTheme } from '~/theme/useTheme';
import { useWorkspace } from '~/workspace/useWorkspace';
import LiveBadge from '~/shell/LiveBadge.vue';

const theme = useTheme();
const workspace = useWorkspace();
</script>

<template>
  <section class="lc-intro" data-section="intro">
    <!-- 实时日志的状态放在标题同一行最右边，与下面日志区的右缘对齐。 -->
    <div class="lc-intro__head">
      <h1 class="lc-intro__title">{{ workspace.logName.value || theme.t('intro.title') }}</h1>
      <LiveBadge v-if="workspace.live.active" />
    </div>
    <p class="lc-intro__desc">{{ theme.t('intro.desc') }}</p>
    <p v-if="theme.t('intro.notice')" class="lc-intro__notice">{{ theme.t('intro.notice') }}</p>
  </section>
</template>

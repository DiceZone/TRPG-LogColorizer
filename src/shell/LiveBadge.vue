<!-- 实时日志的状态：连接中 / 直播中 / 重试中 / 已完结，以及「跟随最新」开关。 -->
<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from '~/theme/useTheme';
import { useWorkspace } from '~/workspace/useWorkspace';
import ToggleButton from './ToggleButton.vue';

const theme = useTheme();
const { live, previewItems } = useWorkspace();

const label = computed(() => {
  switch (live.status) {
    case 'live': return theme.t('live.on');
    case 'retrying': return theme.t('live.retrying');
    case 'ended': return theme.t('live.ended');
    default: return theme.t('live.connecting');
  }
});
</script>

<template>
  <div class="lc-live" :data-status="live.status" role="status">
    <span class="lc-live__dot" aria-hidden="true"></span>
    <span class="lc-live__label">{{ label }}</span>
    <span v-if="previewItems.length" class="lc-live__count">{{ theme.t('live.count', { count: previewItems.length }) }}</span>
    <ToggleButton v-if="live.status !== 'ended'" v-model="live.follow" class="lc-live__follow lc-toggle--bare"
      :label="theme.t('live.follow')" />
  </div>
</template>

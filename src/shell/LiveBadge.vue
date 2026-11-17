<!-- 实时日志的状态：连接中 / 直播中 / 重试中 / 已暂停 / 已完结，以及暂停与恢复直播。 -->
<script setup lang="ts">
import { computed } from 'vue';
import { PauseFilled, PlayFilledAlt } from '@vicons/carbon';
import { useTheme } from '~/theme/useTheme';
import { useWorkspace } from '~/workspace/useWorkspace';

const theme = useTheme();
const { live, previewItems, pauseLive, resumeLive } = useWorkspace();

const label = computed(() => {
  switch (live.status) {
    case 'live': return theme.t('live.on');
    case 'retrying': return theme.t('live.retrying');
    case 'paused': return theme.t('live.paused');
    case 'ended': return theme.t('live.ended');
    default: return theme.t('live.connecting');
  }
});

const paused = computed(() => live.status === 'paused');
const toggle = () => (paused.value ? resumeLive() : pauseLive());
</script>

<template>
  <div class="lc-live" :data-status="live.status" role="status">
    <span class="lc-live__dot" aria-hidden="true"></span>
    <span class="lc-live__label">{{ label }}</span>
    <span v-if="previewItems.length" class="lc-live__count">{{ theme.t('live.count', { count: previewItems.length }) }}</span>
    <button v-if="live.status !== 'ended'" class="lc-live__control" type="button" :aria-pressed="paused"
      @click="toggle">
      <component :is="paused ? PlayFilledAlt : PauseFilled" aria-hidden="true" />
      <span>{{ paused ? theme.t('live.resume') : theme.t('live.pause') }}</span>
    </button>
  </div>
</template>

<!-- 聊天视图：像群聊一样逐条显示，适合看实时日志。长日志用虚拟列表，只渲染看得到的部分。 -->
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
// @ts-ignore
import VirtualList from 'vue3-virtual-scroll-list';
import { LogItem } from '~/logManager/types';
import ChatItem from './ChatItem.vue';

const props = defineProps<{
  isShow: boolean;
  previewItems: LogItem[];
}>();

const extra = computed(() => ({ items: props.previewItems }));

const list = ref<any>(null);
const scrollToBottom = () => {
  nextTick(() => list.value?.scrollToBottom?.());
};
defineExpose({ scrollToBottom });
</script>

<template>
  <div v-show="isShow" class="lc-chat">
    <p v-if="previewItems.length === 0" class="lc-empty">染色失败，内容为空或无法识别此格式。</p>
    <VirtualList ref="list" class="lc-chat__list scroller" :data-key="'index'" :data-sources="previewItems"
      :data-component="ChatItem" :extra-props="extra" :estimate-size="64" />
  </div>
</template>

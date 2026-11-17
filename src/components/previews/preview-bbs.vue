<template>
  <!-- 一键复制与两个选项放在日志区上方的工具栏里（EditorSection），这里只管显示。 -->
  <div class="preview" ref="preview" id="preview" v-show="isShow">
    <div v-if="previewItems.length === 0">
      <div>染色失败，内容为空或无法识别此格式。</div>
      <div>已知支持的格式有: 海豹Log(json)、赵/Dice!原始文件、塔原始文件</div>
      <div>请先清空编辑框，再行复制</div>
    </div>

    <VirtualList ref="list" class="list-dynamic scroll-touch scroller" :data-key="'index'" :data-sources="previewItems"
      :data-component="Item" :estimate-size="20" :item-class="''" />
  </div>
</template>

<script setup lang="ts">
import { h, nextTick, ref, render, watch } from 'vue';
import { useStore } from '~/store';
import { LogItem } from '~/logManager/types';
// @ts-ignore
import VirtualList from 'vue3-virtual-scroll-list';
import Item from './preview-bbs-item.vue'

const props = defineProps<{
  isShow: boolean,
  previewItems: LogItem[],
}>();

const store = useStore();

watch(() => props.isShow, (val: any) => {
  if (val) store.exportOptions.imageHide = true
})

/** 要复制的论坛代码。逐条渲染再取文本，长日志会慢一些。 */
const copyText = () => {
  const el = document.createElement('span');
  const items = [];
  for (let i of props.previewItems) {
    render(h(Item, { source: i }), el);
    items.push(el.textContent);
  }
  render(null, el);
  return items.join('\n');
}

const list = ref<any>(null)
const scrollToBottom = () => {
  nextTick(() => list.value?.scrollToBottom?.())
}
defineExpose({ copyText, scrollToBottom })
</script>

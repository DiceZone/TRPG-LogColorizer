<!--
  远程日志载入中：日志区上盖一层骨架，像聊天记录正一条条冒出来；
  顶端一条细进度条，底部一枚小标签说明在做什么。减少动态效果时只留静态骨架。
-->
<script setup lang="ts">
import { useTheme } from '~/theme/useTheme';

const theme = useTheme();

/** 骨架行：左右交替、长短不一，看起来像真的聊天记录。 */
const rows = [
  { right: false, a: '42%', b: '68%' },
  { right: false, a: '30%', b: '' },
  { right: true, a: '55%', b: '36%' },
  { right: false, a: '62%', b: '48%' },
  { right: true, a: '28%', b: '' },
  { right: false, a: '46%', b: '72%' },
  { right: false, a: '34%', b: '' },
  { right: true, a: '58%', b: '40%' },
].map((row, index) => ({ ...row, id: index, delay: `${index * 70}ms` }));
</script>

<template>
  <div class="lc-loading" role="status" aria-live="polite">
    <span class="lc-loading__bar" aria-hidden="true"></span>
    <div class="lc-loading__rows" aria-hidden="true">
      <div v-for="row in rows" :key="row.id" class="lc-loading__row" :class="{ 'is-right': row.right }"
        :style="{ '--lc-loading-delay': row.delay }">
        <span class="lc-loading__avatar"></span>
        <span class="lc-loading__lines">
          <span :style="{ width: row.a }"></span>
          <span v-if="row.b" :style="{ width: row.b }"></span>
        </span>
      </div>
    </div>
    <p class="lc-loading__label">
      <span class="lc-loading__dot" aria-hidden="true"></span>
      {{ theme.t('editor.loading') }}
    </p>
  </div>
</template>

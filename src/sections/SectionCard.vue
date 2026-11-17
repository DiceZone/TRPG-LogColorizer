<!-- 区块的统一外框：标题、说明、右上角的操作，以及可选的折叠。 -->
<script setup lang="ts">
import { inject, ref, watch, type Ref } from 'vue';

const props = defineProps<{
  /** 写到 data-section 上，主题按它定位到具体区块。 */
  id: string;
  title: string;
  desc?: string;
  collapsible?: boolean;
  /** 可折叠时初始是否展开。 */
  open?: boolean;
}>();

const expanded = ref(props.collapsible ? Boolean(props.open) : true);

// 窄屏时从左缘页签打开抽屉里的这个区块，直接展开给人看。
const drawer = inject<Ref<string | null> | null>('lc-drawer', null);
if (drawer) {
  watch(drawer, (id) => {
    if (id === props.id) expanded.value = true;
  });
}
</script>

<template>
  <section class="lc-card" :data-section="id" :data-expanded="expanded">
    <header class="lc-card__head">
      <div class="lc-card__heading">
        <h2 class="lc-card__title">
          {{ title }}
          <slot name="badge" />
        </h2>
        <p v-if="desc" class="lc-card__desc">{{ desc }}</p>
      </div>
      <div v-if="$slots.actions || collapsible" class="lc-card__actions">
        <slot name="actions" />
        <button v-if="collapsible" class="lc-icon-btn" type="button" :aria-expanded="expanded"
          :aria-label="expanded ? '收起' : '展开'" @click="expanded = !expanded">
          <svg class="lc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    </header>
    <n-collapse-transition :show="expanded">
      <div class="lc-card__body">
        <slot />
      </div>
    </n-collapse-transition>
  </section>
</template>

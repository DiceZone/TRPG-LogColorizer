<!--
  页面骨架：页眉 + 按主题安排的区块 + 页脚。
  区块的顺序、放在侧栏还是主区，都由主题清单决定；这里不写死。
  workspace 版面：标题区块占满一行，下面左侧栏、右主区，两边顶端对齐。
  窄屏时侧栏收进左侧的抽屉，屏幕左缘留几个半透明的页签，点哪个就打开哪个区块。
  lc-deco 开头的空元素是留给主题做装饰用的（背景纹理、边角、扫描线……），默认不显示。
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, type Component } from 'vue';
import AppHeader from './AppHeader.vue';
import IntroSection from '~/sections/IntroSection.vue';
import OptionsSection from '~/sections/OptionsSection.vue';
import CharactersSection from '~/sections/CharactersSection.vue';
import EditorSection from '~/sections/EditorSection.vue';
import ExportSection from '~/sections/ExportSection.vue';
import { provideWorkspace } from '~/workspace/useWorkspace';
import { useTheme } from '~/theme/useTheme';
import type { SectionId } from '~/theme/types';
import type { StringKey } from '~/theme/strings';

provideWorkspace();
const theme = useTheme();

const components: Record<SectionId, Component> = {
  intro: IntroSection,
  options: OptionsSection,
  characters: CharactersSection,
  editor: EditorSection,
  export: ExportSection,
};

const isWorkspace = computed(() => theme.layout.value === 'workspace');
// 标题区块在 workspace 版面下单独占一行，不进左右两栏。
const topSections = computed(() =>
  isWorkspace.value ? theme.sections.value.filter((id) => id === 'intro' && !theme.aside.value.includes(id)) : []);
const asideSections = computed(() =>
  isWorkspace.value ? theme.sections.value.filter((id) => theme.aside.value.includes(id)) : []);
const mainSections = computed(() =>
  theme.sections.value.filter((id) => !asideSections.value.includes(id) && !topSections.value.includes(id)));

// ─── 可折叠区块 ─────────────────────────────────────────────

/** 当前展开的可折叠区块（角色、渲染选项、导出）：同一时间只展开一个。 */
provide('lc-accordion', ref<string | null>(null));

// ─── 窄屏抽屉 ───────────────────────────────────────────────

/** 抽屉里正在看的区块；为空时抽屉收起。 */
const drawer = ref<SectionId | null>(null);
// 区块据此在抽屉里被点开时自动展开。
provide('lc-drawer', drawer);
const toggleDrawer = (id: SectionId) => {
  drawer.value = drawer.value === id ? null : id;
};
const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') drawer.value = null;
};
// 拉宽到双栏时抽屉自动收起，免得再变窄时它还开着。
const wide = window.matchMedia('(min-width: 1081px)');
const onWide = () => {
  if (wide.matches) drawer.value = null;
};
onMounted(() => {
  window.addEventListener('keydown', onKey);
  wide.addEventListener('change', onWide);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  wide.removeEventListener('change', onWide);
});

const tabLabel = (id: SectionId) => theme.t(`nav.${id}` as StringKey);
</script>

<template>
  <!-- 主题载入前先不显示，免得先闪一下默认样式。 -->
  <div class="lc-app" :class="{ 'is-pending': !theme.state.ready, 'has-drawer': drawer }">
    <div class="lc-deco lc-deco--backdrop" aria-hidden="true"></div>
    <div class="lc-deco lc-deco--top" aria-hidden="true"></div>

    <AppHeader />

    <main class="lc-page" :class="{ 'lc-page--workspace': isWorkspace && asideSections.length }">
      <div v-if="topSections.length" class="lc-top">
        <component :is="components[id]" v-for="id in topSections" :key="id" />
      </div>

      <div v-if="asideSections.length" class="lc-drawer" :class="{ 'is-open': drawer }">
        <aside class="lc-aside" :data-active="drawer || undefined">
          <component :is="components[id]" v-for="id in asideSections" :key="id" />
        </aside>
        <nav class="lc-drawer__tabs" :aria-label="theme.t('nav.menu')">
          <button v-for="id in asideSections" :key="id" class="lc-drawer__tab" type="button"
            :class="{ 'is-active': drawer === id }" :aria-expanded="drawer === id" @click="toggleDrawer(id)">
            {{ tabLabel(id) }}
          </button>
        </nav>
      </div>
      <div v-if="asideSections.length" class="lc-drawer__scrim" aria-hidden="true" @click="drawer = null"></div>

      <div class="lc-main">
        <component :is="components[id]" v-for="id in mainSections" :key="id" />
      </div>
    </main>

    <footer v-if="theme.t('brand.footer')" class="lc-footer">{{ theme.t('brand.footer') }}</footer>
    <div class="lc-deco lc-deco--bottom" aria-hidden="true"></div>
  </div>
</template>

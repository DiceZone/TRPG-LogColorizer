<!-- 日志区：编辑器、预览、聊天与三种论坛/工坊格式，用上方的页签切换。 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { ChevronDown, DownToBottom } from '@vicons/carbon';
import SectionCard from './SectionCard.vue';
import CodeMirror from '~/components/CodeMirror.vue';
import PreviewMain from '~/components/previews/preview-main.vue';
import PreviewBbs from '~/components/previews/preview-bbs.vue';
import PreviewBbsPineapple from '~/components/previews/preview-bbs-pineapple.vue';
import PreviewTrg from '~/components/previews/preview-trg.vue';
import ChatView from '~/chat/ChatView.vue';
import LogLoading from '~/shell/LogLoading.vue';
import ToggleButton from '~/shell/ToggleButton.vue';
import { EditorView } from '@codemirror/view';
import { useTheme } from '~/theme/useTheme';
import { useWorkspace, type ViewMode } from '~/workspace/useWorkspace';
import type { StringKey } from '~/theme/strings';

const theme = useTheme();
const ws = useWorkspace();
const store = ws.store;
const message = useMessage();

const views: { id: ViewMode; label: StringKey }[] = [
  { id: 'edit', label: 'editor.view.edit' },
  { id: 'preview', label: 'editor.view.preview' },
  { id: 'chat', label: 'editor.view.chat' },
];
/** 收在「更多」里的视图。 */
const moreViews: { id: ViewMode; label: StringKey }[] = [
  { id: 'bbs', label: 'editor.view.bbs' },
  { id: 'bbspineapple', label: 'editor.view.bbspineapple' },
  { id: 'trg', label: 'editor.view.trg' },
];
const moreActive = computed(() => moreViews.find((item) => item.id === ws.view.value) ?? null);
const moreOptions = computed(() => moreViews.map((item) => ({ key: item.id, label: theme.t(item.label) })));

// ─── 日志区高度：默认不超过一屏，访客可以拖动底边拉长，记在本地 ───────
const HEIGHT_KEY = 'lc-log-height';
const MIN_HEIGHT = 240;
const readHeight = () => {
  try {
    const value = Number(localStorage.getItem(HEIGHT_KEY));
    return value >= MIN_HEIGHT ? value : null;
  } catch {
    return null;
  }
};
const logHeight = ref<number | null>(readHeight());
const logArea = ref<HTMLElement | null>(null);
const logStyle = computed(() => (logHeight.value ? { '--lc-editor-height': `${logHeight.value}px` } : undefined));

/** 现在的高度：没拖过时量正在显示的那个视图（其他视图是隐藏的，量出来是 0）。 */
const currentHeight = () => {
  if (logHeight.value) return logHeight.value;
  const views = logArea.value?.querySelectorAll<HTMLElement>('.codemirror, .scroller');
  const shown = views ? Array.from(views).find((el) => el.offsetParent !== null) : undefined;
  return shown?.getBoundingClientRect().height || 480;
};

let dragFrom: { y: number; height: number } | null = null;
const onResizeDown = (event: PointerEvent) => {
  dragFrom = { y: event.clientY, height: currentHeight() };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  event.preventDefault();
};
const onResizeMove = (event: PointerEvent) => {
  if (!dragFrom) return;
  logHeight.value = Math.round(Math.max(MIN_HEIGHT, dragFrom.height + event.clientY - dragFrom.y));
};
const onResizeUp = () => {
  if (!dragFrom) return;
  dragFrom = null;
  try {
    if (logHeight.value) localStorage.setItem(HEIGHT_KEY, String(logHeight.value));
  } catch { /* 不能存就算了，这次仍然有效 */ }
};
const onResizeKey = (event: KeyboardEvent) => {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  logHeight.value = Math.max(MIN_HEIGHT, Math.round(currentHeight() + (event.key === 'ArrowDown' ? 40 : -40)));
  onResizeUp();
};
const resetHeight = () => {
  logHeight.value = null;
  try {
    localStorage.removeItem(HEIGHT_KEY);
  } catch { /* 同上 */ }
};
onBeforeUnmount(() => { dragFrom = null; });

const fileInput = ref<HTMLInputElement | null>(null);
const onFile = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) ws.importFile(file);
};

const previewMain = ref<InstanceType<typeof PreviewMain> | null>(null);
const chatView = ref<InstanceType<typeof ChatView> | null>(null);
const previewBbs = ref<InstanceType<typeof PreviewBbs> | null>(null);
const previewPineapple = ref<InstanceType<typeof PreviewBbsPineapple> | null>(null);
const previewTrg = ref<InstanceType<typeof PreviewTrg> | null>(null);

/** 把当前看的视图滚到最新一条。 */
const jumpToLatest = () => {
  switch (ws.view.value) {
    case 'edit':
      if (store.editor) {
        store.editor.dispatch({ effects: EditorView.scrollIntoView(store.editor.state.doc.length, { y: 'end' }) });
      }
      break;
    case 'preview': previewMain.value?.scrollToBottom(); break;
    case 'chat': chatView.value?.scrollToBottom(); break;
    case 'bbs': previewBbs.value?.scrollToBottom(); break;
    case 'bbspineapple': previewPineapple.value?.scrollToBottom(); break;
    case 'trg': previewTrg.value?.scrollToBottom(); break;
  }
};

// 实时日志：有新消息且开着「自动滚动」时，滚到最新一条。
watch(() => ws.live.tick, () => {
  if (ws.live.follow) jumpToLatest();
});

// ─── 一键复制（论坛代码与回声工坊） ─────────────────────────
const copySource = computed(() => ({
  bbs: previewBbs.value,
  bbspineapple: previewPineapple.value,
  trg: previewTrg.value,
} as Record<string, { copyText: () => string } | null>)[ws.view.value] ?? null);

const writeClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // 不是 https 或浏览器不给权限时，退回旧的做法。
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy failed');
};

const copying = ref(false);
const copyAll = async () => {
  if (!copySource.value || copying.value) return;
  copying.value = true;
  try {
    await writeClipboard(copySource.value.copyText());
    message.success(theme.t('editor.copied'));
  } catch {
    message.error(theme.t('editor.copyFailed'));
  } finally {
    copying.value = false;
  }
};
// 切到聊天视图时先停在最新一条。
watch(() => ws.view.value, (view) => {
  if (view === 'chat') chatView.value?.scrollToBottom();
});

// 子组件（编辑器）先挂载，这里才能开始载入日志。
onMounted(() => {
  ws.start();
});
</script>

<template>
  <SectionCard id="editor" :title="theme.t('editor.title')" :desc="theme.t('editor.desc')">
    <template #actions>
      <div class="lc-tabs" role="tablist">
        <button v-for="item in views" :key="item.id" class="lc-tab" type="button" role="tab"
          :aria-selected="ws.view.value === item.id" :class="{ 'is-active': ws.view.value === item.id }"
          @click="ws.setView(item.id)">{{ theme.t(item.label) }}</button>
        <n-dropdown trigger="click" placement="bottom-end" :options="moreOptions" :value="moreActive?.id"
          @select="(key: ViewMode) => ws.setView(key)">
          <button class="lc-tab lc-tab--more" type="button" role="tab" aria-haspopup="menu"
            :aria-selected="Boolean(moreActive)" :class="{ 'is-active': moreActive }">
            {{ moreActive ? theme.t(moreActive.label) : theme.t('editor.view.more') }}
            <ChevronDown aria-hidden="true" />
          </button>
        </n-dropdown>
      </div>
    </template>

    <!-- 工具栏：左边是这个视图的操作，右边是开关。 -->
    <div class="lc-editor-toolbar">
      <template v-if="ws.view.value === 'edit'">
        <button class="lc-btn lc-btn--small" type="button" @click="fileInput?.click()">{{ theme.t('editor.importFile') }}</button>
        <button class="lc-btn lc-btn--small" type="button" @click="ws.clearText()">{{ theme.t('editor.clear') }}</button>
        <button class="lc-btn lc-btn--small" type="button" @click="ws.doFlush()">{{ theme.t('editor.flush') }}</button>
      </template>
      <button v-if="copySource" class="lc-btn lc-btn--small lc-btn--primary" type="button" :disabled="copying"
        :title="theme.t('editor.copyHint')" @click="copyAll">{{ theme.t('editor.copy') }}</button>

      <div class="lc-editor-toolbar__toggles">
        <ToggleButton v-if="ws.view.value === 'edit'" :model-value="store.doEditorHighlight"
          :label="theme.t('editor.highlight')" @update:model-value="ws.setHighlight" />
        <template v-if="ws.view.value === 'bbs'">
          <ToggleButton v-model="store.bbsUseSpaceWithMultiLine" :label="theme.t('editor.bbs.indent')"
            :title="theme.t('editor.bbs.indentHint')" />
          <ToggleButton v-model="store.bbsUseColorName" :label="theme.t('editor.bbs.colorName')"
            :title="theme.t('editor.bbs.colorNameHint')" />
        </template>
        <ToggleButton v-if="ws.view.value === 'trg'" v-model="store.trgIsAddVoiceMark" :label="theme.t('editor.trg.voice')" />
        <ToggleButton v-model="ws.live.follow" :label="theme.t('editor.autoScroll')" :title="theme.t('editor.autoScrollHint')" />
      </div>
      <input ref="fileInput" type="file" accept=".txt,.log,.json,text/plain,application/json" hidden @change="onFile" />
    </div>

    <div ref="logArea" class="lc-log-area" :style="logStyle" :aria-busy="ws.loading.value">
      <div v-show="ws.view.value === 'edit'" class="lc-editor-wrap">
        <CodeMirror @change="ws.onChange" />
      </div>

      <div v-show="ws.view.value !== 'edit'" class="lc-preview-wrap">
        <PreviewMain ref="previewMain" :is-show="ws.view.value === 'preview'" :preview-items="ws.previewItems.value" />
        <ChatView ref="chatView" :is-show="ws.view.value === 'chat'" :preview-items="ws.previewItems.value" />
        <PreviewBbs ref="previewBbs" :is-show="ws.view.value === 'bbs'" :preview-items="ws.previewItems.value" />
        <PreviewBbsPineapple ref="previewPineapple" :is-show="ws.view.value === 'bbspineapple'" :preview-items="ws.previewItems.value" />
        <PreviewTrg ref="previewTrg" :is-show="ws.view.value === 'trg'" :preview-items="ws.previewItems.value" />
      </div>

      <button class="lc-jump" type="button" :title="theme.t('editor.jumpLatest')" :aria-label="theme.t('editor.jumpLatest')"
        @click="jumpToLatest">
        <DownToBottom aria-hidden="true" />
      </button>

      <Transition name="lc-loading">
        <LogLoading v-if="ws.loading.value" />
      </Transition>
    </div>
    <div class="lc-resize" role="separator" aria-orientation="horizontal" tabindex="0"
      :title="theme.t('editor.resize')" :aria-label="theme.t('editor.resize')"
      @pointerdown="onResizeDown" @pointermove="onResizeMove" @pointerup="onResizeUp" @pointercancel="onResizeUp"
      @dblclick="resetHeight" @keydown="onResizeKey">
      <span aria-hidden="true"></span>
    </div>
  </SectionCard>
</template>

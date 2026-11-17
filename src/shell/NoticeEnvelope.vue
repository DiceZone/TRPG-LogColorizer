<!--
  站点公告：后台发布后，标题行右侧（直播状态的左边）露出一个斜放的米色信封，
  上半截压在顶栏下面，隐约发光。点开时，信纸从信封的位置飞出、展开，显示公告内容（Markdown）。
  后端没有公告接口或没有公告时什么都不显示。
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { config } from '~/config';
import { useTheme } from '~/theme/useTheme';
import { useRichText } from '~/chat/useRichText';
import { escapeHTML } from '~/utils';

interface Notice {
  id: string;
  title: string;
  content: string;
}

const READ_KEY = 'lc-notice-read';

const theme = useTheme();
const notice = ref<Notice | null>(null);
const unread = ref(false);
const open = ref(false);
const envelope = ref<HTMLButtonElement | null>(null);
const sheet = ref<HTMLElement | null>(null);
const backdrop = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const html = computed(() => {
  if (!notice.value) return '';
  const content = notice.value.content;
  // 有公告时才去载入 Markdown 渲染；载入完成前先按普通文字显示。
  const render = useRichText().value;
  if (render) return render(content, escapeHTML);
  return escapeHTML(content).replaceAll('\n', '<br />');
});
const title = computed(() => notice.value?.title || theme.t('notice.defaultTitle'));

const readStored = () => {
  try {
    return localStorage.getItem(READ_KEY);
  } catch {
    return null;
  }
};
const markRead = () => {
  if (!notice.value) return;
  unread.value = false;
  try {
    localStorage.setItem(READ_KEY, notice.value.id);
  } catch { /* 记不住就算了，下次再提示一次 */ }
};

onMounted(async () => {
  try {
    const response = await fetch(`${config.liveApiBase}/notice`);
    if (!response.ok) return;
    const data = await response.json();
    if (!data?.enabled || typeof data.content !== 'string' || !data.content) return;
    notice.value = { id: String(data.id ?? ''), title: String(data.title ?? ''), content: data.content };
    unread.value = readStored() !== notice.value.id;
  } catch {
    /* 后端没有这个接口（旧版或第三方后端）：不显示公告 */
  }
});

// ─── 飞出与收回 ─────────────────────────────────────────────
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 从信封飞到屏幕中间：先是一张折起来的窄条，到了再展开成整张信纸。 */
const flight = (): Keyframe[] => {
  const from = envelope.value!.getBoundingClientRect();
  const to = sheet.value!.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const s = Math.max(from.width / to.width, 0.04);
  return [
    { transform: `translate(${dx}px, ${dy}px) rotate(-14deg) scale(${s}, ${s * 0.7})`, opacity: 0.5 },
    { transform: 'translate(0, 0) rotate(0deg) scale(1, 0.06)', opacity: 1, offset: 0.55 },
    { transform: 'translate(0, 0) rotate(0deg) scale(1, 1)', opacity: 1 },
  ];
};

let busy = false;

const show = async () => {
  if (!notice.value || busy || open.value) return;
  busy = true;
  open.value = true;
  markRead();
  await nextTick();
  backdrop.value?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced() ? 120 : 360, easing: 'ease-out' });
  const animation = reduced()
    ? sheet.value?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 })
    : sheet.value?.animate(flight(), { duration: 680, easing: 'cubic-bezier(0.22, 0.8, 0.24, 1)' });
  closeButton.value?.focus({ preventScroll: true });
  await animation?.finished.catch(() => undefined);
  busy = false;
};

const hide = async () => {
  if (!open.value || busy) return;
  busy = true;
  backdrop.value?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced() ? 120 : 320, easing: 'ease-in', fill: 'forwards' });
  const animation = reduced()
    ? sheet.value?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' })
    : sheet.value?.animate(flight().reverse().map((frame) => (frame.offset ? { ...frame, offset: 1 - frame.offset } : frame)), { duration: 420, easing: 'cubic-bezier(0.5, 0, 0.75, 0.2)', fill: 'forwards' });
  await animation?.finished.catch(() => undefined);
  open.value = false;
  busy = false;
  envelope.value?.focus({ preventScroll: true });
};

const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) hide();
};
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <button v-if="notice" ref="envelope" class="lc-notice-env" :class="{ 'is-unread': unread, 'is-open': open }"
    type="button" :title="theme.t('notice.open')" :aria-label="`${theme.t('notice.open')}：${title}`" @click="show">
    <svg viewBox="0 0 48 34" aria-hidden="true">
      <rect class="lc-notice-env__paper" x="1" y="1" width="46" height="32" rx="3" />
      <path class="lc-notice-env__fold" d="M2 32 L19 16 M46 32 L29 16" />
      <path class="lc-notice-env__flap" d="M2 3 L24 20 L46 3" />
    </svg>
  </button>

  <Teleport to="body">
    <div v-if="open" class="lc-notice">
      <div ref="backdrop" class="lc-notice__backdrop" @click="hide"></div>
      <article ref="sheet" class="lc-notice__sheet" role="dialog" aria-modal="true" aria-labelledby="lc-notice-title">
        <header class="lc-notice__head">
          <h2 id="lc-notice-title" class="lc-notice__title">{{ title }}</h2>
          <button ref="closeButton" class="lc-icon-btn lc-notice__close" type="button" :aria-label="theme.t('notice.close')"
            :title="theme.t('notice.close')" @click="hide">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
              aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>
        <div class="lc-notice__body lc-rich" v-html="html"></div>
      </article>
    </div>
  </Teleport>
</template>

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
// 信纸是三折的：飞出时只看得到中间那一折，躺在透视空间里，边飞边放大、转正；
// 飞到途中上折先翻开、下折再翻开，折痕最后淡去。收回时整段倒着播。
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 打开的总时长；收回时按 CLOSE_RATE 倍速倒放。 */
const DURATION = 1100;
const CLOSE_RATE = 1.6;
const FOLDED = 'inset(33.34% 0 33.34% 0 round 6px)';
const TOP_OPEN = 'inset(0 0 33.34% 0 round 6px)';
const ALL_OPEN = 'inset(0 0 0 0 round 0px)';

const paper = ref<HTMLElement | null>(null);
const flapTop = ref<HTMLElement | null>(null);
const flapBottom = ref<HTMLElement | null>(null);
const creases = ref<HTMLElement | null>(null);

/** 从信封飞到屏幕前：起点躺平、倾斜、很小，终点正对着人。 */
const flight = (): Keyframe[] => {
  const from = envelope.value!.getBoundingClientRect();
  const to = sheet.value!.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  // 起点时只露出中间一折（高度的三分之一），让它和信封差不多大。
  const s = Math.max(Math.min(from.width / to.width, (from.height * 3) / to.height), 0.04);
  const p = 'perspective(1400px)';
  return [
    { transform: `${p} translate3d(${dx}px, ${dy}px, 0) rotateZ(-14deg) rotateX(62deg) scale(${s})`, opacity: 0.4 },
    { transform: `${p} translate3d(${dx * 0.18}px, ${dy * 0.18}px, 0) rotateZ(-5deg) rotateX(38deg) scale(0.62)`, opacity: 1, offset: 0.42 },
    { transform: `${p} translate3d(0, 0, 0) rotateZ(-1deg) rotateX(12deg) scale(0.9)`, offset: 0.72 },
    { transform: `${p} translate3d(0, 0, 0) rotateZ(0deg) rotateX(0deg) scale(1)` },
  ];
};

/**
 * 一折从叠着（±180°）翻到摊平（0°），翻过一半后淡出，露出底下的内容。
 * lift：叠着时离纸面的距离，避免与纸面同一平面而闪烁；上折叠在最上面。
 */
const flapFrames = (from: number, lift: number): Keyframe[] => [
  { transform: `translateZ(${lift}px) rotateX(${from}deg)`, opacity: 1, offset: 0 },
  { transform: `translateZ(${lift}px) rotateX(${from}deg)`, opacity: 1, offset: 0.4 },
  { transform: `translateZ(${lift / 2}px) rotateX(${from / 2}deg)`, opacity: 1, offset: 0.58 },
  { transform: `translateZ(0px) rotateX(${from / 6}deg)`, opacity: 0.6, offset: 0.68 },
  { transform: 'translateZ(0px) rotateX(0deg)', opacity: 0, offset: 0.74 },
  { transform: 'translateZ(0px) rotateX(0deg)', opacity: 0, offset: 1 },
];

/** 播放整段动画；reverse 为收回。返回全部播完的 Promise。 */
const play = (reverse: boolean) => {
  const timing: KeyframeAnimationOptions = {
    duration: DURATION,
    direction: reverse ? 'reverse' : 'normal',
    fill: reverse ? 'both' : 'backwards',
  };
  const all: Animation[] = [];
  const run = (el: HTMLElement | null, frames: Keyframe[], options: KeyframeAnimationOptions = {}) => {
    const animation = el?.animate(frames, { ...timing, ...options });
    if (!animation) return;
    if (reverse) animation.playbackRate = CLOSE_RATE;
    all.push(animation);
  };

  run(sheet.value, flight(), { easing: 'cubic-bezier(0.3, 0.6, 0.25, 1)' });
  // 下折跟着上折慢一拍翻开：把它的时间轴整体往后挪。
  run(flapTop.value, flapFrames(-180, 2));
  run(flapBottom.value, flapFrames(180, 1).map((frame) => ({
    ...frame,
    offset: frame.offset === 0 || frame.offset === 1 ? frame.offset : Math.min(0.99, (frame.offset as number) + 0.14),
  })));
  // 翻过一半时，那一折底下的内容才露出来。
  run(paper.value, [
    { clipPath: FOLDED, offset: 0 },
    { clipPath: FOLDED, offset: 0.58 },
    { clipPath: TOP_OPEN, offset: 0.585 },
    { clipPath: TOP_OPEN, offset: 0.72 },
    { clipPath: ALL_OPEN, offset: 0.725 },
    { clipPath: ALL_OPEN, offset: 1 },
  ], { easing: 'linear' });
  run(creases.value, [
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: 0.8 },
    { opacity: 0, offset: 1 },
  ], { easing: 'linear' });
  return Promise.all(all.map((animation) => animation.finished)).catch(() => undefined);
};

let busy = false;

const show = async () => {
  if (!notice.value || busy || open.value) return;
  busy = true;
  open.value = true;
  markRead();
  await nextTick();
  backdrop.value?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced() ? 120 : 420, easing: 'ease-out' });
  const done = reduced()
    ? sheet.value?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }).finished
    : play(false);
  closeButton.value?.focus({ preventScroll: true });
  await done?.catch(() => undefined);
  busy = false;
};

const hide = async () => {
  if (!open.value || busy) return;
  busy = true;
  backdrop.value?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: reduced() ? 120 : DURATION / CLOSE_RATE, easing: 'ease-in', fill: 'forwards',
  });
  const done = reduced()
    ? sheet.value?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }).finished
    : play(true);
  await done?.catch(() => undefined);
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
        <div ref="paper" class="lc-notice__paper">
          <header class="lc-notice__head">
            <h2 id="lc-notice-title" class="lc-notice__title">{{ title }}</h2>
            <button ref="closeButton" class="lc-icon-btn lc-notice__close" type="button" :aria-label="theme.t('notice.close')"
              :title="theme.t('notice.close')" @click="hide">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </header>
          <div class="lc-notice__body lc-rich" v-html="html"></div>
          <span ref="creases" class="lc-notice__creases" aria-hidden="true"></span>
        </div>
        <!-- 折起来时盖在中间那一折上的上下两折（信纸背面）。 -->
        <span ref="flapTop" class="lc-notice__flap is-top" aria-hidden="true"></span>
        <span ref="flapBottom" class="lc-notice__flap is-bottom" aria-hidden="true"></span>
      </article>
    </div>
  </Teleport>
</template>

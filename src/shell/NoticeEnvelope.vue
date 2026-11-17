<!--
  站点公告：后台发布后，标题行右侧（直播状态的左边）露出一个斜放的米色信封，
  上半截压在顶栏下面，隐约发光。点开时信封飞到屏幕中间、掀开封口，信纸从里面抽出来、放大，
  显示公告内容（Markdown）。关闭时信纸往下滑走、淡出；过一会儿信封再从顶栏后面悄悄滑下来归位。
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

// ─── 打开与关闭 ─────────────────────────────────────────────
// 打开的全部动画用同一条时间轴（同样的时长，用关键帧的 offset 分段）：
//   0    – 0.26  信封从顶栏下飞到屏幕中间，转正、放大
//   0.28 – 0.44  封口向上掀开（翻过一半后转到信纸后面）
//   0.44 – 0.66  信纸从信封里往上抽出
//   0.68 – 1     信封往下淡出，信纸放大成公告
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DURATION = 1500;
/** 关闭后隔多久，信封从顶栏后面滑下来归位。 */
const RETURN_DELAY = 3000;
/** 信纸抽出时升起的高度（相对信纸自身高度）：整张抽出信封口袋，再交给公告放大，不会穿帮。 */
const LIFT = 1.02;

const flyer = ref<HTMLElement | null>(null);
const flap = ref<HTMLElement | null>(null);
const letter = ref<HTMLElement | null>(null);

const center = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

/** 播放打开的整段动画。返回全部播完的 Promise。 */
const play = () => {
  const from = envelope.value!.getBoundingClientRect();
  const env = flyer.value!.getBoundingClientRect();
  const mini = letter.value!.getBoundingClientRect();
  const page = sheet.value!.getBoundingClientRect();

  const all: Animation[] = [];
  const run = (el: HTMLElement | null, frames: Keyframe[], easing = 'ease-in-out') => {
    const animation = el?.animate(frames, { duration: DURATION, easing, fill: 'both' });
    if (animation) all.push(animation);
  };

  // 信封：从顶栏下那个小信封的位置飞来。
  const a = center(from);
  const b = center(env);
  const start = `translate(${a.x - b.x}px, ${a.y - b.y}px) rotate(-12deg) scale(${from.width / env.width})`;
  run(flyer.value, [
    { transform: start, opacity: 1, offset: 0 },
    { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1, offset: 0.26, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
    { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1, offset: 0.7 },
    { transform: 'translate(0, 36px) rotate(0deg) scale(0.96)', opacity: 0, offset: 0.92 },
    { transform: 'translate(0, 36px) rotate(0deg) scale(0.96)', opacity: 0, offset: 1 },
  ], 'linear');

  // 封口：以上缘为轴往上翻；翻过一半后转到信纸后面。
  run(flap.value, [
    { transform: 'perspective(700px) rotateX(0deg)', zIndex: 4, offset: 0 },
    { transform: 'perspective(700px) rotateX(0deg)', zIndex: 4, offset: 0.28 },
    { transform: 'perspective(700px) rotateX(90deg)', zIndex: 4, offset: 0.36 },
    { transform: 'perspective(700px) rotateX(90deg)', zIndex: 1, offset: 0.361 },
    { transform: 'perspective(700px) rotateX(180deg)', zIndex: 1, offset: 0.44 },
    { transform: 'perspective(700px) rotateX(180deg)', zIndex: 1, offset: 1 },
  ], 'linear');

  // 信封里的信纸：往上抽出，交给真正的公告。
  run(letter.value, [
    { transform: 'translateY(0)', opacity: 1, offset: 0 },
    { transform: 'translateY(0)', opacity: 1, offset: 0.44, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
    { transform: `translateY(${-LIFT * mini.height}px)`, opacity: 1, offset: 0.66 },
    { transform: `translateY(${-LIFT * mini.height}px)`, opacity: 1, offset: 0.68 },
    { transform: `translateY(${-LIFT * mini.height}px)`, opacity: 0, offset: 0.69 },
    { transform: `translateY(${-LIFT * mini.height}px)`, opacity: 0, offset: 1 },
  ], 'linear');

  // 公告：从抽出来的信纸那个位置与大小放大到屏幕中间。
  const c = center(mini);
  const d = center(page);
  const lifted = `translate(${c.x - d.x}px, ${c.y - LIFT * mini.height - d.y}px) scale(${mini.width / page.width}, ${mini.height / page.height})`;
  run(sheet.value, [
    { transform: lifted, opacity: 0, offset: 0 },
    { transform: lifted, opacity: 0, offset: 0.68 },
    { transform: lifted, opacity: 1, offset: 0.69, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)' },
    { transform: 'translate(0, 0) scale(1, 1)', opacity: 1, offset: 1 },
  ], 'linear');

  run(backdrop.value, [
    { opacity: 0, offset: 0 },
    { opacity: 1, offset: 0.3 },
    { opacity: 1, offset: 1 },
  ], 'linear');

  return Promise.all(all.map((animation) => animation.finished)).catch(() => undefined);
};

let busy = false;
/** 关闭后、信封还没归位的这段时间：顶栏下的信封先藏着。 */
const away = ref(false);
let returnTimer: number | undefined;

/** 信封从顶栏后面悄悄滑下来归位。 */
const slideBack = () => {
  away.value = false;
  if (reduced()) return;
  envelope.value?.animate([
    { transform: 'translateY(-48px) rotate(-12deg)' },
    { transform: 'translateY(0) rotate(-12deg)' },
  ], { duration: 900, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)' });
};

const show = async () => {
  if (!notice.value || busy || open.value || away.value) return;
  busy = true;
  open.value = true;
  markRead();
  await nextTick();
  if (reduced() && flyer.value) flyer.value.hidden = true;
  const done = reduced()
    ? sheet.value?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }).finished
    : play();
  closeButton.value?.focus({ preventScroll: true });
  await done?.catch(() => undefined);
  // 播完收起信封（fill 停在最后一帧时它已经是透明的）。
  flyer.value?.getAnimations().forEach((animation) => animation.cancel());
  if (flyer.value) flyer.value.hidden = true;
  busy = false;
};

/** 关闭：信纸往下滑走、淡出；三秒后信封再归位。 */
const hide = async () => {
  if (!open.value || busy) return;
  busy = true;
  away.value = true;
  const quick = reduced();
  const timing: KeyframeAnimationOptions = { duration: quick ? 120 : 420, easing: 'cubic-bezier(0.5, 0, 0.75, 0.2)', fill: 'forwards' };
  backdrop.value?.animate([{ opacity: 1 }, { opacity: 0 }], timing);
  const done = sheet.value?.animate(quick
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(56px)', opacity: 0 }], timing).finished;
  await done?.catch(() => undefined);
  open.value = false;
  busy = false;
  envelope.value?.focus({ preventScroll: true });
  window.clearTimeout(returnTimer);
  returnTimer = window.setTimeout(slideBack, RETURN_DELAY);
};

const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) hide();
};
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  window.clearTimeout(returnTimer);
});
</script>

<template>
  <button v-if="notice" ref="envelope" class="lc-notice-env" :class="{ 'is-unread': unread, 'is-open': open || away }"
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

      <!-- 打开与收起时出现在屏幕中间的大信封：背面、里面的信纸、前面的口袋、封口。 -->
      <div ref="flyer" class="lc-notice__envelope" aria-hidden="true">
        <span class="lc-notice__envelope-back"></span>
        <span ref="letter" class="lc-notice__envelope-letter"><i></i><i></i><i></i><i></i></span>
        <svg class="lc-notice__envelope-pocket" viewBox="0 0 100 62" preserveAspectRatio="none">
          <path d="M0 4 L50 36 L100 4 L100 62 L0 62 Z" />
          <path class="lc-notice__envelope-seam" d="M0 62 L42 31 M100 62 L58 31" />
        </svg>
        <svg ref="flap" class="lc-notice__envelope-flap" viewBox="0 0 100 40" preserveAspectRatio="none">
          <path d="M0 0 L100 0 L50 40 Z" />
        </svg>
      </div>

      <article ref="sheet" class="lc-notice__sheet" role="dialog" aria-modal="true" aria-labelledby="lc-notice-title">
        <div class="lc-notice__paper">
          <header class="lc-notice__head">
            <h2 id="lc-notice-title" class="lc-notice__title">{{ title }}</h2>
            <button ref="closeButton" class="lc-icon-btn lc-notice__close" type="button" :aria-label="theme.t('notice.close')"
              :title="theme.t('notice.close')" @click="hide">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </header>
          <div class="lc-notice__body lc-rich" v-html="html"></div>
        </div>
      </article>
    </div>
  </Teleport>
</template>

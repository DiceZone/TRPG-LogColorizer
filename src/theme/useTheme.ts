// 主题的当前状态与切换。整个应用共用一份。
import { computed, reactive, ref, watch } from 'vue';
import { useDark, usePreferredDark } from '@vueuse/core';
import type { GlobalThemeOverrides } from 'naive-ui';
import { config } from '~/config';
import { ColorMode, DEFAULT_ASIDE, DEFAULT_SECTIONS, LoadedTheme, SectionId } from './types';
import { DEFAULT_STRINGS, StringKey } from './strings';
import { loadTheme } from './registry';

const MODE_KEY = 'lc-mode';

// 与原有组件（编辑器）共用 vueuse 的明暗状态：html 上的 dark 类。
// 参数须与那些组件里的 useDark 一致，这样各处拿到的是同一份状态。
const isDark = useDark({ disableTransition: false });
const prefersDark = usePreferredDark();

const state = reactive({
  ready: false,
  current: null as LoadedTheme | null,
  error: '',
});

/** 访客自己选过的明暗模式；没选过为空，跟随主题默认或系统。 */
const chosenMode = ref<ColorMode | ''>((localStorage.getItem(MODE_KEY) as ColorMode) || '');

/** 每次主题或明暗变化后加一，用来触发重新读取设计变量。 */
const revision = ref(0);

function styleElement(id: string): HTMLStyleElement {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

function declarations(tokens: Record<string, string> | undefined): string {
  return Object.entries(tokens ?? {}).map(([name, value]) => `${name}: ${value};`).join(' ');
}

function supportedModes(theme: LoadedTheme | null): ColorMode[] {
  return theme?.manifest.modes?.length ? theme.manifest.modes : ['light', 'dark'];
}

function applyMode() {
  const modes = supportedModes(state.current);
  let mode: ColorMode;
  if (modes.length === 1) mode = modes[0];
  else if (chosenMode.value) mode = chosenMode.value;
  else mode = state.current?.manifest.defaultMode ?? (prefersDark.value ? 'dark' : 'light');
  isDark.value = mode === 'dark';
  // vueuse 要等到渲染之后才改 html 上的 dark 类，而控件配色在渲染时就读设计变量，
  // 不先改好的话读到的是另一种模式的颜色（深色模式下输入框是白底）。
  document.documentElement.classList.toggle('dark', isDark.value);
  revision.value += 1;
}

function apply(theme: LoadedTheme) {
  const { manifest } = theme;
  const root = document.documentElement;
  root.dataset.theme = manifest.id;
  root.dataset.layout = manifest.layout ?? 'workspace';
  // 清单里的变量先写，主题样式后写：样式文件里可以再覆盖。
  styleElement('lc-theme-tokens').textContent =
    `:root { ${declarations(manifest.tokens?.light)} }\n:root.dark { ${declarations(manifest.tokens?.dark)} }`;
  styleElement('lc-theme-css').textContent = theme.css;
  state.current = theme;
  applyMode();
}

async function init() {
  // 主题服务器很慢或挂了的时候，最多等两秒就先用内置样式显示出来。
  const reveal = window.setTimeout(() => { state.ready = true; }, 2000);
  try {
    // 用部署者指定的主题；它载入失败时退回 default，再不行就用内置样式。
    for (const id of [...new Set([config.theme, 'default'])]) {
      try {
        apply(await loadTheme(id));
        state.error = '';
        break;
      } catch (err) {
        console.warn(`主题 ${id} 载入失败：`, err);
        state.error = '主题载入失败，已使用内置样式。';
      }
    }
    applyMode();
  } finally {
    window.clearTimeout(reveal);
    state.ready = true;
  }
}

function toggleMode() {
  chosenMode.value = isDark.value ? 'light' : 'dark';
  localStorage.setItem(MODE_KEY, chosenMode.value);
  applyMode();
}

watch(prefersDark, applyMode);

// ─── 给界面用的派生值 ───────────────────────────────────────

function t(key: StringKey, params?: Record<string, string | number>): string {
  let text: string = state.current?.manifest.strings?.[key] ?? DEFAULT_STRINGS[key];
  if (key === 'brand.name') text = state.current?.manifest.brand?.name ?? text;
  if (key === 'brand.footer') text = state.current?.manifest.brand?.footer ?? text;
  for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{${name}}`, String(value));
  return text;
}

// 编辑器区块承载着日志的载入，主题没列它也要显示。
const sections = computed<SectionId[]>(() => {
  const list = state.current?.manifest.sections ?? DEFAULT_SECTIONS;
  return list.includes('editor') ? list : [...list, 'editor'];
});
// 编辑器只放主区：放进侧栏的话，换主题时它会被重新挂载，已经载入的日志就没了。
const aside = computed<SectionId[]>(() =>
  (state.current?.manifest.aside ?? DEFAULT_ASIDE).filter((id) => id !== 'editor'));
const layout = computed(() => state.current?.manifest.layout ?? 'workspace');
const canToggleMode = computed(() => supportedModes(state.current).length > 1);
const logo = computed(() => {
  const path = state.current?.manifest.brand?.logo;
  return path ? state.current!.resolve(path) : `${import.meta.env.BASE_URL}favicon.svg`;
});
const links = computed(() => state.current?.manifest.brand?.links ?? []);
const palette = computed(() => state.current?.manifest.palette ?? null);

// Naive UI 的配色要的是算好的颜色值，不认 var()。用一个探针元素把设计变量解析成 rgb。
let probe: HTMLElement | null = null;
function resolveColor(name: string, fallback: string): string {
  if (!probe) {
    probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.appendChild(probe);
  }
  probe.style.color = '';
  probe.style.color = `var(${name})`;
  const value = getComputedStyle(probe).color;
  return value && value !== 'rgba(0, 0, 0, 0)' ? value : fallback;
}

function resolveText(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const naiveOverrides = computed<GlobalThemeOverrides>(() => {
  void revision.value;
  const color = resolveColor;
  const primary = color('--lc-primary', '#4f46e5');
  const primaryHover = color('--lc-primary-hover', primary);
  const primaryPressed = color('--lc-primary-pressed', primary);
  const surface = color('--lc-surface', '#ffffff');
  const border = color('--lc-border', '#e5e7eb');
  return {
    common: {
      primaryColor: primary,
      primaryColorHover: primaryHover,
      primaryColorPressed: primaryPressed,
      primaryColorSuppl: primary,
      infoColor: primary,
      infoColorHover: primaryHover,
      infoColorPressed: primaryPressed,
      infoColorSuppl: primary,
      errorColor: color('--lc-danger', '#dc2626'),
      successColor: color('--lc-success', '#16a34a'),
      warningColor: color('--lc-warning', '#ca8a04'),
      bodyColor: color('--lc-bg', '#ffffff'),
      cardColor: surface,
      modalColor: surface,
      popoverColor: color('--lc-surface-raised', surface),
      inputColor: color('--lc-input-bg', surface),
      textColorBase: color('--lc-text', '#111827'),
      textColor1: color('--lc-text', '#111827'),
      textColor2: color('--lc-text', '#111827'),
      textColor3: color('--lc-text-muted', '#6b7280'),
      placeholderColor: color('--lc-text-faint', '#9ca3af'),
      borderColor: border,
      dividerColor: border,
      borderRadius: resolveText('--lc-radius-sm', '6px'),
      borderRadiusSmall: resolveText('--lc-radius-sm', '6px'),
      fontFamily: resolveText('--lc-font-sans', 'system-ui, sans-serif'),
      fontFamilyMono: resolveText('--lc-font-mono', 'monospace'),
      fontWeightStrong: '600',
    },
  };
});

export function useTheme() {
  return {
    state, isDark, revision, t, sections, aside, layout, canToggleMode, logo, links, palette, naiveOverrides,
    init, toggleMode,
  };
}

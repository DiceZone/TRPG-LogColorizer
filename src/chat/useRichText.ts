// 按需载入 richText（markdown-it 与 KaTeX）。载入完成前返回 null，调用方先按普通文字显示。
import { shallowRef } from 'vue';

type RenderRich = typeof import('./richText').renderRich;

const renderer = shallowRef<RenderRich | null>(null);
let loading: Promise<void> | null = null;

export function useRichText() {
  loading ??= import('./richText')
    .then((module) => { renderer.value = module.renderRich; })
    .catch((err) => {
      console.error(err);
      loading = null;
    });
  return renderer;
}

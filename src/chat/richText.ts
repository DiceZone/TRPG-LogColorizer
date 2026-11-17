// 聊天视图消息与站点公告的 Markdown 与 LaTeX 公式渲染。
// markdown-it 与 KaTeX 加起来有几百 KB，只在第一次打开聊天视图时才载入；
// 载入完成前，消息先按普通文字显示。
import MarkdownIt from 'markdown-it';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { findMath } from '~/utils/texMath';

const md = new MarkdownIt({ html: false, breaks: true, linkify: true });
// 骰娘回复常用空格缩进排版，不当成代码块；
// 「结果」下一行接「---」分隔线也很常见，不当成标题（setext 标题）。
md.disable(['code', 'lheading']);

const renderLink = md.renderer.rules.link_open
  ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank');
  tokens[idx].attrSet('rel', 'noopener noreferrer');
  return renderLink(tokens, idx, options, env, self);
};

/** CQ 码、mirai 码、[图:…]：交给原有的图片与 @ 处理，不让 Markdown 改动里面的字。 */
const CODE = /\[CQ:[^\][]*(?:\[[^\]]*\][^\][]*)*\]|\[mirai:[^\]]*\]|\[(?:image|图):[^\]]+\]/g;
const PLACEHOLDER = /(\d+)/g;

function renderMath(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    // 公式里夹着中文是骰娘的常态，不必提示。
    strict: 'ignore',
    output: 'html',
    trust: false,
  });
}

/**
 * 把一条骰娘消息渲染成 HTML。
 * @param raw 原文（未转义）
 * @param renderCode 处理 CQ 码等标记，返回 HTML
 */
export function renderRich(raw: string, renderCode: (code: string) => string): string {
  const slots: string[] = [];
  const blocks = new Set<number>();
  const hold = (html: string, block = false) => {
    const index = slots.push(html) - 1;
    if (block) blocks.add(index);
    return `${index}`;
  };

  let text = raw.replace(CODE, (code) => hold(renderCode(code)));
  // 引用只到换行为止：Markdown 会把引用下一行的普通文字也接进引用里（延续行），
  // 聊天消息里一行就是一行，所以在引用与紧跟的普通行之间断开。
  text = text.replace(/^(>[^\n]*)\n(?=[^>\n])/gm, '$1\n\n');

  const segments = findMath(text);
  if (segments.length) {
    let out = '';
    let last = 0;
    for (const seg of segments) {
      out += text.slice(last, seg.start) + hold(renderMath(seg.tex, seg.display), seg.display);
      last = seg.end;
    }
    text = out + text.slice(last);
  }

  // 独占一段的公式本身就会换行，前后的 <br> 会多出一行空白。
  const html = md.render(text).trim()
    .replace(/(?:<br>\s*)?(\d+)(?:\s*<br>)?/g, (match, n: string) => (
      blocks.has(Number(n)) ? `${n}` : match));
  return html.replace(PLACEHOLDER, (_m, n: string) => slots[Number(n)] ?? '');
}

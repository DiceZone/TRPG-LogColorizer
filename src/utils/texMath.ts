// 骰娘消息里的 LaTeX 公式：找出公式在哪，以及把公式换成纯文字。
// 不依赖任何第三方包；渲染成公式样式的部分在 chat/richText.ts。

export interface MathSegment {
  /** 公式本身，不含 $ 等定界符。 */
  tex: string;
  /** 独占一段（$$…$$、\[…\]、单独一行的 \boxed{…} 之类）。 */
  display: boolean;
  /** 在原文里的起止位置（含定界符）。 */
  start: number;
  end: number;
}

/** 花括号是否配对（忽略 \{ \}）。 */
function balanced(text: string): boolean {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '\\') { i += 1; continue; }
    if (c === '{') depth += 1;
    else if (c === '}' && --depth < 0) return false;
  }
  return depth === 0;
}

/** 从 from 起找下一个没被反斜杠转义的 token。 */
function findClose(text: string, token: string, from: number): number {
  for (let i = from; i <= text.length - token.length; i += 1) {
    if (text[i] === '\\' && !token.startsWith('\\')) { i += 1; continue; }
    if (text.startsWith(token, i)) return i;
  }
  return -1;
}

/** 单独一行、以 \命令{ 开头且括号配对的内容，没写 $ 也当成公式（有些骰娘就这样发）。 */
const BARE_LINE = /^[ \t]*(\\[A-Za-z]+[ \t]*[{[][^\r\n]*?)[ \t]*\r?$/gm;

/** 找出一段文字里所有的公式，按出现顺序排列，互不重叠。 */
export function findMath(text: string): MathSegment[] {
  const found: MathSegment[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && (text[i + 1] === '[' || text[i + 1] === '(')) {
      const display = text[i + 1] === '[';
      const close = findClose(text, display ? '\\]' : '\\)', i + 2);
      if (close > 0) {
        found.push({ tex: text.slice(i + 2, close), display, start: i, end: close + 2 });
        i = close + 2;
        continue;
      }
    }
    if (c === '\\') { i += 2; continue; }
    if (c === '$') {
      if (text[i + 1] === '$') {
        const close = findClose(text, '$$', i + 2);
        if (close > i + 2) {
          found.push({ tex: text.slice(i + 2, close), display: true, start: i, end: close + 2 });
          i = close + 2;
          continue;
        }
      } else {
        // 行内 $…$：开头后与结尾前都不能是空白，结尾后不能紧跟数字（避免把「$5 和 $10」当成公式）。
        const close = findClose(text, '$', i + 1);
        const tex = close > 0 ? text.slice(i + 1, close) : '';
        if (tex && !tex.includes('\n') && !/^\s|\s$/.test(tex) && !/\d/.test(text[close + 1] ?? '')) {
          found.push({ tex, display: false, start: i, end: close + 1 });
          i = close + 1;
          continue;
        }
      }
    }
    i += 1;
  }

  // 没有定界符、单独一行的公式。
  for (const match of text.matchAll(BARE_LINE)) {
    const start = match.index! + match[0].indexOf(match[1]);
    const end = start + match[1].length;
    if (!balanced(match[1])) continue;
    if (found.some((seg) => start < seg.end && end > seg.start)) continue;
    found.push({ tex: match[1], display: true, start, end });
  }
  return found.sort((a, b) => a.start - b.start);
}

// ─── 公式 → 纯文字 ───────────────────────────────────────────

/** 只改字号、字体、颜色等样式，换成纯文字时整个去掉。 */
const SWITCHES = new Set([
  'tiny', 'scriptsize', 'footnotesize', 'small', 'normalsize', 'large', 'Large', 'LARGE', 'huge', 'Huge',
  'bf', 'sf', 'it', 'rm', 'tt', 'sl', 'sc', 'em', 'cal', 'frak', 'Bbb', 'boldsymbol',
  'displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle',
  'left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'middle',
  'limits', 'nolimits', 'notag', 'nonumber', 'hline', 'phantom', 'strut',
]);

/** 第一个参数是颜色之类的设定，丢掉不输出。键为命令名，值为要丢掉的参数个数。 */
const SKIP_ARGS: Record<string, number> = {
  color: 1, textcolor: 1, colorbox: 1, fcolorbox: 2, hspace: 1, vspace: 1, kern: 0, rule: 2,
  begin: 1, end: 1, label: 1, tag: 0, href: 1,
};

const SYMBOLS: Record<string, string> = {
  times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', ast: '*', star: '☆', circ: '∘', bullet: '•',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡', sim: '~',
  ll: '≪', gg: '≫', propto: '∝', infty: '∞', partial: '∂', nabla: '∇', degree: '°',
  to: '→', rightarrow: '→', Rightarrow: '⇒', leftarrow: '←', Leftarrow: '⇐', gets: '←',
  leftrightarrow: '↔', Leftrightarrow: '⇔', uparrow: '↑', downarrow: '↓', mapsto: '↦',
  longrightarrow: '⟶', implies: '⟹', iff: '⟺',
  sum: '∑', prod: '∏', int: '∫', in: '∈', notin: '∉', subset: '⊂', supset: '⊃', cup: '∪', cap: '∩',
  forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', emptyset: '∅', varnothing: '∅',
  ldots: '…', cdots: '⋯', dots: '…', vdots: '⋮', prime: '′', checkmark: '✓',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ',
  sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  quad: ' ', qquad: ' ', enspace: ' ', space: ' ', lbrace: '{', rbrace: '}', langle: '⟨', rangle: '⟩',
  vert: '|', Vert: '‖', mid: '|', backslash: '\\', S: '§', P: '¶', dag: '†', ddag: '‡',
  textbackslash: '\\', LaTeX: 'LaTeX', TeX: 'TeX',
};

/** 这些命令里的内容按原样（保留空格）输出。 */
const TEXT_MODE = new Set(['text', 'textrm', 'textsf', 'texttt', 'textbf', 'textit', 'textnormal', 'mbox', 'hbox', 'textup', 'emph']);

class TexReader {
  i = 0;
  constructor(private src: string) {}

  /** 读到 stop 之前（或读完），返回纯文字。 */
  read(textMode: boolean, stop?: string): string {
    let out = '';
    const s = this.src;
    while (this.i < s.length) {
      const c = s[this.i];
      if (stop && c === stop) return out;
      if (c === '{') {
        this.i += 1;
        out += this.read(textMode, '}');
        this.i += 1;
      } else if (c === '\\') {
        out += this.command(textMode);
      } else if (c === '^' || c === '_') {
        this.i += 1;
        out += this.arg(textMode);
      } else if (c === '~') {
        this.i += 1;
        out += ' ';
      } else if (c === '&') {
        this.i += 1;
        out += ' ';
      } else if (/\s/.test(c)) {
        this.i += 1;
        // 数学模式里空格不算数；文字模式里连续空白只留一个。
        if (textMode && !out.endsWith(' ')) out += ' ';
      } else {
        this.i += 1;
        out += c;
      }
    }
    return out;
  }

  /** 读一个参数：{…} 或单个字符/命令；前面的空白跳过。 */
  arg(textMode: boolean): string {
    this.skipSpace();
    const c = this.src[this.i];
    if (c === undefined) return '';
    if (c === '{') {
      this.i += 1;
      const out = this.read(textMode, '}');
      this.i += 1;
      return out;
    }
    if (c === '\\') return this.command(textMode);
    this.i += 1;
    return c;
  }

  /** 跳过一个 [可选参数]。 */
  optional() {
    this.skipSpace();
    if (this.src[this.i] !== '[') return;
    const close = this.src.indexOf(']', this.i);
    this.i = close < 0 ? this.src.length : close + 1;
  }

  skipSpace() {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i += 1;
  }

  /** 后面紧跟 { 才算有参数（只看空白之后）。 */
  hasGroup(): boolean {
    let j = this.i;
    while (j < this.src.length && /\s/.test(this.src[j])) j += 1;
    return this.src[j] === '{';
  }

  command(textMode: boolean): string {
    const s = this.src;
    this.i += 1; // 反斜杠
    const name = /^[A-Za-z]+/.exec(s.slice(this.i))?.[0];
    if (!name) {
      // \\ 换行，\, \; \! 等间距，\{ \% 等转义字符。
      const c = s[this.i] ?? '';
      this.i += 1;
      if (c === '\\') return '\n';
      if (c === ',' || c === ';' || c === ':' || c === ' ' || c === '>') return ' ';
      if (c === '!') return '';
      return c;
    }
    this.i += name.length;

    if (SWITCHES.has(name)) return '';
    if (TEXT_MODE.has(name)) return this.arg(true);
    if (name in SKIP_ARGS) {
      for (let n = 0; n < SKIP_ARGS[name]; n += 1) this.arg(textMode);
      if (name === 'color' || name === 'begin' || name === 'end' || name === 'label') return '';
      return this.hasGroup() ? this.arg(textMode) : '';
    }
    switch (name) {
      case 'frac': case 'dfrac': case 'tfrac': case 'cfrac': {
        const top = this.arg(textMode);
        return `${top}/${this.arg(textMode)}`;
      }
      case 'binom': {
        const n = this.arg(textMode);
        return `C(${n},${this.arg(textMode)})`;
      }
      case 'sqrt': {
        this.optional();
        return `√${this.arg(textMode)}`;
      }
      case 'overset': case 'stackrel': {
        // 上面的字在前，底下的在后。
        const over = this.arg(textMode).trim();
        const base = this.arg(textMode).trim();
        return [over, base].filter(Boolean).join(' ');
      }
      case 'underset': {
        const under = this.arg(textMode).trim();
        const base = this.arg(textMode).trim();
        return [base, under].filter(Boolean).join(' ');
      }
      case 'xrightarrow': case 'xleftarrow': {
        this.optional();
        const label = this.arg(textMode);
        return name === 'xrightarrow' ? `→${label}→` : `←${label}←`;
      }
      default:
        break;
    }
    if (name in SYMBOLS) return SYMBOLS[name];
    // 其余命令（\boxed、\mathbf、\underline、\operatorname…）：只留下参数里的文字。
    let out = '';
    while (this.hasGroup()) out += this.arg(textMode);
    return out;
  }
}

/** 把一段 LaTeX 公式换成纯文字：保留文字与数字，去掉颜色、字号、方框等样式。 */
export function texToText(tex: string): string {
  return new TexReader(tex).read(false)
    .split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).join('\n').trim();
}

/** 把一段文字里的公式都换成纯文字，其余原样保留。 */
export function stripMath(text: string): string {
  const segments = findMath(text);
  if (!segments.length) return text;
  let out = '';
  let last = 0;
  for (const seg of segments) {
    out += text.slice(last, seg.start) + texToText(seg.tex);
    last = seg.end;
  }
  return out + text.slice(last);
}

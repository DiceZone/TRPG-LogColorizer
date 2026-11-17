// 主题的格式。主题只包含数据、样式与素材，不含脚本——
// 界面逻辑全部留在本体里，本体升级时主题不需要跟着改。

/** 页面上可以由主题安排位置的区块。 */
export type SectionId = 'intro' | 'options' | 'characters' | 'editor' | 'export';

/** 版面：workspace 为左右两栏（侧栏 + 主区），stack 为单栏从上到下。 */
export type LayoutId = 'workspace' | 'stack';

export type ColorMode = 'light' | 'dark';

export interface ThemeLink {
  label: string;
  url: string;
}

export interface ThemeBrand {
  /** 显示在页眉的站点名称。 */
  name?: string;
  /** logo 图片，相对主题包根目录的路径。 */
  logo?: string;
  /** 页眉右侧的链接。 */
  links?: ThemeLink[];
  /** 页面底部的一行文字。 */
  footer?: string;
}

export interface ThemeManifest {
  /** 主题包格式的版本，目前为 1。 */
  engine: 1;
  /** 唯一标识：小写字母、数字与短横线。 */
  id: string;
  name: string;
  version?: string;
  author?: string;
  description?: string;

  /** 支持的明暗模式；只写一个时不显示明暗切换。默认两个都支持。 */
  modes?: ColorMode[];
  /** 访客没有切换过明暗时使用的模式；省略则跟随系统。 */
  defaultMode?: ColorMode;

  /** 设计变量（CSS 自定义属性，如 --lc-primary）。写在 theme.css 里也可以，这里只是更省事。 */
  tokens?: { light?: Record<string, string>; dark?: Record<string, string> };
  /** 样式文件，相对主题包根目录的路径。默认为 theme.css（存在的话）。 */
  styles?: string[];

  layout?: LayoutId;
  /** 区块的显示顺序；没列出的区块不显示。省略则全部按默认顺序显示。 */
  sections?: SectionId[];
  /** workspace 版面下放进侧栏的区块。 */
  aside?: SectionId[];

  brand?: ThemeBrand;
  /** 覆盖界面上的文字，键名见 strings.ts。 */
  strings?: Record<string, string>;
  /** 新角色依次取用的默认颜色。 */
  palette?: string[];
}

/** 载入后的主题：清单加上已经解析好的资源地址。 */
export interface LoadedTheme {
  manifest: ThemeManifest;
  /** 已经把相对路径换成可用地址的样式文本。 */
  css: string;
  /** 把主题包内的相对路径换成可用地址。 */
  resolve: (path: string) => string;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const SECTIONS: SectionId[] = ['intro', 'options', 'characters', 'editor', 'export'];
const TOKEN_NAME = /^--[a-z0-9-]{1,64}$/;

function fail(message: string): never {
  throw new Error(`主题清单不合法：${message}`);
}

function sectionList(value: unknown, field: string): SectionId[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item) => SECTIONS.includes(item))) {
    fail(`${field} 只能包含 ${SECTIONS.join('、')}`);
  }
  return [...new Set(value as SectionId[])];
}

function tokenMap(value: unknown, field: string): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} 应为对象`);
  const out: Record<string, string> = {};
  for (const [name, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!TOKEN_NAME.test(name)) fail(`${field} 里的「${name}」不是合法的变量名`);
    const text = String(raw);
    // 变量值会原样写进样式表，不允许借它跳出声明。
    if (/[;{}<>]/.test(text) || text.length > 400) fail(`${field} 里「${name}」的值不合法`);
    out[name] = text;
  }
  return out;
}

/** 校验并整理主题清单；不合法时抛出带说明的错误。 */
export function parseManifest(raw: unknown): ThemeManifest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('应为 JSON 对象');
  const data = raw as Record<string, any>;
  if (data.engine !== 1) fail('engine 应为 1');
  if (typeof data.id !== 'string' || !ID_PATTERN.test(data.id)) fail('id 须为小写字母、数字与短横线，最长 32 位');
  if (typeof data.name !== 'string' || !data.name.trim()) fail('缺少 name');

  const modes = data.modes === undefined ? undefined : data.modes;
  if (modes !== undefined && (!Array.isArray(modes) || modes.length === 0
    || !modes.every((mode: unknown) => mode === 'light' || mode === 'dark'))) {
    fail('modes 只能包含 light 与 dark');
  }
  if (data.defaultMode !== undefined && data.defaultMode !== 'light' && data.defaultMode !== 'dark') {
    fail('defaultMode 只能是 light 或 dark');
  }
  if (data.layout !== undefined && data.layout !== 'workspace' && data.layout !== 'stack') {
    fail('layout 只能是 workspace 或 stack');
  }
  if (data.styles !== undefined && (!Array.isArray(data.styles) || !data.styles.every((s: unknown) => typeof s === 'string'))) {
    fail('styles 应为文件路径的数组');
  }
  if (data.strings !== undefined && (typeof data.strings !== 'object' || Array.isArray(data.strings))) {
    fail('strings 应为对象');
  }
  if (data.palette !== undefined && (!Array.isArray(data.palette)
    || !data.palette.every((c: unknown) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)))) {
    fail('palette 应为 #rrggbb 颜色的数组');
  }

  const brand = data.brand;
  if (brand !== undefined && (typeof brand !== 'object' || Array.isArray(brand))) fail('brand 应为对象');
  const links = brand?.links;
  if (links !== undefined && (!Array.isArray(links) || !links.every((link: any) =>
    link && typeof link.label === 'string' && typeof link.url === 'string' && /^https?:\/\//i.test(link.url)))) {
    fail('brand.links 的每一项须有 label 与以 http(s) 开头的 url');
  }

  return {
    engine: 1,
    id: data.id,
    name: data.name.trim(),
    version: data.version === undefined ? undefined : String(data.version),
    author: data.author === undefined ? undefined : String(data.author),
    description: data.description === undefined ? undefined : String(data.description),
    modes: modes ? [...new Set(modes as ColorMode[])] : undefined,
    defaultMode: data.defaultMode,
    tokens: data.tokens === undefined ? undefined : {
      light: tokenMap(data.tokens.light, 'tokens.light'),
      dark: tokenMap(data.tokens.dark, 'tokens.dark'),
    },
    styles: data.styles,
    layout: data.layout,
    sections: sectionList(data.sections, 'sections'),
    aside: sectionList(data.aside, 'aside'),
    brand: brand === undefined ? undefined : {
      name: typeof brand.name === 'string' ? brand.name : undefined,
      logo: typeof brand.logo === 'string' ? brand.logo : undefined,
      links,
      footer: typeof brand.footer === 'string' ? brand.footer : undefined,
    },
    strings: data.strings === undefined ? undefined
      : Object.fromEntries(Object.entries(data.strings).map(([key, value]) => [key, String(value)])),
    palette: data.palette,
  };
}

export const DEFAULT_SECTIONS: SectionId[] = ['intro', 'characters', 'options', 'editor', 'export'];
export const DEFAULT_ASIDE: SectionId[] = ['characters', 'options', 'export'];

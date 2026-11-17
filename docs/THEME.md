# 主题开发指南

TRPG-LogColorizer 把「功能」和「外观」分开：功能（日志解析、染色、导出、实时日志）只写在本体里，外观全部交给主题。
主题只包含**数据、样式与素材，不含脚本**。本体升级时主题不需要改，主题作者也不需要碰本体的代码——
这样日志站可以随时合入上游的更新，而不必像整套改写的分支那样与上游脱钩。

## 主题包长什么样

一个主题就是一个目录，目录名与清单里的 `id` 相同：

```
my-theme/
├── theme.json    必需：清单
├── theme.css     可选：样式
└── assets/       可选：图片、字体（文件名随意，样式里用相对路径引用）
```

## 怎么启用

主题由部署者决定，访客不能更换。把主题目录放进站点，再用环境变量 `LOG_THEME` 指定目录名：

| 部署方式 | 主题放在哪 | `LOG_THEME` 何时生效 |
|---|---|---|
| 静态托管（EdgeOne Pages 等） | 源码的 `public/themes/<id>/` | 构建时读取，改了要重新部署 |
| Docker | `docker-compose.yml` 旁边的 `themes/<id>/` | 容器启动时读取，重启即生效，不用重新构建 |

没设 `LOG_THEME` 时用 `default`；指定的主题载入失败时也退回 `default`。

要把主题分享给别的站长，可以打成 zip，对方解压进自己的 themes/ 目录即可：

```bash
pnpm theme:pack path/to/my-theme
```

## theme.json

```jsonc
{
  "engine": 1,                       // 主题格式的版本，目前为 1
  "id": "my-theme",                  // 小写字母、数字、短横线，最长 32 位
  "name": "我的主题",
  "version": "1.0.0",
  "author": "作者",
  "description": "一句话介绍，显示在主题菜单里",

  "modes": ["light", "dark"],        // 支持的明暗模式；只写一个时不显示明暗切换
  "defaultMode": "dark",             // 访客没切换过明暗时用哪个；省略则跟随系统

  "tokens": {                        // 设计变量，见下一节；写在 theme.css 里也可以
    "light": { "--lc-primary": "#8a3a1c" },
    "dark":  { "--lc-primary": "#f0a37f" }
  },
  "styles": ["theme.css"],           // 样式文件；省略时默认读 theme.css

  "layout": "workspace",             // workspace：左侧栏 + 主区（窄屏时侧栏收进抽屉）；stack：单栏从上到下
  "sections": ["intro", "editor", "characters", "options", "export"],  // 区块顺序；没列的不显示
  "aside": ["characters", "options", "export"],                       // workspace 版面下放进侧栏的区块

  "brand": {
    "name": "我的日志站",              // 页眉的站名
    "logo": "assets/logo.svg",       // 相对主题目录
    "links": [{ "label": "官网", "url": "https://example.com" }],   // 页眉右侧的文字链接
    "footer": "页脚的一行字"
  },
  "strings": {                       // 改写界面文字，键名见 src/theme/strings.ts
    "intro.title": "跑团记录",
    "editor.view.preview": "阅读"
  },
  "palette": ["#8a3a1c", "#2f5d50"]  // 新角色依次取用的颜色
}
```

区块有五个：`intro`（标题与介绍）、`options`（渲染选项）、`characters`（角色列表）、`editor`（日志编辑与预览）、`export`（导出）。
`editor` 承载着日志的载入，不能隐藏也不能放进侧栏，主题没列它时本体会自动补上。

## 设计变量

本体的样式只通过这些变量取色、取尺寸。大多数主题只改变量就够了。完整列表与默认值见 `src/styles/tokens.css`。

| 变量 | 用途 |
|---|---|
| `--lc-bg` | 页面背景 |
| `--lc-surface` / `--lc-surface-raised` / `--lc-surface-sunken` | 卡片 / 浮层 / 凹下去的区域（页签槽、角色行） |
| `--lc-text` / `--lc-text-muted` / `--lc-text-faint` | 正文 / 说明 / 更淡的辅助文字 |
| `--lc-border` / `--lc-border-strong` | 分隔线 / 输入框与按钮边框 |
| `--lc-primary`（`-hover` `-pressed` `-contrast` `-soft`） | 主色及其变体 |
| `--lc-danger` `--lc-success` `--lc-warning` `--lc-live` | 状态色；`--lc-live` 是直播指示点 |
| `--lc-editor-*` | 编辑器的底色、文字、行号栏、当前行、高度、字号 |
| `--lc-preview-bg` `--lc-preview-time` `--lc-preview-font*` | 预览区的底色、时间戳颜色、字体、字号、行距 |
| `--lc-chat-bg` `--lc-chat-bubble` | 聊天视图的底色与气泡颜色（默认取预览底色与 `--lc-surface-sunken`） |
| `--lc-font-sans` `--lc-font-mono` `--lc-font-display` | 正文、等宽、标题字体 |
| `--lc-radius` `--lc-radius-sm` | 卡片 / 按钮与输入框的圆角 |
| `--lc-page-max-width` `--lc-aside-width` `--lc-gap` `--lc-card-padding` `--lc-header-height` | 版面尺寸 |

按钮、输入框、下拉菜单等控件（Naive UI）的配色也由这些变量自动换算，不需要另外处理。

## 写样式

主题载入时，`<html>` 上会有：

- `data-theme="<id>"`：当前主题，样式规则建议都以 `[data-theme="my-theme"]` 开头，换主题时不会残留。
- `data-layout="workspace|stack"`
- `class="dark"`：深色模式

可以依赖的类名（**稳定接口**，本体升级时不会改名；没列在这里的类名可能变动）：

| 类名 | 是什么 |
|---|---|
| `.lc-app` `.lc-header` `.lc-page` `.lc-main` `.lc-aside` `.lc-footer` | 骨架 |
| `.lc-brand` `__logo` `__name` `__version` | 页眉左侧 |
| `.lc-intro` `__title` `__desc` `__notice` | 标题区块 |
| `.lc-card` `__head` `__title` `__desc` `__actions` `__body`，以及 `[data-section="<区块>"]` | 区块外框 |
| `.lc-btn` `--primary` `--small`，`.lc-icon-btn`，`.lc-tag`，`.lc-tabs` `.lc-tab.is-active` | 控件 |
| `.lc-toggle` `.is-on` | 开关按钮（编辑器染色、自动滚动等） |
| `.lc-log-area` `.lc-jump` | 日志区与右下角的「跳到最新」 |
| `.lc-char` `__avatar` `__name` `__meta` `.is-linked`（颜色取 `--lc-char-color`） | 角色卡 |
| `.lc-avatar`（`--lc-avatar-size` `--lc-avatar-color`） | 头像 |
| `.lc-drawer` `.lc-drawer__tab` | 窄屏时的侧栏抽屉与左缘页签 |
| `.lc-chat` `.lc-chat__date` `.lc-msg` `__avatar` `__name` `__id` `__time` `__bubble`，`.is-continued` `.is-dice` `.is-host` | 聊天视图的一条消息 |
| `.lc-live` 与 `[data-status="connecting|live|retrying|ended"]`，`__dot` | 实时日志的状态标记 |
| `.preview` `.list-item-dynamic` `._time` `._nickname` `._message` | 预览里的一条消息 |
| `.lc-deco--backdrop` `.lc-deco--top` `.lc-deco--bottom` | 留给主题做装饰的空元素，默认不显示 |

装饰元素的用法见内置的 `terminal` 主题（用 `.lc-deco--backdrop` 铺扫描线）。

## 内置的示例

- `default`：与 Dice!Next 管理面板一致的配色与版式，亮色与深色。它没有自己的样式，用的就是 `src/styles/tokens.css` 里的默认值。
- `parchment`：只改设计变量加少量样式，换成纸张与衬线字体、单栏版面。
- `terminal`：深色等宽、直角、扫描线与边角装饰，并改写了部分界面文字。

从示例复制一份开始改是最快的方法。

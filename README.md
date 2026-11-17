# TRPG-LogColorizer

跑团日志着色器：导入跑团日志，自动识别角色并染色，预览后导出为论坛代码、回声工坊脚本、Word 文档等。
支持**实时日志**——骰娘跑团时一边记录一边上传，观众打开链接就能看到正在进行的团。
外观由**主题包**决定，换皮不必改代码。

基于 [sealdice/story-painter](https://github.com/sealdice/story-painter) 及
[DiceZone/Dice-Next-log-renderer](https://github.com/DiceZone/Dice-Next-log-renderer) 重写界面而来，
日志解析、染色与导出的核心代码保持原样，方便继续合入上游的更新。

## 功能

- 多种日志格式：海豹（JSON / Parquet）、Dice!Next、Dice! 与塔骰原始文件、QQ 导出、SinaNya、DiceKokona、FVTT、已染色文本
- 在线编辑与自动染色，角色改名、改色、隐藏、删除
- 预览，以及论坛代码、论坛代码（多行）、回声工坊三种格式的一键复制
- 聊天视图：像 QQ 群聊一样显示头像与气泡，看实时日志最合适
- QQ 账号显示 QQ 头像，其他账号显示名字首字；也可以上传自己的头像（只存在本地浏览器）
- 同一个人换了账号，可以把两个账号关联成一个角色
- 导出原始文件、带图 doc、对话 doc、docx
- 实时日志：自动接收新消息，修改与撤回同步，可关闭自动滚动
- 主题：部署者用环境变量指定，换皮不改代码

## 实时日志

链接指向一份进行中的实时日志时（日志后端的 `load_data` 回传 `live: true`），页面会自动切到聊天视图并开始接收新消息。
优先用服务器推送（SSE）；经过 CDN 时推送可能被缓冲，页面会察觉并自动改为每 2.5 秒拉取一次。
需要配合支持实时日志的后端，例如 [Dice-Next-log-backend](https://github.com/DiceZone/Dice-Next-log-backend)。

## 主题

主题只含清单、样式与素材，不含脚本。部署者把主题目录放进站点，用环境变量 `LOG_THEME` 指定用哪一个；访客不能更换。
做主题请看 [docs/THEME.md](docs/THEME.md)。

## 部署

构建产物是纯静态网站，放在任何静态托管上都能用。Docker 只是另一种选择，不是必需的。

### 静态托管（EdgeOne Pages、Cloudflare Pages、GitHub Pages、对象存储……）

构建命令 `pnpm build`，输出目录 `dist`。Node.js 选 24（24.18.0 以上，EdgeOne Pages 目前提供的就是这条版本线）或 26（26.12.1 以上）。

配置用环境变量，在托管平台的项目设置里填，**改了之后重新部署一次生效**：

| 变量 | 说明 |
|---|---|
| `LOG_API_BASE` | 日志后端的读取接口，默认 `https://log-api.dice.zone/api/dice` |
| `LOG_LIVE_API_BASE` | 实时日志接口，默认由上一项推出（`…/api/v2`） |
| `RKEY_API_BASE` | RKey 获取接口（还原部分平台的图片链接） |
| `LOG_THEME` | 站点使用的主题，填主题的目录名，默认 `default` |
| `LOG_SOURCE_URL` | 页眉 GitHub 图标指向的源码地址，设为 `none` 不显示 |

不想用平台的环境变量，也可以写在仓库的 `.env.production` 里（格式见 `.env.example`）。

自己的主题放进 `public/themes/<id>/` 提交上去，下次部署就出现在主题列表里。

### Docker

适合自己有服务器、想**不重新构建就换主题或换接口地址**的情况：

```bash
docker compose up -d --build
```

上面那几个变量改写在 `docker-compose.yml` 里，重启容器即生效。自己的主题放进 `docker-compose.yml` 旁边的 `themes/<id>/`，同样重启即可。

## 开发

需要 Node.js 24（24.18.0 以上）或 26（26.12.1 以上）；更旧的版本构建前会被拦下。

```bash
pnpm dev          # 开发
pnpm test         # 测试
pnpm build        # 构建（含类型检查）
pnpm theme:pack public/themes/parchment   # 把主题目录打成 zip，方便分享给别的站长
```

代码结构：

| 目录 | 内容 |
|---|---|
| `src/logManager/` `src/utils/` `src/components/` | 日志解析、染色、导出与预览，沿用上游，尽量不改 |
| `src/workspace/` | 把上面这些组织起来：载入、编辑、预览、导出、实时日志 |
| `src/live/` | 实时日志的连接（推送与拉取） |
| `src/chat/` | 聊天视图 |
| `src/theme/` | 主题的清单格式、载入与切换 |
| `src/shell/` `src/sections/` | 页面骨架与各个区块 |
| `src/styles/` | 设计变量（`tokens.css`）与基础样式（`base.css`） |
| `public/themes/` | 随站点部署的主题 |

## 许可

MIT，保留上游的版权声明，见 [LICENSE](LICENSE)。

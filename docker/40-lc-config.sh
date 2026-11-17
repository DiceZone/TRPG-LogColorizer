#!/bin/sh
# 容器启动时执行（nginx 镜像会依次运行 /docker-entrypoint.d/ 里的脚本）。
#  1. 按环境变量生成 config.js —— 换主题、换接口地址不需要重新构建。
#  2. 把挂进 /themes 的主题接入站点。
set -eu

HTML=${LC_HTML_ROOT:-/usr/share/nginx/html}

# 只留下网址与主题名会用到的字符，引号、换行之类一律去掉，免得跳出 JS 字符串。
safe() {
  printf '%s' "$1" | tr -cd 'A-Za-z0-9._~:/?#&=%+@-'
}

{
  printf 'window.__LC_CONFIG__ = {\n'
  [ -n "${LOG_API_BASE:-}" ] && printf '  apiBase: "%s",\n' "$(safe "$LOG_API_BASE")"
  [ -n "${LOG_LIVE_API_BASE:-}" ] && printf '  liveApiBase: "%s",\n' "$(safe "$LOG_LIVE_API_BASE")"
  [ -n "${RKEY_API_BASE:-}" ] && printf '  rkeyApiBase: "%s",\n' "$(safe "$RKEY_API_BASE")"
  [ -n "${LOG_THEME:-}" ] && printf '  theme: "%s",\n' "$(safe "$LOG_THEME")"
  [ -n "${LOG_SOURCE_URL:-}" ] && printf '  sourceUrl: "%s",\n' "$(safe "$LOG_SOURCE_URL")"
  printf '};\n'
} > "$HTML/config.js"

# 挂进来的主题：/themes/<id>/theme.json。与内置主题同名时以挂进来的为准。
THEMES=${LC_THEMES_DIR:-/themes}
if [ -d "$THEMES" ]; then
  for dir in "$THEMES"/*/; do
    [ -f "${dir}theme.json" ] || continue
    id=$(basename "$dir")
    rm -rf "$HTML/themes/$id"
    ln -s "${dir%/}" "$HTML/themes/$id"
  done
fi

theme=${LOG_THEME:-default}
if [ -f "$HTML/themes/$theme/theme.json" ]; then
  echo "TRPG-LogColorizer: theme=$theme"
else
  echo "TRPG-LogColorizer: 找不到主题 $theme（themes/$theme/theme.json），页面会退回 default" >&2
fi

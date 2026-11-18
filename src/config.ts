// 站点配置。两处来源，后者优先：
//   1. 构建时的环境变量（.env.production 里的 LOG_* / RKEY_*）
//   2. 运行时的 config.js（window.__LC_CONFIG__）——容器启动时由环境变量生成，
//      换主题或换接口地址不需要重新构建。

interface RuntimeConfig {
  apiBase?: string;
  liveApiBase?: string;
  rkeyApiBase?: string;
  theme?: string;
  sourceUrl?: string;
}

declare global {
  interface Window {
    __LC_CONFIG__?: RuntimeConfig;
  }
}

const runtime: RuntimeConfig = (typeof window !== 'undefined' && window.__LC_CONFIG__) || {};
const env = import.meta.env;

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

const DEFAULT_SOURCE_URL = 'https://github.com/DiceZone/TRPG-LogColorizer';

function sourceUrl(value: string | undefined): string {
  if (value === undefined || value === '') return DEFAULT_SOURCE_URL;
  return /^https?:\/\//i.test(value) ? value : '';
}

const apiBase = trimSlash(runtime.apiBase || env.LOG_API_BASE || 'https://log-api.dice.zone/api/dice');
const liveApiBase = trimSlash(runtime.liveApiBase || env.LOG_LIVE_API_BASE || apiBase.replace(/\/api\/dice$/, '/api/v2'));

export const config = {
  /** 日志读取接口（…/api/dice）。 */
  apiBase,
  /** 实时日志接口（…/api/v2）。没有单独指定时由读取接口的地址推出。 */
  liveApiBase,
  /** QQ 图片 rkey 接口：补到新版 QQ 图床的图片链接上，图片才打得开。默认由日志后端提供（…/api/v2/rkey）。 */
  rkeyApiBase: trimSlash(runtime.rkeyApiBase || env.RKEY_API_BASE || `${liveApiBase}/rkey`),
  /** 站点使用的主题（themes/ 下的目录名），由部署者指定。 */
  theme: runtime.theme || env.LOG_THEME || 'default',
  /** 页眉 GitHub 图标指向的源码地址；为空时不显示。 */
  sourceUrl: sourceUrl(runtime.sourceUrl ?? env.LOG_SOURCE_URL),
  /** 构建日期，作为版本号显示。 */
  version: __BUILD_DATE__,
};

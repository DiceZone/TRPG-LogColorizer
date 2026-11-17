// 主题的来源：随站点部署的 themes/<id>/ 目录。用哪一个由部署者用环境变量 LOG_THEME 指定。
import { LoadedTheme, parseManifest } from './types';
import { rewriteCss } from './css';

const BASE = import.meta.env.BASE_URL;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`读取 ${url} 失败（HTTP ${response.status}）`);
  return response.json();
}

export async function loadTheme(id: string): Promise<LoadedTheme> {
  const root = `${BASE}themes/${id}/`;
  const manifest = parseManifest(await fetchJson(`${root}theme.json`));
  if (manifest.id !== id) throw new Error(`themes/${id} 里的清单写的 id 是 ${manifest.id}，目录名须与 id 相同`);
  const resolve = (path: string) => root + path.replace(/^\.?\//, '');
  const parts: string[] = [];
  for (const file of manifest.styles ?? ['theme.css']) {
    const response = await fetch(resolve(file), { cache: 'no-cache' });
    if (response.ok) parts.push(rewriteCss(await response.text(), resolve));
    else if (manifest.styles) console.warn(`主题 ${id} 的样式 ${file} 读取失败`);
  }
  return { manifest, css: parts.join('\n'), resolve };
}

// 主题样式里的地址处理。

/**
 * 把样式里相对主题目录的地址（url(assets/bg.png)）换成站点上的实际地址。
 * 外部地址与内嵌数据原样保留：主题由部署者自己放进站点，可以用网络字体或 CDN 上的图片。
 */
export function rewriteCss(css: string, resolve: (path: string) => string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (_whole, _quote, raw: string) => {
    const target = raw.trim();
    if (!target || target.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(target)) {
      return `url("${target}")`;
    }
    return `url("${resolve(target.replace(/^\.\//, ''))}")`;
  });
}

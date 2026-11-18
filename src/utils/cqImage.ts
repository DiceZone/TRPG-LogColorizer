// CQ 参数与 HTML 是两层转义：预览先还原 HTML，再还原 CQ，最后安全写入 src 属性。
export function decodeCqParameter(value: string): string {
  return value.replaceAll('&#44;', ',').replaceAll('&#91;', '[')
    .replaceAll('&#93;', ']').replaceAll('&amp;', '&');
}

/** 日志里的图片地址可能带着 HTML / CQ 转义；赋给 img.src 之前要还原成真正的 URL。 */
export function unescapeImageUrl(value: string): string {
  return decodeCqParameter(
    value.replaceAll('&quot;', '"').replaceAll('&#39;', "'")
      .replaceAll('&lt;', '<').replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&'),
  );
}

export function encodeCqParameter(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('[', '&#91;')
    .replaceAll(']', '&#93;').replaceAll(',', '&#44;');
}

export const LOG_IMAGE_CLASS = 'lc-log-img';

/** 预览用的 <img>。class / alt / data-src 都是固定的，地址只进 src 与 data-src。 */
export function logImageHtml(escapedSrc: string, extra = ''): string {
  return `<img class="${LOG_IMAGE_CLASS}" style="max-width: 300px" src="${escapedSrc}" alt="" data-src="${escapedSrc}"${extra} />`;
}

export function cqImageHtml(htmlEncodedUrl: string): string {
  const url = unescapeImageUrl(htmlEncodedUrl);
  if (!/^https?:\/\//.test(url) || /[\u0000-\u0020\u007f]/.test(url)) return '[图片]';
  const attribute = url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return logImageHtml(attribute);
}

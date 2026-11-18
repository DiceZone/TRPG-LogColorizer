// 日志图片的加载中 / 失败占位。HTML 由 cqImage.logImageHtml 生成，这里只负责监听结果。
import { LOG_IMAGE_CLASS } from './cqImage';
import imageFailed from '~/assets/image-failed.png';

function isLogImage(target: EventTarget | null): target is HTMLImageElement {
  return target instanceof HTMLImageElement && target.classList.contains(LOG_IMAGE_CLASS);
}

function markReady(img: HTMLImageElement) {
  if (img.dataset.lcFail === '1') return;
  img.classList.add('is-ready');
  img.classList.remove('is-failed');
}

function markFailed(img: HTMLImageElement) {
  if (img.dataset.lcFail === '1') return;
  img.dataset.lcFail = '1';
  img.classList.add('is-failed');
  img.classList.remove('is-ready');
  img.alt = '图片加载失败';
  img.src = imageFailed;
}

function hydrate(img: HTMLImageElement) {
  if (!img.classList.contains(LOG_IMAGE_CLASS) || img.dataset.lcBound === '1') return;
  img.dataset.lcBound = '1';
  if (img.dataset.lcFail === '1') {
    img.classList.add('is-failed');
    return;
  }
  if (!img.getAttribute('src') || !img.complete) return;
  if (img.naturalWidth === 0) markFailed(img);
  else markReady(img);
}

function hydrateTree(root: ParentNode) {
  if (root instanceof HTMLImageElement) hydrate(root);
  else root.querySelectorAll(`img.${LOG_IMAGE_CLASS}`).forEach((node) => hydrate(node as HTMLImageElement));
}

/** 捕获阶段监听 load/error；对已经缓存完的图片再扫一遍。 */
export function installLogImagePlaceholders(root: ParentNode = document) {
  root.addEventListener('error', (event) => {
    if (isLogImage(event.target)) markFailed(event.target);
  }, true);
  root.addEventListener('load', (event) => {
    if (isLogImage(event.target)) markReady(event.target);
  }, true);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLImageElement) hydrate(node);
        else if (node instanceof Element) hydrateTree(node);
      }
    }
  });
  observer.observe(root instanceof Document ? root.body ?? root.documentElement : root, {
    childList: true,
    subtree: true,
  });
  hydrateTree(root instanceof Document ? root.body ?? root.documentElement : root);
}

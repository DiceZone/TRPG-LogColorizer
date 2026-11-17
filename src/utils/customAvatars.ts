// 访客自己上传的头像。只存在这个浏览器里（localStorage），不会上传到任何地方。
// 以账号为键：同一个账号在别的日志里出现时也用这张头像。
// 裁剪由访客在 AvatarCropper 里自己框选，这里只负责读图与保存。
import { reactive } from 'vue';

const KEY = 'lc-avatars';
/** 保存的头像边长。 */
export const AVATAR_SIZE = 128;

function load(): Record<string, string> {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export const customAvatars = reactive<Record<string, string>>(load());

/** 读入访客选的图片，供裁剪框显示。用完须调用 URL.revokeObjectURL(image.src)。 */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('请选择图片文件。'));
  if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error('图片不能超过 20MB。'));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(image.src);
      reject(new Error('这张图片读不出来，换一张试试。'));
    };
    image.src = URL.createObjectURL(file);
  });
}

/** 保存裁好的头像（data: 地址）。本地存储满了时还原并报错。 */
export function saveCustomAvatar(imUserId: string, dataUrl: string) {
  const previous = customAvatars[imUserId];
  customAvatars[imUserId] = dataUrl;
  try {
    localStorage.setItem(KEY, JSON.stringify(customAvatars));
  } catch {
    if (previous) customAvatars[imUserId] = previous;
    else delete customAvatars[imUserId];
    throw new Error('浏览器的本地存储已满，头像没能保存。');
  }
}

export function removeCustomAvatar(imUserId: string) {
  delete customAvatars[imUserId];
  try {
    localStorage.setItem(KEY, JSON.stringify(customAvatars));
  } catch {
    // 删除只会让存储变小，不会写不进去；万一失败，页面上已经移除，下次载入前不受影响。
  }
}

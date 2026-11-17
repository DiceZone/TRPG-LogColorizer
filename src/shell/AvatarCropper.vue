<!--
  头像裁剪：访客拖动图片、缩放（滑杆、滚轮或双指），自己框出要用的部分。
  框是正方形，圆形的虚线只是提示头像显示出来的样子。
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useTheme } from '~/theme/useTheme';
import { AVATAR_SIZE } from '~/utils/customAvatars';

const props = defineProps<{
  /** 要裁的图片；为空时对话框关闭。 */
  image: HTMLImageElement | null;
}>();
const emit = defineEmits<{ done: [dataUrl: string]; cancel: [] }>();

const theme = useTheme();

/** 取景框的边长（像素）。 */
const VIEW = 260;
/** 最多放大到刚好铺满时的几倍。 */
const MAX_ZOOM = 6;

const state = reactive({ x: 0, y: 0, scale: 1 });
const minScale = computed(() => (props.image ? VIEW / Math.min(props.image.naturalWidth, props.image.naturalHeight) : 1));
/** 滑杆上的缩放倍数：1 为刚好铺满取景框。 */
const zoom = computed({
  get: () => state.scale / minScale.value,
  set: (value: number) => zoomAt(value * minScale.value, VIEW / 2, VIEW / 2),
});

function clamp() {
  const image = props.image;
  if (!image) return;
  const w = image.naturalWidth * state.scale;
  const h = image.naturalHeight * state.scale;
  state.x = Math.min(0, Math.max(VIEW - w, state.x));
  state.y = Math.min(0, Math.max(VIEW - h, state.y));
}

/** 以取景框里的 (px, py) 为中心缩放，那一点在图上的位置保持不动。 */
function zoomAt(scale: number, px: number, py: number) {
  const next = Math.min(minScale.value * MAX_ZOOM, Math.max(minScale.value, scale));
  const ratio = next / state.scale;
  state.x = px - (px - state.x) * ratio;
  state.y = py - (py - state.y) * ratio;
  state.scale = next;
  clamp();
}

// 换了图片：缩到刚好铺满，居中。
watch(() => props.image, (image) => {
  if (!image) return;
  state.scale = minScale.value;
  state.x = (VIEW - image.naturalWidth * state.scale) / 2;
  state.y = (VIEW - image.naturalHeight * state.scale) / 2;
}, { immediate: true });

// ─── 拖动与双指缩放 ─────────────────────────────────────────
const pointers = new Map<number, { x: number; y: number }>();
let pinch = 0;
const frame = ref<HTMLElement | null>(null);

const local = (event: PointerEvent | WheelEvent) => {
  const rect = frame.value!.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};
const spread = () => {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const onDown = (event: PointerEvent) => {
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, local(event));
  if (pointers.size === 2) pinch = spread();
};
const onMove = (event: PointerEvent) => {
  const last = pointers.get(event.pointerId);
  if (!last) return;
  const now = local(event);
  pointers.set(event.pointerId, now);
  if (pointers.size === 1) {
    state.x += now.x - last.x;
    state.y += now.y - last.y;
    clamp();
  } else if (pointers.size === 2 && pinch > 0) {
    const [a, b] = [...pointers.values()];
    const distance = spread();
    zoomAt(state.scale * (distance / pinch), (a.x + b.x) / 2, (a.y + b.y) / 2);
    pinch = distance;
  }
};
const onUp = (event: PointerEvent) => {
  pointers.delete(event.pointerId);
  pinch = pointers.size === 2 ? spread() : 0;
};
const onWheel = (event: WheelEvent) => {
  const at = local(event);
  zoomAt(state.scale * Math.exp(-event.deltaY * 0.0015), at.x, at.y);
};

// ─── 输出 ───────────────────────────────────────────────────
const confirm = () => {
  const image = props.image;
  if (!image) return;
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  const side = VIEW / state.scale;
  ctx.drawImage(image, -state.x / state.scale, -state.y / state.scale, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  emit('done', canvas.toDataURL('image/webp', 0.9));
};

const show = computed({
  get: () => Boolean(props.image),
  set: (value: boolean) => { if (!value) emit('cancel'); },
});

onBeforeUnmount(() => pointers.clear());
</script>

<template>
  <n-modal v-model:show="show" preset="card" class="lc-cropper" :style="{ width: 'min(22rem, calc(100vw - 32px))' }"
    :title="theme.t('cropper.title')" :bordered="false">
    <p class="lc-cropper__hint">{{ theme.t('cropper.hint') }}</p>
    <div ref="frame" class="lc-cropper__frame" :style="{ width: `${VIEW}px`, height: `${VIEW}px` }"
      @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @wheel.prevent="onWheel">
      <img v-if="image" :src="image.src" alt="" draggable="false"
        :style="{ width: `${image.naturalWidth}px`, transform: `translate(${state.x}px, ${state.y}px) scale(${state.scale})` }" />
      <span class="lc-cropper__ring" aria-hidden="true"></span>
    </div>
    <div class="lc-cropper__zoom">
      <span aria-hidden="true">−</span>
      <n-slider v-model:value="zoom" :min="1" :max="MAX_ZOOM" :step="0.01" :tooltip="false"
        :aria-label="theme.t('cropper.zoom')" />
      <span aria-hidden="true">+</span>
    </div>
    <template #footer>
      <div class="lc-cropper__actions">
        <button class="lc-btn" type="button" @click="emit('cancel')">{{ theme.t('cropper.cancel') }}</button>
        <button class="lc-btn lc-btn--primary" type="button" @click="confirm">{{ theme.t('cropper.confirm') }}</button>
      </div>
    </template>
  </n-modal>
</template>

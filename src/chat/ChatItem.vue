<!--
  聊天视图里的一条消息：头像、名字、账号与时间、气泡。
  同一个人连续发言时只在第一条显示头像与名字；骰娘的消息靠右，像群聊里「自己」发的；
  换了一天时，上方插一条居中的日期。
  指针移到消息上时，气泡右下角浮出「编辑」「删除」，效果等同于在编辑器里改那一段。
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { Checkmark, Close, Edit, TrashCan } from '@vicons/carbon';
import { useTheme } from '~/theme/useTheme';
import { useWorkspace } from '~/workspace/useWorkspace';
import { chatEdit, endChatEdit } from './chatEdit';
import CharAvatar from '~/shell/CharAvatar.vue';
import { LogItem } from '~/logManager/types';
import { useStore } from '~/store';
import {
  escapeHTML, msgAtFormat, msgCommandFormat, msgImageFormat, msgIMUseridFormat, msgOffTopicFormat,
} from '~/utils';
import { stripQQOfficialFaces } from '~/utils/qqOfficialFace';
import { useRichText } from './useRichText';

const props = defineProps<{
  source: LogItem;
  index: number;
  items: LogItem[];
}>();

const store = useStore();
const theme = useTheme();
const ws = useWorkspace();

/** 同一个人、五分钟之内的连续发言并成一组。 */
const GROUP_SECONDS = 5 * 60;
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const pc = computed(() => store.resolvePc(props.source));
const color = computed(() => pc.value?.color);
const role = computed(() => pc.value?.role);
const isDice = computed(() => props.source.isDice || role.value === '骰子');

const hasTime = (item?: LogItem) => typeof item?.time === 'number' && item.time > 0;
const dayOf = (item?: LogItem) => (item && hasTime(item) ? dayjs.unix(item.time).format('YYYY/MM/DD') : '');

const prev = computed<LogItem | undefined>(() => props.items[props.index - 1]);

/** 与上一条不在同一天（或是第一条）时显示日期。 */
const dateLabel = computed(() => {
  const day = dayOf(props.source);
  if (!day || day === dayOf(prev.value)) return '';
  return `${day} ${WEEKDAYS[dayjs.unix(props.source.time).day()]}`;
});

const continued = computed(() => {
  const p = prev.value;
  if (!p || dateLabel.value) return false;
  const sameSpeaker = p.nickname === props.source.nickname && p.IMUserId === props.source.IMUserId;
  const close = hasTime(p) && hasTime(props.source)
    && props.source.time - p.time < GROUP_SECONDS && props.source.time >= p.time;
  return sameSpeaker && close;
});

const time = computed(() => {
  const options = store.exportOptions;
  if (options.timeHide) return '';
  const item = props.source;
  if (hasTime(item)) return dayjs.unix(item.time).format('HH:mm:ss');
  return item.timeText ?? '';
});

const rich = useRichText();

/** CQ 码等标记：图片照常显示，其他不认识的码去掉。 */
const renderCode = (code: string) => msgImageFormat(escapeHTML(code), store.exportOptions, true)
  .replace(/\[CQ:(?!image|at).+?,[^\]]+\]/g, '')
  .replace(/\[mirai:(?!image).+?:[^\]]+\]/g, '');

/**
 * 消息按 Markdown 显示，公式用 KaTeX 排版。
 * 不只骰娘：群里另一个骰娘（如 QQ 官方机器人）在日志里常被记成普通成员，同样会发 Markdown。
 */
const richHtml = computed(() => {
  const render = rich.value;
  if (!render) return null;
  const options = store.exportOptions;
  let raw = props.source.message;
  if (isDice.value) {
    for (const p of store.pcList) raw = raw.replaceAll(`<${p.name}>`, p.name);
  } else {
    raw = msgOffTopicFormat(raw, options, false);
  }
  if (options.imageHide) raw = stripQQOfficialFaces(raw);
  raw = msgCommandFormat(raw, options);
  raw = msgAtFormat(raw, store.pcList);
  // Discord 与 KOOK 的 @ 要在转义之后才认得出来。
  return msgAtFormat(render(raw.trim(), renderCode), store.pcList);
});

const html = computed(() => {
  if (richHtml.value !== null) return richHtml.value;
  const item = props.source;
  const options = store.exportOptions;
  let msg = msgImageFormat(escapeHTML(item.message), options, true);
  msg = msgAtFormat(msg, store.pcList);
  msg = msgOffTopicFormat(msg, options, item.isDice);
  msg = msgCommandFormat(msg, options);
  msg = msgIMUseridFormat(msg, options, item.isDice);
  msg = msgOffTopicFormat(msg, options, item.isDice);
  if (isDice.value) {
    for (const p of store.pcList) msg = msg.replaceAll(`&lt;${p.name}&gt;`, p.name);
  }
  return msg.trim().replaceAll('<br />', '\n').replaceAll('\n', '<br />');
});

// ─── 编辑与删除 ─────────────────────────────────────────────
const editing = computed(() => chatEdit.index >= 0 && chatEdit.index === props.source.index);
const editBox = ref<HTMLElement | null>(null);
const textarea = ref<HTMLTextAreaElement | null>(null);

const startEdit = async () => {
  // 另一条正在编辑：那边会先问要不要保存，这里不抢。
  if (chatEdit.index >= 0) return;
  chatEdit.index = props.source.index ?? -1;
  chatEdit.original = ws.rawMessageOf(props.source);
  chatEdit.draft = chatEdit.original;
  await nextTick();
  textarea.value?.focus();
  textarea.value?.setSelectionRange(chatEdit.draft.length, chatEdit.draft.length);
};

const save = () => {
  if (chatEdit.draft !== chatEdit.original) ws.editMessage(props.source, chatEdit.draft);
  endChatEdit();
};

const cancel = () => endChatEdit();

const remove = () => ws.deleteMessage(props.source);

// 点到编辑框外面：没改过就直接收起，改过了就问保存还是放弃。
const onPointerDown = (event: PointerEvent) => {
  if (!editing.value || chatEdit.asking) return;
  const target = event.target as Node | null;
  if (target && editBox.value?.contains(target)) return;
  if (chatEdit.draft === chatEdit.original) {
    cancel();
    return;
  }
  chatEdit.asking = true;
  ws.askSaveDraft(save, cancel, () => {
    chatEdit.asking = false;
    nextTick(() => textarea.value?.focus());
  });
};

watch(editing, (on) => {
  if (on) document.addEventListener('pointerdown', onPointerDown, true);
  else document.removeEventListener('pointerdown', onPointerDown, true);
}, { immediate: true });
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true));

/** 编辑框按内容的行数长高（浏览器不支持 field-sizing 时用）。 */
const rows = computed(() => Math.min(14, Math.max(3, chatEdit.draft.split('\n').length + 1)));
</script>

<template>
  <div class="lc-msg-row">
    <div v-if="dateLabel" class="lc-chat__date"><span>{{ dateLabel }}</span></div>
    <div class="lc-msg" :class="{ 'is-continued': continued, 'is-dice': isDice, 'is-host': role === '主持人', 'is-editing': editing }"
      :style="{ '--lc-char-color': color }">
      <CharAvatar v-if="!continued" class="lc-msg__avatar" :id="source.IMUserId" :name="source.nickname" :color="color" />
      <span v-else class="lc-msg__gutter">{{ time.slice(0, 5) }}</span>
      <div class="lc-msg__body">
        <div v-if="!continued" class="lc-msg__meta">
          <span class="lc-msg__name">{{ source.nickname }}</span>
          <!-- 账号跟着「平台帐号隐藏」选项走。 -->
          <span v-if="source.IMUserId && !store.exportOptions.userIdHide" class="lc-msg__id">({{ source.IMUserId }})</span>
          <span v-if="role === '主持人'" class="lc-msg__badge">主持人</span>
          <span v-if="time" class="lc-msg__time">{{ time }}</span>
        </div>
        <div v-if="editing" ref="editBox" class="lc-msg__edit">
          <textarea ref="textarea" v-model="chatEdit.draft" class="lc-msg__textarea" :rows="rows" spellcheck="false"
            :aria-label="theme.t('chat.edit')" @keydown.esc.prevent="cancel" @keydown.ctrl.enter.prevent="save"
            @keydown.meta.enter.prevent="save"></textarea>
          <div class="lc-msg__edit-actions">
            <button type="button" :title="theme.t('chat.cancel')" :aria-label="theme.t('chat.cancel')" @click="cancel">
              <Close aria-hidden="true" />
            </button>
            <button type="button" class="is-primary" :title="theme.t('chat.save')" :aria-label="theme.t('chat.save')"
              @click="save">
              <Checkmark aria-hidden="true" />
            </button>
          </div>
        </div>
        <div v-else class="lc-msg__bubble-wrap">
          <div class="lc-msg__bubble" :class="{ 'lc-rich': richHtml !== null }" v-html="html"></div>
          <div class="lc-msg__tools">
            <button type="button" :title="theme.t('chat.edit')" :aria-label="theme.t('chat.edit')" @click="startEdit">
              <Edit aria-hidden="true" />
            </button>
            <button type="button" class="is-danger" :title="theme.t('chat.delete')" :aria-label="theme.t('chat.delete')"
              @click="remove">
              <TrashCan aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

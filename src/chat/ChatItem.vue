<!--
  聊天视图里的一条消息：头像、名字、账号与时间、气泡。
  同一个人连续发言时只在第一条显示头像与名字；骰娘的消息靠右，像群聊里「自己」发的；
  换了一天时，上方插一条居中的日期。
-->
<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
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
</script>

<template>
  <div class="lc-msg-row">
    <div v-if="dateLabel" class="lc-chat__date"><span>{{ dateLabel }}</span></div>
    <div class="lc-msg" :class="{ 'is-continued': continued, 'is-dice': isDice, 'is-host': role === '主持人' }"
      :style="{ '--lc-char-color': color }">
      <CharAvatar v-if="!continued" class="lc-msg__avatar" :id="source.IMUserId" :name="source.nickname" :color="color" />
      <span v-else class="lc-msg__gutter">{{ time.slice(0, 5) }}</span>
      <div class="lc-msg__body">
        <div v-if="!continued" class="lc-msg__meta">
          <span class="lc-msg__name">{{ source.nickname }}</span>
          <span v-if="source.IMUserId" class="lc-msg__id">({{ source.IMUserId }})</span>
          <span v-if="role === '主持人'" class="lc-msg__badge">主持人</span>
          <span v-if="time" class="lc-msg__time">{{ time }}</span>
        </div>
        <div class="lc-msg__bubble" :class="{ 'lc-rich': richHtml !== null }" v-html="html"></div>
      </div>
    </div>
  </div>
</template>

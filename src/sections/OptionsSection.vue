<script setup lang="ts">
import SectionCard from './SectionCard.vue';
import { useStore } from '~/store';
import { useTheme } from '~/theme/useTheme';

const theme = useTheme();
const options = useStore().exportOptions;

interface Option {
  label: string;
  desc: string;
  key: keyof typeof options;
}

const list: Option[] = [
  { label: '骰子指令过滤', desc: '开启后，不显示pc指令，正常显示指令结果', key: 'commandHide' },
  { label: '表情图片过滤', desc: '开启后，文本内所有的表情包和图片将不显示', key: 'imageHide' },
  { label: '场外发言过滤', desc: '开启后，所有以(和（为开头的发言将被过滤不显示', key: 'offTopicHide' },
  { label: '公式过滤', desc: '开启后，消息中的 LaTeX 公式只保留文字，不显示颜色、字号与方框', key: 'mathHide' },
  { label: '时间显示过滤', desc: '开启后，日期和时间将不显示', key: 'timeHide' },
  { label: '平台帐号隐藏', desc: '开启后，IM 平台账号（如 QQ 号）将在导出结果中不显示', key: 'userIdHide' },
  { label: '年月日不展示', desc: '开启后，导出结果的日期将只显示几点几分(如果可能)', key: 'yearHide' },
  { label: '首行缩进对齐', desc: '开启后，缩进将以名字为基准进行对齐', key: 'textIndentAll' },
];
</script>

<template>
  <SectionCard id="options" :title="theme.t('options.title')" :desc="theme.t('options.desc')" collapsible>
    <div class="lc-options">
      <label v-for="opt in list" :key="opt.key" class="lc-option">
        <span class="lc-option__text">
          <span class="lc-option__label">{{ opt.label }}</span>
          <span class="lc-option__desc">{{ opt.desc }}</span>
        </span>
        <n-switch v-model:value="options[opt.key]" size="small" />
      </label>
    </div>
  </SectionCard>
</template>

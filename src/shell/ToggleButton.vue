<!-- 开关按钮：按下即开启，再按一次关闭。用来代替勾选框。busy 时显示处理中，暂时不能再按。 -->
<script setup lang="ts">
import { Checkmark } from '@vicons/carbon';

defineProps<{
  modelValue: boolean;
  label: string;
  title?: string;
  busy?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <button class="lc-toggle" type="button" :aria-pressed="modelValue" :aria-busy="busy || undefined"
    :class="{ 'is-on': modelValue, 'is-busy': busy }" :title="title" :disabled="disabled || busy"
    @click="emit('update:modelValue', !modelValue)">
    <span v-if="busy" class="lc-toggle__spinner" aria-hidden="true"></span>
    <Checkmark v-else class="lc-toggle__mark" aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
</template>

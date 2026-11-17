<!-- 开关按钮：按下即开启，再按一次关闭。用来代替勾选框。 -->
<script setup lang="ts">
import { Checkmark } from '@vicons/carbon';

defineProps<{
  modelValue: boolean;
  label: string;
  title?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <button class="lc-toggle" type="button" :aria-pressed="modelValue" :class="{ 'is-on': modelValue }" :title="title"
    @click="emit('update:modelValue', !modelValue)">
    <Checkmark class="lc-toggle__mark" aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
</template>

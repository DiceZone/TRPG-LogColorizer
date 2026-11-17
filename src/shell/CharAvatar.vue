<!--
  角色头像，依次取：访客上传的（只存在本地）→ QQ 头像（真实的 QQ 号）→ 名字首字配角色颜色。
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { avatarInitial, avatarUrl } from '~/utils/avatar';
import { customAvatars } from '~/utils/customAvatars';

const props = defineProps<{
  id?: string;
  name?: string;
  color?: string;
  size?: number;
}>();

const failed = ref(false);
const src = computed(() => (props.id && customAvatars[props.id]) || avatarUrl(props.id));
watch(src, () => { failed.value = false; });
</script>

<template>
  <span class="lc-avatar" :style="{ '--lc-avatar-color': color, '--lc-avatar-size': size ? `${size}px` : undefined }"
    aria-hidden="true">
    <img v-if="src && !failed" :src="src" alt="" loading="lazy" referrerpolicy="no-referrer" @error="failed = true" />
    <span v-else class="lc-avatar__initial">{{ avatarInitial(name) }}</span>
  </span>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { darkTheme, lightTheme } from 'naive-ui';
import AppShell from '~/shell/AppShell.vue';
import { useTheme } from '~/theme/useTheme';

const theme = useTheme();

onMounted(() => {
  theme.init();
});
</script>

<template>
  <n-config-provider :theme="theme.isDark.value ? darkTheme : lightTheme" :theme-overrides="theme.naiveOverrides.value">
    <n-message-provider>
      <n-modal-provider>
        <n-notification-provider>
          <AppShell />
        </n-notification-provider>
      </n-modal-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import SectionCard from './SectionCard.vue';
import { useTheme } from '~/theme/useTheme';
import { useWorkspace } from '~/workspace/useWorkspace';

const theme = useTheme();
const ws = useWorkspace();
</script>

<template>
  <SectionCard id="export" :title="theme.t('export.title')" :desc="theme.t('export.desc')" collapsible>
    <div class="lc-export">
      <button class="lc-btn lc-btn--primary" type="button" @click="ws.exportRecordRaw()">{{ theme.t('export.raw') }}</button>
      <button class="lc-btn" type="button" @click="ws.exportRecordDOC()">{{ theme.t('export.doc') }}</button>
      <button class="lc-btn" type="button" @click="ws.exportRecordTalkDOC()">{{ theme.t('export.talkDoc') }}</button>
      <button class="lc-btn" type="button" @click="ws.exportRecordDocx()">{{ theme.t('export.docx') }}</button>
    </div>
  </SectionCard>
</template>

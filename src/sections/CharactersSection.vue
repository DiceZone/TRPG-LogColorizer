<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMessage, type DropdownOption } from 'naive-ui';
import { View, ViewOff } from '@vicons/carbon';
import SectionCard from './SectionCard.vue';
import CharAvatar from '~/shell/CharAvatar.vue';
import AvatarCropper from '~/shell/AvatarCropper.vue';
import ToggleButton from '~/shell/ToggleButton.vue';
import { useTheme } from '~/theme/useTheme';
import { useWorkspace } from '~/workspace/useWorkspace';
import { CharItem, packNameId } from '~/logManager/types';
import { customAvatars, loadImageFile, removeCustomAvatar, saveCustomAvatar } from '~/utils/customAvatars';

const theme = useTheme();
const ws = useWorkspace();
const store = ws.store;
const isSample = ws.isSample;
const message = useMessage();

// ─── 自定义头像（只存在本地浏览器） ──────────────────────────
// 选图 → 访客在裁剪框里自己框选 → 保存。
const avatarInput = ref<HTMLInputElement | null>(null);
const cropping = ref<HTMLImageElement | null>(null);
let avatarFor = '';
const pickAvatar = (pc: CharItem) => {
  avatarFor = pc.IMUserId;
  avatarInput.value?.click();
};
const onAvatarFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !avatarFor) return;
  try {
    cropping.value = await loadImageFile(file);
  } catch (err) {
    message.error((err as Error).message);
  }
};
const closeCropper = () => {
  if (cropping.value) URL.revokeObjectURL(cropping.value.src);
  cropping.value = null;
};
const onCropped = (dataUrl: string) => {
  try {
    saveCustomAvatar(avatarFor, dataUrl);
  } catch (err) {
    message.error((err as Error).message);
  }
  closeCropper();
};

const roles = ['主持人', '角色', '骰子', '隐藏'].map((value) => ({ value, label: value }));

/** 这个账号并入了哪个角色；没有关联时为空。 */
const linkedTo = (pc: CharItem) => {
  const target = store.pcLinks[packNameId(pc)];
  return target ? store.pcMap.get(target) ?? null : null;
};

const linkedCount = (pc: CharItem) => store.linkedCount.get(packNameId(pc)) ?? 0;

const label = (pc: CharItem) => `${pc.name}（${pc.IMUserId}）`;

const menuFor = (pc: CharItem, index: number): DropdownOption[] => {
  const self = packNameId(pc);
  const targets = store.pcList
    .map((other, i) => ({ other, i }))
    .filter(({ other }) => packNameId(other) !== self && !store.pcLinks[packNameId(other)]);
  const items: DropdownOption[] = [];
  if (linkedTo(pc)) {
    items.push({ key: `unlink:${index}`, label: theme.t('characters.unlink') });
  } else {
    items.push({
      key: 'link',
      label: theme.t('characters.link'),
      disabled: targets.length === 0,
      children: targets.map(({ other, i }) => ({ key: `link:${index}:${i}`, label: label(other) })),
    });
  }
  items.push({ type: 'divider', key: 'd1' });
  items.push({ key: `avatar:${index}`, label: theme.t('characters.avatarUpload') });
  if (customAvatars[pc.IMUserId]) items.push({ key: `avatarRemove:${index}`, label: theme.t('characters.avatarRemove') });
  items.push({ type: 'divider', key: 'd2' });
  items.push({ key: `delete:${index}`, label: theme.t('characters.delete'), disabled: ws.locked.value });
  return items;
};

const onMenu = (key: string) => {
  const [action, a, b] = key.split(':');
  const pc = store.pcList[Number(a)];
  if (!pc) return;
  if (action === 'link') {
    const target = store.pcList[Number(b)];
    if (target) ws.linkPc(pc, target);
  } else if (action === 'unlink') {
    ws.unlinkPc(pc);
  } else if (action === 'avatar') {
    pickAvatar(pc);
  } else if (action === 'avatarRemove') {
    removeCustomAvatar(pc.IMUserId);
  } else if (action === 'delete') {
    ws.deletePc(Number(a), pc);
  }
};

/** 隐藏发言：把类型设为「隐藏」，记住原来的类型，取消隐藏时还原。角色本身不删除。 */
const roleBeforeHide = new Map<string, CharItem['role']>();
const toggleHidden = (pc: CharItem) => {
  const id = packNameId(pc);
  if (pc.role === '隐藏') {
    pc.role = roleBeforeHide.get(id) ?? '角色';
    roleBeforeHide.delete(id);
  } else {
    roleBeforeHide.set(id, pc.role);
    pc.role = '隐藏';
  }
};

const count = computed(() => store.pcList.length);
</script>

<template>
  <SectionCard id="characters" :title="theme.t('characters.title')" :desc="theme.t('characters.desc')" collapsible :open="isSample">
    <template #badge>
      <span class="lc-tag">{{ count }}</span>
    </template>

    <div class="lc-chars__toolbar">
      <!-- 有关联时亮起，再按一次清除全部关联（手动关联的也一起清）；没有关联时按下即一键关联同 ID。 -->
      <ToggleButton :model-value="ws.linkedCount.value > 0" :busy="ws.linkBusy.value"
        :disabled="ws.linkedCount.value === 0 && ws.sameIdGroups.value === 0"
        :label="ws.linkedCount.value > 0 ? theme.t('characters.linkSameIdOn', { count: ws.linkedCount.value }) : theme.t('characters.linkSameId')"
        :title="ws.linkedCount.value > 0 ? theme.t('characters.linkSameIdClearHint') : theme.t('characters.linkSameIdHint')"
        @update:model-value="(on: boolean) => (on ? ws.linkSameId() : ws.clearLinks())" />
      <button class="lc-btn lc-btn--small" type="button" :title="theme.t('characters.refreshHint')" @click="ws.refreshColors()">
        {{ theme.t('characters.refreshColors') }}
      </button>
    </div>

    <ul class="lc-chars">
      <li v-for="(pc, index) in store.pcList" :key="pc.IMUserId + '-' + index" class="lc-char"
        :class="{ 'is-linked': linkedTo(pc), 'is-hidden': pc.role === '隐藏' }"
        :style="{ '--lc-char-color': (linkedTo(pc) ?? pc).color }">
        <button class="lc-char__avatar" type="button" :title="theme.t('characters.avatarUpload')"
          :aria-label="`${pc.name}：${theme.t('characters.avatarUpload')}`" @click="pickAvatar(pc)">
          <CharAvatar :id="pc.IMUserId" :name="pc.name" :color="(linkedTo(pc) ?? pc).color" :size="40" />
          <span class="lc-char__avatar-edit" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
          </span>
        </button>

        <n-input v-model:value="pc.name" class="lc-char__name" size="small" :bordered="false"
          :placeholder="theme.t('characters.name')" :disabled="ws.locked.value"
          @focus="ws.nameFocus(pc)" @change="ws.nameChanged(pc)" />

        <button class="lc-icon-btn lc-char__eye" type="button" :aria-pressed="pc.role === '隐藏'"
          :title="pc.role === '隐藏' ? theme.t('characters.show') : theme.t('characters.hide')"
          :aria-label="`${pc.name}：${pc.role === '隐藏' ? theme.t('characters.show') : theme.t('characters.hide')}`"
          @click="toggleHidden(pc)">
          <component :is="pc.role === '隐藏' ? ViewOff : View" aria-hidden="true" />
        </button>

        <n-dropdown trigger="click" placement="bottom-end" :options="menuFor(pc, index)" @select="onMenu">
          <button class="lc-icon-btn lc-char__menu" type="button" :aria-label="`${pc.name} 的更多操作`">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        </n-dropdown>

        <div class="lc-char__meta">
          <span class="lc-char__id" :title="pc.IMUserId">{{ pc.IMUserId }}</span>
          <span v-if="linkedCount(pc)" class="lc-tag lc-tag--primary"
            :title="theme.t('characters.linkedCount', { count: linkedCount(pc) })">+{{ linkedCount(pc) }}</span>

          <template v-if="!linkedTo(pc)">
            <n-select v-model:value="pc.role" class="lc-char__role" size="small" :options="roles"
              :consistent-menu-width="false" :aria-label="theme.t('characters.role')" />
            <n-color-picker v-model:value="pc.color" class="lc-char__color" size="small" :show-alpha="false"
              :swatches="ws.colors.value" :on-update:value="(v: string) => ws.colorChanged(v, pc)" />
          </template>
        </div>

        <p v-if="linkedTo(pc)" class="lc-char__linked" :title="theme.t('characters.linkedHint', { name: linkedTo(pc)!.name })">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>{{ theme.t('characters.linkedTo', { name: linkedTo(pc)!.name }) }}</span>
          <button class="lc-link-btn" type="button" @click="ws.unlinkPc(pc)">{{ theme.t('characters.unlink') }}</button>
        </p>
      </li>
    </ul>
    <p v-if="count === 0" class="lc-empty">{{ theme.t('characters.empty') }}</p>
    <p v-else class="lc-chars__note">{{ theme.t('characters.avatarNote') }}</p>
    <input ref="avatarInput" type="file" accept="image/*" hidden @change="onAvatarFile" />
    <AvatarCropper :image="cropping" @done="onCropped" @cancel="closeCropper" />
  </SectionCard>
</template>

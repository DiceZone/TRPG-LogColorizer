// 聊天视图里正在编辑的那条消息。放在组件外：虚拟列表滚动时会回收消息组件，编辑状态不能跟着丢。
import { reactive } from 'vue';

export const chatEdit = reactive({
  /** 正在编辑的消息在预览里的序号；-1 为没有在编辑。 */
  index: -1,
  /** 编辑框里的内容（消息原文）。 */
  draft: '',
  /** 开始编辑时的原文，用来判断有没有改过。 */
  original: '',
  /** 正在询问「保存还是放弃」，这期间不再响应编辑框外的点击。 */
  asking: false,
});

export function endChatEdit() {
  chatEdit.index = -1;
  chatEdit.draft = '';
  chatEdit.original = '';
  chatEdit.asking = false;
}

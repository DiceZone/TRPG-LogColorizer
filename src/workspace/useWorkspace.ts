// 工作区：日志的载入、解析、预览、导出与实时更新。
// 界面的各个区块（角色、编辑器、导出……）都从这里取状态与操作，自己只管显示。
// 须在 Naive UI 的 message / modal / notification 容器之内的组件 setup 里创建一次，再经 provide 下发。
import {
  computed, h, inject, InjectionKey, nextTick, provide, reactive, ref, render, toRaw, watch,
} from 'vue';
import { NButton, NText, useMessage, useModal, useNotification } from 'naive-ui';
import { ViewUpdate } from '@codemirror/view';
import { debounce, shuffle } from 'lodash-es';
import { strFromU8, unzlibSync } from 'fflate';
import { decompress as zstdDecompress } from 'fzstd';
import { parquetReadObjects } from 'hyparquet';
import { asyncBufferFrom } from 'hyperparam';
import { compressors } from 'hyparquet-compressors';
import uaParser from 'ua-parser-js';
import randomColor from 'randomcolor';
import dayjs from 'dayjs';

import { useStore } from '~/store';
import { logMan } from '~/logManager/logManager';
import { TextInfo, setCharInfo } from '~/logManager/importers/_logImpoter';
import { CharItem, LogItem, packNameId } from '~/logManager/types';
import {
  applyQQImageRKeyReplacement, shouldApplyQQImageRKeyReplacement, msgAtFormat, msgCommandFormat,
  msgImageFormat, msgIMUseridFormat, msgOffTopicFormat,
} from '~/utils';
import { stripMath } from '~/utils/texMath';
import { exportFileDoc, exportFileDocx, exportFileRaw } from '~/utils/exporter';
import type { DocxExportEntry } from '~/utils/exporter';
import PreviewItem from '~/components/previews/preview-main-item.vue';
import PreviewTableTR from '~/components/previews/preview-table-tr.vue';
import { LiveEvent, LiveItem, LiveSession, LiveStatus } from '~/live/liveSession';
import { useTheme } from '~/theme/useTheme';
import { SAMPLE_LOG } from '~/workspace/sample';

export type ViewMode = 'edit' | 'preview' | 'chat' | 'bbs' | 'bbspineapple' | 'trg';

interface RemoteRecord {
  client: 'SealDice' | 'Parquet' | 'DiceNext';
  data: string;
  name: string;
  live?: boolean;
  last_seq?: number;
}

function base64Bytes(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

function createWorkspace() {
  const store = useStore();
  const theme = useTheme();
  const message = useMessage();
  const modal = useModal();
  const notification = useNotification();

  store.colorMapLoad();

  const loading = ref(false);
  const logName = ref('');
  /** 当前是内置演示日志（地址里没有 key）。演示加载完后展开角色列表；正常日志不展开。 */
  const isSample = ref(false);
  const view = ref<ViewMode>('edit');
  const previewItems = ref<LogItem[]>([]);
  const colors = ref<string[]>(randomColor({ count: 16 }));

  // ─── 浏览器兼容性提示 ─────────────────────────────────────

  const isMobile = ref(false);
  // 0 无法下载；1 可能乱码或无法下载；2 兼容良好
  let downloadUsableRank = 1;

  (function setupUA() {
    const parser = new uaParser.UAParser();
    parser.setUA(navigator.userAgent);
    const browser = parser.getBrowser().name;
    isMobile.value = parser.getDevice().type === 'mobile';
    if (!isMobile.value) return;
    switch (browser) {
      case 'Edge': case 'Chrome': case 'Chromium': case 'Firefox': case 'MIUI Browser': case 'Opera':
        downloadUsableRank = 2;
    }
    switch (browser) {
      case 'baiduboxapp': case 'QQBrowser': case 'UCBrowser': case 'Quark': case 'QQ': case 'WeChat':
        downloadUsableRank = 0;
    }
  })();

  const browserAlert = () => {
    if (downloadUsableRank === 0) {
      message.warning('你目前所使用的浏览器无法下载文件，请更换对标准支持较好的浏览器。建议使用Chrome/Firefox/Edge');
    }
    if (downloadUsableRank === 1 && isMobile.value) {
      message.warning('你目前所使用的浏览器可能在下载文件时遇到乱码，或无法下载文件，最好更换对标准支持较好的浏览器。建议使用Chrome/Firefox/Edge');
    }
  };

  // ─── 角色 ─────────────────────────────────────────────────

  /** 刷新色板：从易读的预置颜色里重新随机分配所有角色的颜色，颜色选择器的预置色也换一组。 */
  const refreshColors = () => {
    colors.value = randomColor({ count: 16 });
    const pool = shuffle([...store.palette]);
    let next = 0;
    for (const pc of store.pcList) {
      if (store.pcLinks[packNameId(pc)]) continue;
      pc.color = pool[next % pool.length];
      next += 1;
      store.pcNameColorMap.set(pc.name, pc.color);
    }
    // 关联到别的角色的账号跟着那个角色的颜色。
    for (const pc of store.pcList) {
      const target = store.pcLinks[packNameId(pc)];
      const owner = target ? store.pcMap.get(target) : null;
      if (owner) pc.color = owner.color;
    }
    store.colorMapSave();
    message.success('已为所有角色重新分配颜色', { duration: 1200 });
  };

  const colorChanged = debounce((v: string, i: CharItem) => {
    i.color = v;
    store.pcNameColorMap.set(i.name, v);
    // 关联到这个角色的账号跟着换色，编辑器里也就一样颜色。
    const target = packNameId(i);
    for (const pc of store.pcList) {
      if (store.pcLinks[packNameId(pc)] === target) pc.color = v;
    }
    store.colorMapSave();
  }, 300);

  /** 把一个账号并入另一个角色：之后它的发言以那个角色的名字、颜色与头像显示，导出时也一样。 */
  const linkPc = (source: CharItem, target: CharItem) => {
    const from = packNameId(source);
    const to = packNameId(target);
    if (from === to) return;
    // 目标本身若关联了别人，直接并到最终的那个角色，不留链条。
    const final = store.pcLinks[to] ?? to;
    if (final === from) return;
    const links = { ...store.pcLinks, [from]: final };
    // 原本关联到 source 的账号一并转过去。
    for (const [key, value] of Object.entries(links)) if (value === from) links[key] = final;
    store.pcLinks = links;
    const finalPc = store.pcMap.get(final);
    if (finalPc) {
      for (const pc of store.pcList) if (links[packNameId(pc)] === final) pc.color = finalPc.color;
    }
    showPreview();
  };

  const unlinkPc = (source: CharItem) => {
    const links = { ...store.pcLinks };
    delete links[packNameId(source)];
    store.pcLinks = links;
    const own = store.pcNameColorMap.get(source.name);
    if (own) source.color = own;
    showPreview();
  };

  /**
   * 账号相同、名字不同的角色（换了名字、或改过群名片）各有几组。
   * 已经全部关联好的那组不算。
   */
  const sameIdGroups = computed(() => {
    const byId = new Map<string, CharItem[]>();
    for (const pc of store.pcList) {
      if (!pc.IMUserId) continue;
      byId.set(pc.IMUserId, [...(byId.get(pc.IMUserId) ?? []), pc]);
    }
    let groups = 0;
    for (const list of byId.values()) {
      if (list.length < 2) continue;
      const finals = new Set(list.map((pc) => store.pcLinks[packNameId(pc)] ?? packNameId(pc)));
      if (finals.size > 1) groups += 1;
    }
    return groups;
  });

  /**
   * 一键关联同 ID：同一个账号用过的几个名字，全部关联到角色列表里排在最上面的那个
   * （按出场顺序，通常就是它第一次发言用的名字）。人多的时候主账号就在眼前，不用往下翻。
   */
  const linkSameId = () => runLinkWork(() => {
    const first = new Map<string, CharItem>();
    for (const pc of store.pcList) {
      if (pc.IMUserId && !first.has(pc.IMUserId)) first.set(pc.IMUserId, pc);
    }
    // 一次算完、一次写回：逐个关联的话，每关联一个就要把整份预览重算一遍，日志一长就卡好几秒。
    const links = { ...store.pcLinks };
    let linked = 0;
    for (const pc of store.pcList) {
      const target = pc.IMUserId ? first.get(pc.IMUserId) : undefined;
      if (!target || target === pc) continue;
      const self = packNameId(pc);
      const to = packNameId(target);
      const final = links[to] ?? to;
      if (final === self || (links[self] ?? self) === final) continue;
      links[self] = final;
      // 原本关联到它的账号一并转过去，不留链条
      for (const [key, value] of Object.entries(links)) if (value === self) links[key] = final;
      linked += 1;
    }
    if (!linked) {
      message.info('没有需要关联的同 ID 角色', { duration: 2000 });
      return;
    }
    store.pcLinks = links;
    for (const pc of store.pcList) {
      const owner = links[packNameId(pc)] ? store.pcMap.get(links[packNameId(pc)]) : undefined;
      if (owner) pc.color = owner.color;
    }
    message.success(`已将 ${linked} 个角色关联到同一账号排在最上面的角色`, { duration: 2000 });
  });

  /** 清除所有关联（一键关联的与手动关联的都算），各角色换回自己的颜色。 */
  const clearLinks = () => runLinkWork(() => {
    const linkedKeys = new Set(Object.keys(store.pcLinks));
    if (!linkedKeys.size) return;
    store.pcLinks = {};
    for (const pc of store.pcList) {
      if (!linkedKeys.has(packNameId(pc))) continue;
      const own = store.pcNameColorMap.get(pc.name);
      if (own) pc.color = own;
    }
    message.success(`已清除 ${linkedKeys.size} 个关联`, { duration: 2000 });
  });

  /** 关联处理中：按钮显示转圈。先让转圈画出来再动手，做完等预览与编辑器跟着刷新完才收起。 */
  const linkBusy = ref(false);
  const linkedCount = computed(() => Object.keys(store.pcLinks).length);
  const nextFrame = () => new Promise<void>((done) => requestAnimationFrame(() => setTimeout(done, 0)));
  const runLinkWork = async (work: () => void) => {
    if (linkBusy.value) return;
    linkBusy.value = true;
    try {
      await nextTick();
      await nextFrame();
      work();
      await nextTick();
      await nextFrame();
    } finally {
      linkBusy.value = false;
    }
  };

  /** 改名或删除角色后，关联里的键也要跟着改。 */
  const renameLinks = (oldKey: string, newKey: string | null) => {
    const links: Record<string, string> = {};
    for (const [key, value] of Object.entries(store.pcLinks)) {
      const k = key === oldKey ? newKey : key;
      const v = value === oldKey ? newKey : value;
      if (k && v && k !== v) links[k] = v;
    }
    store.pcLinks = links;
  };

  // 主题可以指定默认的角色配色。
  watch(theme.palette, (palette) => {
    if (palette?.length) {
      store.palette = [...palette] as typeof store.palette;
      store.paletteStack = [];
    }
  }, { immediate: true });

  const confirm = (title: string, content: () => any, onConfirm: () => void, onCancel?: () => void) => {
    const m = modal.create({
      title,
      preset: 'card',
      style: { width: '30rem' },
      content,
      footer: () => [
        h(NButton, { type: 'default', onClick: () => { onCancel?.(); m.destroy(); }, style: { marginRight: '1rem' } }, () => '取消'),
        h(NButton, { type: 'primary', onClick: () => { try { onConfirm(); } finally { m.destroy(); } } }, () => '确定'),
      ],
    });
  };

  /** 有修改还没保存时问一下：保存、放弃，或回去继续编辑（关掉对话框也算继续编辑）。 */
  const askSaveDraft = (onSave: () => void, onDiscard: () => void, onContinue: () => void) => {
    let settled = false;
    const settle = (action: () => void) => {
      settled = true;
      m.destroy();
      action();
    };
    const m = modal.create({
      title: '保存修改？',
      preset: 'card',
      style: { width: 'min(26rem, calc(100vw - 32px))' },
      content: () => '这条消息的修改还没有保存。',
      onAfterLeave: () => { if (!settled) onContinue(); },
      footer: () => h('div', { style: 'display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap' }, [
        h(NButton, { onClick: () => settle(onContinue) }, () => '继续编辑'),
        h(NButton, { onClick: () => settle(onDiscard) }, () => '放弃修改'),
        h(NButton, { type: 'primary', onClick: () => settle(onSave) }, () => '保存'),
      ]),
    });
  };

  let lastNameChange = 0;
  let lastPCName = '';

  const deletePc = (index: number, i: CharItem) => {
    const now = Date.now();
    if (now - lastNameChange < 100) return;
    lastNameChange = now;
    confirm('删除角色', () => `即将删除角色「${i.name}」及其全部发言，确定吗？`, () => {
      renameLinks(packNameId(i), null);
      store.pcList.splice(index, 1);
      logMan.deleteByCharItem(i);
    });
  };

  const nameFocus = (i: CharItem) => {
    lastPCName = i.name;
  };

  const escapeText = (text: string) => {
    const el = document.createElement('span');
    el.textContent = text;
    return el.innerHTML;
  };

  const nameChanged = (i: CharItem) => {
    const now = Date.now();
    if (now - lastNameChange < 100) return;
    lastNameChange = now;

    // 按回车确认时 nameFocus 会先触发一遍，所以这里先把旧名字存下来。
    const oldName = lastPCName;
    const newName = i.name;
    if (!oldName || !newName) return;
    confirm('名字变更', () => [
      h(NText, {
        innerHTML: `即将进行名字变更 <b>${escapeText(oldName)} -> ${escapeText(newName)}</b><br />`
          + `将修改信息行，并在文本中进行批量替换（${escapeText(`<${oldName}>`)} 替换为 ${escapeText(`<${newName}>`)}），确定吗？`,
      }),
    ], () => {
      try {
        logMan.rename(i, oldName, newName);
        renameLinks(`${oldName}-${i.IMUserId}`, `${newName}-${i.IMUserId}`);
      } catch (_e) {
        i.name = oldName;
      }
    });
  };

  // ─── 编辑器 ───────────────────────────────────────────────

  const setText = (text: string) => {
    store.pcList.length = 0;
    logMan.lastText = '';
    logMan.syncChange(text, [0, store.editor.state.doc.length], [0, text.length]);
  };

  const clearText = () => {
    store.editor.dispatch({ changes: { from: 0, to: store.editor.state.doc.length, insert: '' } });
  };

  const doFlush = () => {
    logMan.flush();
  };

  // 实时日志追加内容时由程序改动编辑器，这段时间里的变更不走下面的 onChange。
  let programmaticChange = false;

  const onChange = (v: ViewUpdate) => {
    if (programmaticChange || !v || !v.docChanged) return;
    // flush 会再触发一次变更（flags 为 0），不处理，否则角色列表会被清空。
    if (!v.viewportChanged && (v as any).flags === 0) return;

    const ranges = (v as any).changedRanges;
    for (let i = ranges.length - 1; i >= 0; i--) {
      const payloadText = store.editor.state.doc.toString();
      const r1 = [ranges[i].fromA, ranges[i].toA];
      const r2 = [ranges[i].fromB, ranges[i].toB];
      if (r1[0] === 0 && r1[1] === logMan.lastText.length) {
        store.pcList = [];
      }
      logMan.syncChange(payloadText, r1, r2);
    }
  };

  // flush 之后，日志的内部数据已经是最新的，编辑器只是跟着换文字：不能再拿这次变更去重新解析，
  // 否则解析又触发 flush，没完没了（编辑器显示时靠 flags 判断挡掉，在聊天等视图里编辑器隐藏，挡不住）。
  logMan.ev.on('textSet', (text) => {
    programmaticChange = true;
    try {
      store.editor.dispatch({ changes: { from: 0, to: store.editor.state.doc.length, insert: text } });
    } finally {
      programmaticChange = false;
    }
    const m = new Map<string, CharItem>();
    for (const i of logMan.curItems) {
      if (i.isRaw) continue;
      setCharInfo(m, i);
    }
    store.updatePcList(m);
  });

  logMan.ev.on('parsed', (ti: TextInfo) => {
    store.updatePcList(ti.charInfo);
  });

  /** 切换编辑器染色。移动端先确认：部分浏览器开了会卡死。 */
  const setHighlight = (enabled: boolean) => {
    const reload = () => setTimeout(() => store.reloadEditor(), 500);
    if (enabled && isMobile.value) {
      confirm('开启编辑器染色？', () => '部分移动设备上的特定浏览器可能会因为兼容性问题而卡死，继续吗？', () => {
        store.doEditorHighlight = true;
        reload();
      }, () => {
        store.doEditorHighlight = false;
      });
      return;
    }
    store.doEditorHighlight = enabled;
    reload();
  };

  const importFile = async (file: File) => {
    if (file.size > 30 * 1024 * 1024) {
      message.warning('文件超过 30MB，无法导入。');
      return;
    }
    setText(await file.text());
    message.success(`已导入 ${file.name}`, { duration: 1500 });
  };

  watch(() => store.pcList, () => store.reloadEditor(), { deep: true });
  watch(() => store.exportOptions, () => store.reloadEditor(), { deep: true });
  watch(theme.isDark, () => store.reloadEditor());

  // ─── 预览 ─────────────────────────────────────────────────

  /** 预览里的副本（换了名字或去掉公式的）对应日志里的哪一条。 */
  let originals = new WeakMap<LogItem, LogItem>();
  // 预览列表是响应式的，组件拿到的是代理对象：先还原成原始对象再比对。
  const sourceOf = (item: LogItem) => {
    const raw = toRaw(item);
    return toRaw(originals.get(raw) ?? raw);
  };

  /** 消息原文（预览里可能是去掉公式后的副本）。 */
  const rawMessageOf = (item: LogItem) => sourceOf(item).message;

  /** 修改一条消息的内容，等同于在编辑器里改那一段。 */
  const editMessage = (item: LogItem, text: string) => {
    const target = sourceOf(item);
    const at = logMan.curItems.indexOf(target);
    if (at < 0) return false;
    // 换成新对象：直接改原始对象的话，预览拿到的还是同一个对象，界面不会更新。
    logMan.curItems[at] = { ...target, message: text.replaceAll('\r\n', '\n') };
    logMan.flush();
    showPreview();
    return true;
  };

  /** 删除一条消息（先确认），等同于在编辑器里删掉那一段。 */
  const deleteMessage = (item: LogItem) => {
    confirm('删除消息', () => '即将删除这条消息，确定吗？', () => {
      const target = sourceOf(item);
      logMan.curItems = logMan.curItems.filter((i) => i !== target);
      logMan.flush();
      showPreview();
    });
  };

  function showPreview() {
    const tmp: LogItem[] = [];
    originals = new WeakMap();
    let index = 0;
    for (const i of logMan.curItems) {
      if (i.isRaw) continue;
      if (store.isHiddenLogItem(i)) continue;

      let msg = msgImageFormat(i.message, store.exportOptions);
      msg = msgAtFormat(msg, store.pcList);
      msg = msgOffTopicFormat(msg, store.exportOptions, i.isDice);
      msg = msgCommandFormat(msg, store.exportOptions);
      msg = msgIMUseridFormat(msg, store.exportOptions, i.isDice);
      msg = msgOffTopicFormat(msg, store.exportOptions, i.isDice); // 再过滤一次
      if (msg.trim() === '') continue;

      i.index = index;
      // 关联到别的角色的账号：换成那个角色的名字与账号显示，颜色、头像、导出都跟着走。
      const pc = store.resolvePc(i);
      const linked = pc && store.pcLinks[packNameId(i)] ? pc : null;
      let shown: LogItem = linked ? { ...i, nickname: linked.name, IMUserId: linked.IMUserId } : i;
      // 公式过滤：消息里的公式换成纯文字，聊天、预览与导出都用这一份。
      if (store.exportOptions.mathHide) {
        const message = stripMath(shown.message);
        if (message !== shown.message) shown = { ...shown, message };
      }
      if (shown !== i) originals.set(shown, i);
      tmp.push(shown);
      index += 1;
    }
    previewItems.value = tmp;
  }

  const setView = (mode: ViewMode) => {
    view.value = mode;
    // 论坛代码与回声工坊不支持图片。
    if (mode === 'bbs' || mode === 'bbspineapple' || mode === 'trg') store.exportOptions.imageHide = true;
    if (mode !== 'edit') showPreview();
  };

  watch(() => store.exportOptions.offTopicHide, showPreview);
  watch(() => store.exportOptions.mathHide, showPreview);
  watch(() => store.pcList.map((pc) => `${pc.IMUserId}-${pc.role}-${pc.name}`), () => showPreview(), { deep: false });
  watch(() => store.pcLinks, () => showPreview());

  // ─── 导出 ─────────────────────────────────────────────────

  const mobileDocWarning = () => {
    if (isMobile.value) {
      message.warning('你当前处于移动端环境，已知只有WPS能够查看生成的Word文件，且无法看图！使用PC打开可以查看图片。');
    }
  };

  const solveImg = (el: Element) => {
    if (el.tagName === 'IMG') {
      let width = el.clientWidth;
      let height = el.clientHeight;
      if (width === 0) {
        width = 300;
        height = 300;
      }
      el.setAttribute('width', `${width}`);
      el.setAttribute('height', `${height}`);
    }
    for (let i = 0; i < el.children.length; i += 1) solveImg(el.children[i]);
  };

  const renderItems = (component: any): string[] => {
    const el = document.createElement('span');
    const items: string[] = [];
    showPreview();
    for (const i of previewItems.value) {
      if (i.isRaw) continue;
      if (store.isHiddenLogItem(i)) continue;
      render(h(component, { source: i }), el);
      solveImg(el);
      items.push(el.innerHTML);
    }
    return items;
  };

  function exportRecordRaw() {
    browserAlert();
    exportFileRaw(store.editor.state.doc.toString());
  }

  function exportRecordDOC() {
    browserAlert();
    mobileDocWarning();
    exportFileDoc(renderItems(PreviewItem).join('\n'));
  }

  function exportRecordTalkDOC() {
    browserAlert();
    mobileDocWarning();
    exportFileDoc(`<table style="border-collapse: collapse;"><tbody>${renderItems(PreviewTableTR).join('\n')}</tbody></table>`);
  }

  const readElementColor = (el: HTMLElement | null): string | undefined => {
    if (!el) return undefined;
    if (el.style && el.style.color) return el.style.color;
    return window.getComputedStyle(el)?.color || undefined;
  };

  const extractMessageLines = (el: HTMLElement | null): string[] => {
    if (!el) return [''];
    const clone = el.cloneNode(true) as HTMLElement;
    const doc = el.ownerDocument || document;

    clone.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('data-src') || img.getAttribute('src') || '';
      img.replaceWith(doc.createTextNode(src ? `[图:${src}]` : '[图:无可用链接]'));
    });

    const blockTags = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'BLOCKQUOTE']);
    const lines: string[] = [];
    let current = '';

    const pushLine = (forceEmpty = false) => {
      const normalized = current.replace(/ /g, ' ').replace(/\s+$/g, '');
      if (normalized || forceEmpty || lines.length === 0) lines.push(normalized);
      current = '';
    };

    const appendText = (text: string | null) => {
      if (!text) return;
      const segments = text.replace(/ /g, ' ').split(/\r?\n/);
      segments.forEach((segment, index) => {
        current += segment;
        if (index < segments.length - 1) pushLine();
      });
    };

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        appendText(node.textContent);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as HTMLElement;
      if (element.tagName === 'BR') {
        pushLine(true);
        return;
      }
      if (blockTags.has(element.tagName)) {
        if (current) pushLine();
        if (element.tagName === 'LI') {
          const parent = element.parentElement;
          if (parent?.tagName === 'OL') {
            const siblings = Array.from(parent.children).filter((child) => child.tagName === 'LI');
            appendText(`${siblings.indexOf(element) + 1}. `);
          } else {
            appendText('• ');
          }
        }
        const before = lines.length;
        Array.from(element.childNodes).forEach(processNode);
        if (current) pushLine();
        else if (lines.length === before) pushLine(true);
        return;
      }
      Array.from(element.childNodes).forEach(processNode);
    };

    Array.from(clone.childNodes).forEach(processNode);
    if (current !== '' || lines.length === 0) pushLine(lines.length === 0);
    while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop();
    if (lines.length === 0) lines.push('');
    return lines;
  };

  function exportRecordDocx() {
    browserAlert();
    showPreview();
    const entries: DocxExportEntry[] = [];

    for (const item of previewItems.value) {
      if (item.isRaw) continue;
      if (store.isHiddenLogItem(item)) continue;

      const mountPoint = document.createElement('div');
      render(h(PreviewItem, { source: item }), mountPoint);
      const host = mountPoint.firstElementChild as HTMLElement | null;
      if (!host) {
        render(null, mountPoint);
        continue;
      }
      const timeEl = host.querySelector('._time') as HTMLElement | null;
      const nicknameEl = host.querySelector('._nickname') as HTMLElement | null;
      const messageEl = host.querySelector('._message') as HTMLElement | null;
      entries.push({
        time: (timeEl?.textContent ?? '').trim(),
        timeColor: readElementColor(timeEl),
        nickname: (nicknameEl?.textContent ?? '').trim(),
        nicknameColor: readElementColor(nicknameEl),
        messageLines: extractMessageLines(messageEl),
        messageColor: readElementColor(messageEl),
      });
      render(null, mountPoint);
    }

    if (!entries.length) {
      message.warning('没有可导出的内容');
      return;
    }
    exportFileDocx(entries, '跑团记录.docx').catch((err) => {
      console.error(err);
      message.error('Docx 导出失败，请稍后重试');
    });
  }

  // ─── 远程日志与实时更新 ───────────────────────────────────

  const applyQQImageRKey = async (text: string) => {
    if (!shouldApplyQQImageRKeyReplacement(text)) return text;
    try {
      return applyQQImageRKeyReplacement(text, await store.tryFetchRKey());
    } catch (e) {
      console.log(e);
      return text;
    }
  };

  /** 把服务器上的记录解成染色器认得的文本。 */
  const decodeRecord = async (record: RemoteRecord): Promise<string> => {
    switch (record.client) {
      case 'Parquet': {
        const uint8 = base64Bytes(record.data);
        // 传底层的 ArrayBuffer：TypeScript 5.7 起 Uint8Array 带了缓冲区类型参数，直接传会被判为不能当 BlobPart。
        // base64Bytes 新建的数组独占整个缓冲区，所以两者内容一致。
        const file = new File([uint8.buffer as ArrayBuffer], 'default');
        const asyncBuffer = await asyncBufferFrom({ file, byteLength: uint8.byteLength });
        const res = await parquetReadObjects({ file: asyncBuffer, compressors });
        const items = res.map((v) => {
          v.id = Number(v.id);
          v.time = Number(v.time);
          v.commandId = Number(v.commandId);
          return v;
        });
        return JSON.stringify({ items, version: 105 });
      }
      case 'DiceNext':
        // DiceNext 专属：zstd 压缩的 {items, version} JSON
        return strFromU8(zstdDecompress(base64Bytes(record.data)));
      case 'SealDice':
      default:
        return strFromU8(unzlibSync(base64Bytes(record.data)));
    }
  };

  const AUTO_SCROLL_KEY = 'lc-auto-scroll';
  const live = reactive({
    active: false,
    status: 'connecting' as LiveStatus,
    /** 有新消息时自动滚到最新（编辑器、预览、聊天都算）。访客关掉后记住。 */
    follow: localStorage.getItem(AUTO_SCROLL_KEY) !== 'off',
    /** 每收到一批新消息加一，预览据此滚动。 */
    tick: 0,
  });
  watch(() => live.follow, (on) => localStorage.setItem(AUTO_SCROLL_KEY, on ? 'on' : 'off'));
  let session: LiveSession | null = null;
  let remote: { key: string; password: string } | null = null;

  const itemText = (item: LiveItem): string => {
    const id = item.IMUserId ? `(${item.IMUserId})` : '';
    const time = dayjs.unix(Number(item.time) || 0).format('YYYY/MM/DD HH:mm:ss');
    return `${item.nickname ?? ''}${id} ${time}\n${String(item.message).replaceAll('\r\n', '\n')}\n\n`;
  };

  /** 把新消息接在编辑器末尾，只重新解析受影响的那一小段。 */
  const appendItems = async (items: LiveItem[]) => {
    const text = await applyQQImageRKey(items.map(itemText).join(''));
    const doc = store.editor.state.doc;
    const oldLength = doc.length;
    const insert = (oldLength > 0 && doc.sliceString(oldLength - 1) !== '\n' ? '\n' : '') + text;
    programmaticChange = true;
    try {
      store.editor.dispatch({ changes: { from: oldLength, insert } });
    } finally {
      programmaticChange = false;
    }
    logMan.syncChange(store.editor.state.doc.toString(), [oldLength, oldLength], [oldLength, oldLength + insert.length]);
    if (view.value !== 'edit') showPreview();
    live.tick += 1;
  };

  const fetchRecord = async (): Promise<RemoteRecord> => {
    return await store.tryFetchLog(remote!.key, remote!.password) as RemoteRecord;
  };

  /** 修改与撤回不常见，直接重新取一遍全文。 */
  const reloadRemote = debounce(async () => {
    if (!remote) return;
    try {
      const record = await fetchRecord();
      setText(await applyQQImageRKey(await decodeRecord(record)));
      await nextTick();
      if (view.value !== 'edit') showPreview();
      live.tick += 1;
    } catch (e) {
      console.log(e);
    }
  }, 800);

  const onLiveEvents = (events: LiveEvent[]) => {
    if (events.some((event) => event.op !== 'add')) {
      reloadRemote();
      return;
    }
    // 追加须按顺序一批一批来，上一批还在处理时排在后面。
    appendQueue = appendQueue.then(() => appendItems(events.map((event) => (event as any).item)));
  };
  let appendQueue: Promise<void> = Promise.resolve();

  const startLive = (lastSeq: number) => {
    live.active = true;
    const current = new LiveSession(remote!.key, remote!.password, lastSeq, {
      onEvents: onLiveEvents,
      onStatus: (status) => {
        // 暂停后旧连接里还没走完的回调不再算数。
        if (session !== current) return;
        live.status = status;
        // 完结后服务器上的全文才是最终版本（撤回与修改都已套用）。
        if (status === 'ended') reloadRemote();
      },
    });
    session = current;
    session.start();
  };

  /** 暂停直播：断开与服务器的串流，记住收到哪一条，恢复时从那里接着收。 */
  let pausedSeq = 0;
  const pauseLive = () => {
    if (!session || live.status === 'ended') return;
    pausedSeq = session.seq;
    session.stop();
    session = null;
    live.status = 'paused';
  };
  const resumeLive = () => {
    if (live.status !== 'paused' || !remote) return;
    startLive(pausedSeq);
  };

  let started = false;

  /** 页面载入后调用一次：地址里带了 key 与密码就去取远程日志。重复调用不会重复载入。 */
  const start = async () => {
    if (started) return;
    started = true;
    const key = new URLSearchParams(window.location.search).get('key');
    const password = location.hash.slice(1);

    const enableHighlight = () => {
      setTimeout(() => {
        if (!isMobile.value) {
          store.doEditorHighlight = true;
          store.reloadEditor();
        }
      }, 1000);
    };

    /** 与主页相同：把内置演示写进编辑器并解析。远程日志失败时也走这里。 */
    const loadSample = async () => {
      const text = store.editor.state.doc.toString() || SAMPLE_LOG;
      store.editor.dispatch({
        changes: { from: 0, to: store.editor.state.doc.length, insert: text },
      });
      enableHighlight();
      await nextTick();
      isSample.value = true;
    };

    if (key && password) {
      remote = { key, password };
      loading.value = true;
      try {
        const record = await fetchRecord();
        logName.value = record.name || '';
        const text = await applyQQImageRKey(await decodeRecord(record));
        await nextTick();
        setText(text);
        enableHighlight();
        if (record.live) {
          // 实时日志默认看聊天视图：像群聊一样一条条冒出来。
          await nextTick();
          setView('chat');
          startLive(Number(record.last_seq) || 0);
        }
      } catch (e) {
        console.log(e);
        notification.error({ content: '错误', meta: '加载日志失败，可能是序号或密码不正确', duration: 5000 });
        remote = null;
        await loadSample();
      } finally {
        loading.value = false;
      }
    } else {
      await loadSample();
    }

    browserAlert();
    setTimeout(() => doFlush(), 3000);
  };

  // 编辑器与聊天视图里可以改名、删除角色；其他预览只看不改。
  const locked = computed(() => view.value !== 'edit' && view.value !== 'chat');

  return {
    store, loading, logName, isSample, view, previewItems, colors, isMobile, live, locked,
    refreshColors, colorChanged, deletePc, nameFocus, nameChanged, linkPc, unlinkPc,
    sameIdGroups, linkSameId, clearLinks, linkBusy, linkedCount,
    clearText, doFlush, onChange, setHighlight, importFile,
    setView, showPreview, askSaveDraft, rawMessageOf, editMessage, deleteMessage,
    exportRecordRaw, exportRecordDOC, exportRecordTalkDOC, exportRecordDocx,
    start, pauseLive, resumeLive,
  };
}

export type Workspace = ReturnType<typeof createWorkspace>;
const KEY: InjectionKey<Workspace> = Symbol('workspace');

export function provideWorkspace(): Workspace {
  const workspace = createWorkspace();
  provide(KEY, workspace);
  return workspace;
}

export function useWorkspace(): Workspace {
  const workspace = inject(KEY);
  if (!workspace) throw new Error('useWorkspace 须在 provideWorkspace 之内使用');
  return workspace;
}

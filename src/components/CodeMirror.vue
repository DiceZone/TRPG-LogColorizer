<template>
  <div id="e" ref="editor" class="codemirror lc-editor">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { DecorationSet } from "@codemirror/view"
import {
  ViewPlugin,
  EditorView,
  keymap,
  ViewUpdate,
  WidgetType,
  Decoration,
} from '@codemirror/view';
import { EditorState, Prec, StateEffect } from '@codemirror/state';
import { SAMPLE_LOG } from '~/workspace/sample';
import { standardKeymap, insertTab, history, historyKeymap } from '@codemirror/commands';
import { syntaxTree } from "@codemirror/language"
import { materialDark, materialLight } from '@uiw/codemirror-theme-material';
import { generateLang } from '~/utils/highlight';
import { useStore } from '~/store'
import { useDark } from "@vueuse/core";
import { basicSetup } from "codemirror";

const editor = ref<HTMLDivElement>()
const store = useStore()
const isDark = useDark({ disableTransition: false })

const emit = defineEmits<(e: 'change', v: ViewUpdate) => void>();

const reloadEditor = (highlight = false) => {
  store.editor.dispatch({
    effects: StateEffect.reconfigure.of(getExts(highlight))
  })
}

store._reloadEditor = reloadEditor

function getExts(highlight = false) {
  return [
    basicSetup,
    EditorView.lineWrapping,
    history(),
    keymap.of([
      ...standardKeymap,
      ...historyKeymap,
      // Tab Keymap
      {
        key: 'Tab',
        run: insertTab,
      },
    ]),
    imagePreviewPlugin,
    ...highlight ? generateLang(store.pcList, store.exportOptions) : [],
    EditorView.updateListener.of((v: ViewUpdate) => {
      if (v.docChanged) {
        emit('change', v);
        // temp1.view.state.doc.toString()
      }
    }),
    isDark.value ? materialDark : materialLight,
    // 主题的设计变量要压过 material 配色自带的底色与当前行颜色。
    Prec.highest(EditorView.theme({
      '&': {
        backgroundColor: 'var(--lc-editor-bg)',
        color: 'var(--lc-editor-text)',
        fontFamily: 'var(--lc-font-mono)',
      },
      '.cm-scroller': {
        fontFamily: 'inherit',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--lc-editor-gutter-bg)',
        color: 'var(--lc-text-faint)',
        borderRightColor: 'var(--lc-editor-gutter-border)',
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: 'var(--lc-editor-active-line)',
      },
    }, { dark: isDark.value })),
  ]
}

class ImagePreviewWidget extends WidgetType {
  constructor(readonly url: string) {
    super()
  }

  eq(other: ImagePreviewWidget) {
    return other.url == this.url
  }

  toDOM() {
    let wrap = document.createElement("span")
    wrap.setAttribute("aria-hidden", "true")
    wrap.className = "cm-my-image" // edit-image
    let box = wrap.appendChild(document.createElement("img"))
    box.src = this.url
    // box.setAttribute('crossOrigin', 'anonymous')
    box.setAttribute('data-original', this.url)
    return wrap
  }

  ignoreEvent() {
    return false
  }
}


function imagePreviews(view: EditorView): DecorationSet {
  let widgets: any = []
  for (let { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from, to,
      enter: (node) => {
        let { from, to } = node
        if (node.name.startsWith("image-")) {
          const text = view.state.doc.sliceString(from, to)
          // ob11 - gocq
          // 因为与新napcat的格式冲突，所以加了一点匹配内容
          let m = /url=(https?\:\/\/gchat\.qpic\.cn[^\]]+)]/.exec(text) as RegExpExecArray
          if (m && !text.includes('file_unique')) {
            let deco = Decoration.widget({
              widget: new ImagePreviewWidget(m[1]),
              side: 0
            })
            widgets.push(deco.range(to))
          }

          m = /\[(?:image|图):([^\]]+)?([^\]]+)\]/.exec(text) as RegExpExecArray
          if (m) {
            let deco = Decoration.widget({
              widget: new ImagePreviewWidget(m[1]),
              side: 0
            })
            widgets.push(deco.range(to))
          }

          // ob11 - napcat 20250317
          if (!m) {
          m = /file_unique=([a-zA-Z0-9]{32})\]/.exec(text) as RegExpExecArray
            if (m) {
              // 注: 观察到与ob11冲突情况
              let deco = Decoration.widget({
                widget: new ImagePreviewWidget(`https://gchat.qpic.cn/gchatpic_new/0/0-0-${m[1]}/0?term=2,subType=1`),
                side: 0
              })
              widgets.push(deco.range(to))
            }
          }

          // ob11 - lagrange
          m = /file=(https?:\/\/[^\]]+)\]/.exec(text) as RegExpExecArray
          if (m) {
            let deco = Decoration.widget({
              widget: new ImagePreviewWidget(m[1]),
              side: 0
            })
            widgets.push(deco.range(to))
          }

          // ob11 - llob(new2)
          m = /file=\{([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)}([^\]]+?)\]/.exec(text) as RegExpExecArray
          if (m) {
            const url = `https://gchat.qpic.cn/gchatpic_new/0/0-0-${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}/0?term=2,subType=1`
            let deco = Decoration.widget({
              widget: new ImagePreviewWidget(url),
              side: 0
            })
            widgets.push(deco.range(to))
          }

          // ob11 - llob(new)
          m = /file=([A-Za-z0-9]{32,64})(\.[a-zA-Z]+?)\]/.exec(text) as RegExpExecArray
          if (m) {
            let deco = Decoration.widget({
              widget: new ImagePreviewWidget(`https://gchat.qpic.cn/gchatpic_new/0/0-0-${m[1]}/0?term=2,subType=1`),
              side: 0
            })
            widgets.push(deco.range(to))
          }

          // ob11 - llob(old)
          m = /file=file:\/\/[^\]]+([A-Za-z0-9]{32})(\.[a-zA-Z]+?)\]/.exec(text) as RegExpExecArray
          if (m) {
            let deco = Decoration.widget({
              widget: new ImagePreviewWidget(`https://gchat.qpic.cn/gchatpic_new/0/0-0-${m[1].toUpperCase()}/0?term=2,subType=1`),
              side: 0
            })
            widgets.push(deco.range(to))
          }

          m = /\[mirai:image:\{([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)}([^\]]+?)\]/.exec(text) as RegExpExecArray
          if (m) {
            const url = `https://gchat.qpic.cn/gchatpic_new/0/0-0-${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}/0?term=2`
            let deco = Decoration.widget({
              widget: new ImagePreviewWidget(url),
              side: 0
            })
            widgets.push(deco.range(to))
          }
        }
      }
    })
  }
  return Decoration.set(widgets)
}

const imagePreviewPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = imagePreviews(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = imagePreviews(update.view)
    }
  }
}, {
  decorations: v => v.decorations,

  eventHandlers: {
    mousedown: (e, view) => {
    }
  }
})

const createEditor = (editorContainer: any, doc: any) => {
  if (store.editor) {
    store.editor.destroy();
  }

  const startState = EditorState.create({
    //doc为编辑器默认内容
    doc: SAMPLE_LOG,
    extensions: getExts(),
  });

  store.editor = new EditorView({
    state: startState,
    parent: editorContainer,
  });

}

onMounted(() => {
  createEditor(editor.value, '')
})
</script>

<style>
.cm-editor {
  height: var(--lc-editor-height);
  font-family: var(--lc-font-mono);
  font-size: var(--lc-editor-font-size);
  line-height: 1.65;
  outline: 0 !important;
}

.codemirror {
  position: relative;
  height: var(--lc-editor-height);
  overflow: hidden;
  border: 1px solid var(--lc-editor-gutter-border);
  border-radius: var(--lc-radius);
  background: var(--lc-editor-bg);
}

.cm-my-image > img {
  max-width: 8rem;
  max-height: 6rem;
}
</style>

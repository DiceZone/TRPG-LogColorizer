/// <reference types="vite/client" />

/** 构建日期（如 20261117），作为版本号显示。 */
declare const __BUILD_DATE__: string;

interface ImportMetaEnv {
  /** 日志读取接口地址（…/api/dice） */
  readonly LOG_API_BASE?: string
  /** 实时日志接口地址（…/api/v2）；省略时由 LOG_API_BASE 推出 */
  readonly LOG_LIVE_API_BASE?: string
  /** RKey 获取接口地址 */
  readonly RKEY_API_BASE?: string
  /** 站点使用的主题：public/themes 下的目录名 */
  readonly LOG_THEME?: string
  /** 页眉 GitHub 图标指向的源码地址；设为 none 时不显示 */
  readonly LOG_SOURCE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.vue" {
  import { DefineComponent } from "vue";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

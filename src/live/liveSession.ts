// 实时日志：跟着一份进行中的日志接收新消息。
// 优先用 SSE 推送；经过 CDN 时推送可能被缓冲或直接连不上，这时自动改为定时拉取。
import { config } from '~/config';

export interface LiveItem {
  nickname?: string;
  IMUserId?: string;
  time?: number;
  message: string;
  isDice: boolean;
  [key: string]: unknown;
}

export type LiveEvent =
  | { seq: number; op: 'add'; item: LiveItem }
  | { seq: number; op: 'edit'; rawMsgId: string | number; message: string }
  | { seq: number; op: 'delete'; rawMsgId: string | number };

export type LiveStatus = 'connecting' | 'live' | 'retrying' | 'paused' | 'ended';

interface Handlers {
  /** 一批按序号排好、之前没给过的事件。 */
  onEvents: (events: LiveEvent[]) => void;
  onStatus: (status: LiveStatus) => void;
}

const POLL_INTERVAL = 2500;
/** 推送模式下每隔这么久拉一次做核对：拉得到而推送没送到，就说明推送被缓冲了。 */
const CHECK_INTERVAL = 15000;

export class LiveSession {
  private lastSeq: number;
  private source: EventSource | null = null;
  private timer: number | undefined;
  private stopped = false;
  private polling = false;
  private failures = 0;

  constructor(
    private key: string,
    private password: string,
    lastSeq: number,
    private handlers: Handlers,
  ) {
    this.lastSeq = lastSeq;
  }

  /** 已收到的最后一个事件序号；暂停后从这里接着收。 */
  get seq(): number {
    return this.lastSeq;
  }

  start() {
    this.handlers.onStatus('connecting');
    if (typeof EventSource === 'undefined') this.startPolling();
    else this.startStream();
  }

  stop() {
    this.stopped = true;
    this.source?.close();
    this.source = null;
    window.clearTimeout(this.timer);
  }

  private url(action: 'stream' | 'events'): string {
    const query = new URLSearchParams({ password: this.password, after: String(this.lastSeq) });
    return `${config.liveApiBase}/live/${encodeURIComponent(this.key)}/${action}?${query}`;
  }

  /** 只交出序号比已收到的大的事件，两条通道重复送来的不会重复处理。 */
  private deliver(events: LiveEvent[]) {
    const fresh = events.filter((event) => event.seq > this.lastSeq).sort((a, b) => a.seq - b.seq);
    if (!fresh.length) return;
    this.lastSeq = fresh[fresh.length - 1].seq;
    this.handlers.onEvents(fresh);
  }

  private end() {
    this.handlers.onStatus('ended');
    this.stop();
  }

  private startStream() {
    const source = new EventSource(this.url('stream'));
    this.source = source;
    source.onopen = () => {
      this.failures = 0;
      this.handlers.onStatus('live');
    };
    source.onmessage = (message) => {
      try {
        this.deliver([JSON.parse(message.data)]);
      } catch { /* 不是事件的内容，略过 */ }
    };
    source.addEventListener('end', () => this.end());
    source.onerror = () => {
      // 浏览器会自己重连；连续失败几次就不再指望推送。
      this.failures += 1;
      if (this.failures >= 3) {
        source.close();
        this.source = null;
        this.startPolling();
      } else {
        this.handlers.onStatus('retrying');
      }
    };
    this.scheduleCheck();
  }

  private scheduleCheck() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(async () => {
      if (this.stopped || this.polling) return;
      const before = this.lastSeq;
      const result = await this.fetchEvents();
      if (this.stopped || this.polling) return;
      if (result && result.events.length && this.lastSeq === before) {
        // 服务器上已经有新事件，推送却没送到：改用拉取。
        this.source?.close();
        this.source = null;
        this.deliver(result.events);
        this.startPolling();
        return;
      }
      if (result?.status === 'done') return this.end();
      this.scheduleCheck();
    }, CHECK_INTERVAL);
  }

  private startPolling() {
    this.polling = true;
    const tick = async () => {
      if (this.stopped) return;
      const result = await this.fetchEvents();
      if (this.stopped) return;
      if (result) {
        this.handlers.onStatus('live');
        this.deliver(result.events);
        if (result.status !== 'live') return this.end();
      } else {
        this.handlers.onStatus('retrying');
      }
      this.timer = window.setTimeout(tick, POLL_INTERVAL);
    };
    tick();
  }

  private async fetchEvents(): Promise<{ status: string; events: LiveEvent[] } | null> {
    try {
      const response = await fetch(this.url('events'), { cache: 'no-store' });
      // 日志被删除或密码不对：不会再有新内容。
      if (response.status === 404) return { status: 'done', events: [] };
      if (!response.ok) return null;
      const data = await response.json();
      return { status: String(data.status), events: Array.isArray(data.events) ? data.events : [] };
    } catch {
      return null;
    }
  }
}

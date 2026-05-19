/**
 * Pencil Viewer — WebRTC シグナリングサーバー
 * (Cloudflare Worker + Durable Object)
 *
 * y-webrtc 互換のシグナリングサーバー。共同編集の P2P 接続確立に必要な
 * メタデータ (peer 発見・SDP/ICE 交換) だけを中継する。
 *
 *   - ドキュメントの中身はここを一切経由しない (WebRTC で peer 間を直接流れる)
 *   - サーバーには何も保存しない (KV / storage 未使用)
 *   - 中継するのは接続確立用の短いメッセージのみ
 *
 * なぜ自前ホストするか:
 *   y-webrtc のデフォルト公開サーバー `signaling.yjs.dev` は Heroku 上で
 *   稼働しており、Heroku の無料 dyno 廃止に伴い既にサービス終了している。
 *   Pencil Viewer は Cloudflare Workers で完結させる方針のため自前で用意する。
 */

export interface Env {
  SIGNALING: DurableObjectNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') {
      // ヘルスチェック用
      return new Response('Pencil Viewer signaling server — OK\n', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    // シグナリングは軽量なので 1 つの Durable Object に集約する
    const id = env.SIGNALING.idFromName('global');
    return env.SIGNALING.get(id).fetch(req);
  },
};

interface SignalMessage {
  type: 'subscribe' | 'unsubscribe' | 'publish' | 'ping' | 'pong';
  topics?: unknown[];
  topic?: unknown;
  clients?: number;
  [k: string]: unknown;
}

/**
 * topic 単位の pub/sub を行うシグナリング Durable Object。
 * y-webrtc の signaling プロトコル (subscribe / unsubscribe / publish / ping) を実装。
 */
export class SignalingServer {
  /** topic 名 → 購読中ソケット集合 */
  private topics = new Map<string, Set<WebSocket>>();
  /** ソケット → 購読中 topic 集合 (切断時の掃除用) */
  private subs = new Map<WebSocket, Set<string>>();

  // Durable Object のコンストラクタ (state / env は本 DO では未使用)
  constructor(_state: DurableObjectState, _env: Env) {}

  fetch(_req: Request): Response {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.subs.set(server, new Set());

    server.addEventListener('message', (ev: MessageEvent) => {
      let msg: SignalMessage | null = null;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '') as SignalMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;
      this.handle(server, msg);
    });

    const cleanup = () => this.drop(server);
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  private handle(conn: WebSocket, msg: SignalMessage): void {
    switch (msg.type) {
      case 'subscribe':
        for (const topic of msg.topics ?? []) {
          if (typeof topic !== 'string') continue;
          let set = this.topics.get(topic);
          if (!set) {
            set = new Set();
            this.topics.set(topic, set);
          }
          set.add(conn);
          this.subs.get(conn)?.add(topic);
        }
        break;

      case 'unsubscribe':
        for (const topic of msg.topics ?? []) {
          if (typeof topic !== 'string') continue;
          this.topics.get(topic)?.delete(conn);
          this.subs.get(conn)?.delete(topic);
        }
        break;

      case 'publish': {
        if (typeof msg.topic !== 'string') break;
        const receivers = this.topics.get(msg.topic);
        if (!receivers) break;
        msg.clients = receivers.size;
        const payload = JSON.stringify(msg);
        // 同 topic の全購読者へ中継 (送信元含む — y-webrtc の仕様どおり)
        for (const r of receivers) {
          try {
            r.send(payload);
          } catch {
            // 送信失敗ソケットは close ハンドラ側で掃除される
          }
        }
        break;
      }

      case 'ping':
        try {
          conn.send(JSON.stringify({ type: 'pong' }));
        } catch {
          // ignore
        }
        break;
    }
  }

  /** ソケット切断時: 全 topic から取り除く */
  private drop(conn: WebSocket): void {
    const topics = this.subs.get(conn);
    if (topics) {
      for (const t of topics) {
        const set = this.topics.get(t);
        set?.delete(conn);
        if (set && set.size === 0) this.topics.delete(t);
      }
    }
    this.subs.delete(conn);
  }
}

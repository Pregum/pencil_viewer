# Pencil Viewer — 共同編集シグナリングサーバー

Figma ライクなリアルタイム共同編集 (`Collab` ボタン) の P2P 接続を確立するための
**WebRTC シグナリングサーバー**です。Cloudflare Worker + Durable Object で動きます。

## これは何をするのか

- y-webrtc 互換のシグナリングサーバー
- peer 同士が WebRTC 接続を張るための **接続確立メッセージだけ** を中継する
- **ドキュメントの中身は一切経由しません** — `.pen` の内容は peer 間を WebRTC で直接流れます
- サーバーには何も保存しません (KV / storage 未使用)

> なぜ自前ホストするのか: y-webrtc のデフォルト公開サーバー `signaling.yjs.dev` は
> Heroku 上にあり、Heroku の無料 dyno 廃止に伴いサービス終了しています。

## デプロイ手順

```bash
cd workers/collab-signaling
npm install
cp wrangler.toml.example wrangler.toml
npx wrangler deploy
```

デプロイすると `https://pencil-viewer-signaling.<account>.workers.dev` のような
URL が表示されます。

## フロントエンドへの設定

ビルド時の環境変数 `VITE_COLLAB_SIGNALING` に、上記 URL の `https` を `wss` に
置き換えたものを設定します (複数指定する場合はカンマ区切り)。

GitHub Pages (GitHub Actions) でデプロイする場合は、リポジトリの
**Settings → Secrets and variables → Actions → Variables** に追加:

| 名前 | 値の例 |
|------|--------|
| `VITE_COLLAB_SIGNALING` | `wss://pencil-viewer-signaling.<account>.workers.dev` |

ローカル開発なら `.env.local` に:

```
VITE_COLLAB_SIGNALING=wss://pencil-viewer-signaling.<account>.workers.dev
```

## 設定しない場合の挙動

`VITE_COLLAB_SIGNALING` が未設定でも、**同一ブラウザのタブ間** は
BroadcastChannel 経由で共同編集できます (シグナリングサーバー不要)。
別デバイス・別ブラウザ間で繋ぐ場合のみ、このサーバーが必要です。

## 無料枠について

- Workers: 10 万リクエスト/日 (無料)
- Durable Objects: SQLite バックエンド (`new_sqlite_classes`) として宣言しているため
  無料プランで利用可能
- シグナリングのトラフィックはごく軽量 (接続確立時のみ)

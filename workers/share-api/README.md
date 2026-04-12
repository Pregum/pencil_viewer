# Pencil Viewer Share API

Cloudflare Workers + KV で `.pen` ファイルの URL 共有を実現する **オプション機能** です。

> [!NOTE]
> **Share 機能は任意です。** Pencil Viewer 本体は Share 機能なしで完全に動作します。
> ローカル閲覧・ファイル選択・URL 読み込みだけで十分な場合は、このディレクトリの作業は不要です。
>
> 「フォークして自分のインスタンスに URL 共有機能を追加したい」という人だけ、以下の手順を実行してください。

## 必要なもの

- Cloudflare アカウント(無料プラン可)
- Node.js 20+

## 仕組み

```
[ユーザー A] Share ボタン → POST /api/share
                              ↓
                          Workers(バリデーション + ID 生成)
                              ↓
                          KV(.pen JSON を 30 日保存)
                              ↓
                          { id, url } を返す

[ユーザー B] ?id=XXX で URL を開く → GET /api/files/XXX
                                      ↓
                                  Workers → KV → .pen JSON を取得
```

## セットアップ手順

### 1. 依存インストール

```bash
cd workers/share-api
npm install
```

### 2. Cloudflare にログイン

```bash
npx wrangler login
```

ブラウザが開き、Cloudflare アカウントと OAuth 認証します。

### 3. KV namespace を作成

```bash
npx wrangler kv namespace create PEN_FILES
```

出力例:
```
{ binding = "PEN_FILES", id = "abc123def456..." }
```

### 4. `wrangler.toml` を作成

テンプレートをコピーして、取得した KV ID と自分のフロントエンド URL を設定:

```bash
cp wrangler.toml.example wrangler.toml
```

`wrangler.toml` を開いて以下 2 箇所を編集:

- `id = "YOUR_KV_NAMESPACE_ID_HERE"` ← 手順 3 で取得した ID に差し替え
- `ALLOWED_ORIGIN = "https://example.github.io"` ← 自分のフロントエンド URL に変更

> `wrangler.toml` は `.gitignore` されているため、実 ID をコミットしてしまう事故はありません。

### 5. ローカルで動作確認(任意)

```bash
npm run dev
```

`http://localhost:8787/api/health` にアクセスして `{ "ok": true }` が返れば OK。

### 6. 本番デプロイ

```bash
npm run deploy
```

デプロイ後、`https://pencil-viewer-share.<your-account>.workers.dev` のような URL が発行されます。

### 7. フロントエンドと繋ぐ

発行された Worker URL をフロントエンド側の環境変数 `VITE_SHARE_API_URL` に設定してください。

**ローカル開発時** — プロジェクトルートに `.env.local` を作成:

```
VITE_SHARE_API_URL=https://pencil-viewer-share.<your-account>.workers.dev
```

**GitHub Pages デプロイ時** — リポジトリの Settings → Secrets and variables → Actions で `VITE_SHARE_API_URL` を追加し、`.github/workflows/deploy.yml` のビルドステップに環境変数として渡してください。

設定後、フロントエンドの Share ボタンが自動的に有効化されます(`isShareEnabled()` が `true` を返すため)。

## API 仕様

### `POST /api/share`

`.pen` ファイルの JSON をアップロードして共有 ID を取得。

```bash
curl -X POST https://pencil-viewer-share.<your-account>.workers.dev/api/share \
  -H "Content-Type: application/json" \
  -d @design.pen
```

Response:
```json
{
  "id": "aBcDeFgH",
  "url": "https://<your-site>/?id=aBcDeFgH",
  "expiresIn": "30 days"
}
```

### `GET /api/files/:id`

共有された `.pen` ファイルを取得。

```bash
curl https://pencil-viewer-share.<your-account>.workers.dev/api/files/aBcDeFgH
```

### `GET /api/health`

ヘルスチェック。`{ "ok": true, "ts": ... }` を返すだけ。

## 制限と料金

| 項目 | 値 | 変更方法 |
|---|---|---|
| 最大ファイルサイズ | 5MB | `wrangler.toml` の `MAX_SIZE` |
| 有効期限 | 30 日 | `wrangler.toml` の `TTL_SECONDS` |
| CORS 許可オリジン | 設定値 + localhost | `wrangler.toml` の `ALLOWED_ORIGIN` |
| Workers 無料枠 | 100k req/日 | - |
| KV 無料枠 | 100k read/日、1k write/日、1GB ストレージ | - |

個人用・小規模 OSS 用途なら無料枠で収まる想定です。超過すると 429 が返るだけで自動課金はされません。

## トラブルシューティング

**Q. `wrangler deploy` で "You need to login first" と出る**
→ `npx wrangler login` を先に実行してください。

**Q. `wrangler.toml` に `id = ""` のままデプロイしてしまった**
→ KV バインディングが無効なのでリクエスト時に 500 エラーになります。正しい ID に差し替えて再デプロイしてください。

**Q. Share ボタンが表示されない**
→ フロントエンドの `VITE_SHARE_API_URL` 環境変数が未設定です。`.env.local` を作成して再起動してください。

**Q. CORS エラーが出る**
→ `ALLOWED_ORIGIN` がフロントエンド URL と一致していません。`wrangler.toml` を修正して再デプロイしてください。

## セキュリティ上の注意

- **`wrangler.toml` をコミットしない**(`.gitignore` に含まれています)
- **Cloudflare API トークンを環境変数やコードに埋め込まない**(`wrangler login` の OAuth トークンは `~/.wrangler/` に保存されるため、リポジトリには入りません)
- **アップロードされた `.pen` ファイルは公開されます** — 誰でも ID を知っていれば取得できます(8 文字ランダムなので総当たりは現実的でないですが、機密情報を含むファイルを共有しないでください)

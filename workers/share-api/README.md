# Pencil Viewer Share API

Cloudflare Worker + KV で .pen ファイルの URL 共有を実現する。

## セットアップ

```bash
cd workers/share-api
npm install

# Cloudflare にログイン
npx wrangler login

# KV namespace を作成
npx wrangler kv namespace create PEN_FILES
# → 出力された id を wrangler.toml の [[kv_namespaces]] id に貼り付け

# ローカル開発
npm run dev

# デプロイ
npm run deploy
```

## API

### `POST /api/share`

.pen ファイルの JSON をアップロードして共有 ID を取得。

```bash
curl -X POST https://pencil-viewer-share.<account>.workers.dev/api/share \
  -H "Content-Type: application/json" \
  -d @design.pen
```

Response:
```json
{
  "id": "aBcDeFgH",
  "url": "https://pregum.github.io/pencil_viewer/?id=aBcDeFgH",
  "expiresIn": "30 days"
}
```

### `GET /api/files/:id`

共有された .pen ファイルを取得。

```bash
curl https://pencil-viewer-share.<account>.workers.dev/api/files/aBcDeFgH
```

## 制限

| 項目 | 値 |
|---|---|
| 最大ファイルサイズ | 5MB |
| 有効期限 | 30 日 |
| 無料枠 | 100k req/day, 1k writes/day, 1GB storage |

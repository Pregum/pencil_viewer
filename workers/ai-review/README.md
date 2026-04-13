# Pencil AI Design Review

> **Cloudflare Workers AI でデザインを自動レビュー。DB なし、ストレージなし、完全ステートレス。**

## Setup

```bash
cd workers/ai-review
cp wrangler.toml.example wrangler.toml
npm install
npx wrangler deploy
```

Then set the Worker URL in your frontend build:

```bash
VITE_AI_REVIEW_URL=https://pencil-ai-review.YOUR.workers.dev npm run build
```

## API

```bash
POST /
Content-Type: application/json

{
  "children": [...],   # PenDocument.children
  "locale": "ja",      # "en" | "ja" | "zh"
  "mode": "full"       # "full" | "five-states" | "accessibility" | "quick"
}
```

### Modes

| Mode | Description |
|---|---|
| `full` | Comprehensive review (Five States + consistency + accessibility) |
| `five-states` | Five UI States coverage only |
| `accessibility` | Accessibility audit only |
| `quick` | 3-5 bullet points, quick feedback |

### Response

```json
{
  "review": "AI のレビュー結果テキスト...",
  "meta": {
    "mode": "full",
    "locale": "ja",
    "screenCount": 12,
    "model": "@cf/meta/llama-3.1-8b-instruct"
  }
}
```

## Cost

| Item | Cost |
|---|---|
| Workers AI | **Free** (10,000 neurons/day) |
| Workers | **Free** (100k req/day) |
| Total | **$0** |

---

# Pencil AI デザインレビュー (日本語)

> **Cloudflare Workers AI でデザインを自動レビュー。DB なし、完全ステートレス。**

## セットアップ

```bash
cd workers/ai-review
cp wrangler.toml.example wrangler.toml
npm install
npx wrangler deploy
```

フロントエンドビルド時に Worker URL を設定:

```bash
VITE_AI_REVIEW_URL=https://pencil-ai-review.YOUR.workers.dev npm run build
```

## レビューモード

| モード | 内容 |
|---|---|
| `full` | 総合レビュー（Five States + 一貫性 + アクセシビリティ） |
| `five-states` | Five UI States カバー率のみ |
| `accessibility` | アクセシビリティ監査のみ |
| `quick` | 3-5 箇条書きのクイックフィードバック |

## コスト: **$0/月**

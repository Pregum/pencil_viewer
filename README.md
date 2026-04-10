# Pencil Viewer

[Pencil.dev](https://www.pencil.dev/) で作成された `.pen` ファイルをブラウザで閲覧する静的ビュワーサイト。

完全クライアントサイドで動作するため、サーバー不要・**ホスティングは完全無料**(GitHub Pages)。

## 機能

- **ファイル読み込み 3 経路**
  - ドラッグ & ドロップ(または クリック選択)
  - `?src=<url>` クエリで外部 URL から取得(CORS 許可された配信のみ)
  - バンドルされたサンプルファイル
- **MVP 対応ノード**: rectangle / ellipse / line / polygon / path / text / frame(flex レイアウト) / group / icon_font(Material Symbols)
- **塗り / 効果**: ソリッド色 / 線形グラデーション / 放射状グラデーション / 画像パターン / ガウシアンブラー / ドロップシャドウ
- **未対応ノードの耐性**: 未知の `type` を含む .pen でも全体描画は止まらず、該当箇所のみ破線プレースホルダで表示

## アーキテクチャ

parser → layout → renderer の 3 層で責務を分離。

```
JSON text
  └─ parsePenText (zod safeParse)        → src/pen/parser.ts
       └─ PenDocument (discriminated union)
            └─ layoutDocument (flex 2-pass)  → src/pen/layout/flex.ts
                 └─ LaidOut PenDocument (実数座標)
                      └─ PenViewer + renderers → src/pen/renderer/
                           └─ React SVG tree
```

## 開発

```bash
npm install
npm run dev         # http://localhost:5173
npm test            # vitest run
npm run typecheck   # tsc -b --noEmit
npm run build       # vite build → dist/
```

## デプロイ(GitHub Pages)

`main` ブランチへ push すると `.github/workflows/deploy.yml` が自動で Pages に配信します。

### 初回セットアップ

1. GitHub リポジトリの **Settings → Pages** を開き、**Source** を **GitHub Actions** に設定
2. `main` へ push すると workflow が起動し、ビルド → アーティファクトアップロード → デプロイ
3. 完了後 `https://<your-user>.github.io/pencil_viewer/` でアクセス可能

### 配信パス

`vite.config.ts` の `base` は本番ビルド時のみ `/pencil_viewer/` になる。独自ドメインや別パスで配信する場合は `VITE_BASE` 環境変数で上書き可能。

```bash
VITE_BASE=/ npm run build         # ルート配信(独自ドメイン用)
VITE_BASE=/custom/ npm run build  # 任意のサブパス
```

## コスト

| 項目 | 費用 |
|---|---|
| GitHub Pages ホスティング | **無料**(public リポ / 帯域 100GB/月) |
| HTTPS | **無料**(自動付与) |
| ビルド CI | **無料**(public リポは GitHub Actions 無制限) |
| 独自ドメイン(任意) | ドメイン料金のみ(Pages 側は無料) |

## ライセンス

MIT(予定)

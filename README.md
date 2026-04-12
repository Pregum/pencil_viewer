# Pencil Viewer

> **Open-source online viewer & editor for [Pencil.dev](https://www.pencil.dev/) `.pen` files.**
>
> Runs entirely in the browser. No server required. Free to host.

[**Live Demo**](https://pregum.github.io/pencil_viewer/) | [Report Bug](https://github.com/Pregum/pencil_viewer/issues) | [Request Feature](https://github.com/Pregum/pencil_viewer/issues)

---

## Features

- **3 ways to load files** --- drag & drop, `?src=<url>` query, or bundled samples
- **Full node support** --- rectangle, ellipse, line, polygon, path, text, frame (flex layout), group, icon_font (Material Symbols + Lucide)
- **Paint & effects** --- solid color, linear/radial gradients, image fills, blur, drop shadow
- **Variable resolution** --- `$token` references in fills, strokes, radii and more are resolved from the document's `variables` block
- **Flex layout engine** --- horizontal/vertical layout, justify/align, gap, padding, `fill_container`, `fit_content`
- **Figma-like canvas** --- zoom (Cmd+scroll), pan (scroll / Space+drag), frame navigation (Cmd+P)
- **Resilient rendering** --- unknown node types render as dashed placeholders; one broken node never crashes the whole view
- **Mobile-ready** --- responsive CSS hides editor panels on small screens for a pure viewing experience

## Architecture

```
JSON (.pen file)
  -> parsePenText (zod validation)     src/pen/parser.ts
  -> substituteVariables ($token)      src/pen/variables.ts
  -> layoutDocument (flex 2-pass)      src/pen/layout/flex.ts
  -> PenViewer + renderers (SVG)       src/pen/renderer/
```

## Getting Started

```bash
npm install
npm run dev         # http://localhost:5173
npm test            # vitest
npm run build       # production build -> dist/
```

## Deploy (GitHub Pages --- free)

Push to `main` triggers `.github/workflows/deploy.yml` automatically.

**First-time setup:** Repository Settings -> Pages -> Source = **GitHub Actions**.

## Optional: URL Sharing (Cloudflare Workers)

Pencil Viewer can optionally generate shareable URLs for `.pen` files via a Cloudflare Workers + KV backend.
**This feature is entirely optional** --- the viewer works fully without it. If `VITE_SHARE_API_URL` is unset, the Share button simply hides itself.

If you want to enable it for your own fork:

1. Create a free Cloudflare account
2. Follow the setup guide in [`workers/share-api/README.md`](./workers/share-api/README.md)
3. Set `VITE_SHARE_API_URL` to your deployed Worker URL before building the frontend

Free tier covers 100k requests/day, which is more than enough for personal or small OSS usage.

## Roadmap

| Status | Feature |
|---|---|
| :white_check_mark: | Core renderer (rect, ellipse, line, polygon, path, text, frame, group, icon_font, image) |
| :white_check_mark: | Flex layout (horizontal / vertical / justify / align / gap / padding) |
| :white_check_mark: | Gradient + blur + shadow via SVG `<defs>` |
| :white_check_mark: | Variable (`$token`) resolution |
| :white_check_mark: | File loading (D&D, URL, samples) |
| :white_check_mark: | Zoom / pan / frame navigation |
| :white_check_mark: | Responsive mobile layout |
| :white_check_mark: | GitHub Pages deployment (free) |
| :white_check_mark: | Theme switching (light / dark variables) |
| :white_check_mark: | `ref` (component instance) resolution |
| :white_check_mark: | `connection` / `note` node rendering |
| :white_check_mark: | Export to SVG / PNG |
| :white_check_mark: | Collaborative viewing via shared URL (Cloudflare Workers + KV) |

## License

[MIT](./LICENSE)

---

# Pencil Viewer (日本語)

> **[Pencil.dev](https://www.pencil.dev/) の `.pen` ファイルを表示・編集するオープンソースのオンラインビュワー。**
>
> 完全にブラウザ上で動作。サーバー不要。ホスティング無料。

## 特徴

- **3 つのファイル読み込み方法** --- ドラッグ & ドロップ / `?src=<url>` クエリ / バンドルサンプル
- **全主要ノード対応** --- rectangle / ellipse / line / polygon / path / text / frame(flex レイアウト) / group / icon_font(Material Symbols + Lucide)
- **塗り & 効果** --- ソリッド色 / 線形・放射グラデーション / 画像パターン / ぼかし / ドロップシャドウ
- **変数解決** --- fill / stroke / cornerRadius 等の `$token` 参照をドキュメントの `variables` ブロックから自動解決
- **Flex レイアウトエンジン** --- horizontal / vertical / justify / align / gap / padding / fill_container / fit_content
- **Figma ライクなキャンバス操作** --- ズーム(Cmd+スクロール) / パン(スクロール / Space+ドラッグ) / フレームナビゲーション(Cmd+P)
- **未対応ノードに耐性** --- 未知の `type` は破線プレースホルダで表示、全体描画は止まらない
- **モバイル対応** --- レスポンシブ CSS で小画面では編集パネルを非表示にし、閲覧に特化

## オプション: URL 共有機能(Cloudflare Workers)

`.pen` ファイルを短縮 URL で共有する機能を Cloudflare Workers + KV で追加できます。
**この機能は完全に任意です** --- 無効のままでもビューアはすべての機能が使えます。`VITE_SHARE_API_URL` が未設定ならば Share ボタンは自動的に非表示になります。

フォークした自分のインスタンスで有効化したい場合:

1. Cloudflare アカウントを作成(無料)
2. [`workers/share-api/README.md`](./workers/share-api/README.md) のセットアップ手順に従う
3. デプロイして得た Worker URL を `VITE_SHARE_API_URL` に設定してフロントエンドを再ビルド

無料枠で 10 万リクエスト / 日まで使えるため、個人利用や小規模 OSS なら実質無料で運用できます。

## ロードマップ

| 状態 | 機能 |
|---|---|
| :white_check_mark: | コアレンダラ(全主要ノード型) |
| :white_check_mark: | Flex レイアウト |
| :white_check_mark: | グラデーション / ぼかし / シャドウ |
| :white_check_mark: | 変数(`$token`)解決 |
| :white_check_mark: | ファイル読み込み(D&D / URL / サンプル) |
| :white_check_mark: | ズーム / パン / フレームナビゲーション |
| :white_check_mark: | レスポンシブモバイル対応 |
| :white_check_mark: | GitHub Pages デプロイ(無料) |
| :white_check_mark: | テーマ切替(light / dark 変数) |
| :white_check_mark: | `ref`(コンポーネントインスタンス)解決 |
| :white_check_mark: | `connection` / `note` ノード描画 |
| :white_check_mark: | SVG / PNG エクスポート |
| :white_check_mark: | URL 共有による共同閲覧(Cloudflare Workers + KV) |

## ライセンス

[MIT](./LICENSE)

---

# Pencil Viewer (中文)

> **[Pencil.dev](https://www.pencil.dev/) `.pen` 文件的开源在线查看器和编辑工具。**
>
> 完全在浏览器中运行。无需服务器。免费托管。

## 功能

- **3 种文件加载方式** --- 拖放 / `?src=<url>` 查询参数 / 内置示例
- **全节点支持** --- rectangle / ellipse / line / polygon / path / text / frame（flex 布局）/ group / icon_font（Material Symbols + Lucide）
- **填充与特效** --- 纯色 / 线性渐变 / 径向渐变 / 图像填充 / 模糊 / 阴影
- **变量解析** --- 自动解析文档 `variables` 块中的 `$token` 引用（填充、描边、圆角等）
- **Flex 布局引擎** --- horizontal / vertical / justify / align / gap / padding / fill_container / fit_content
- **类 Figma 画布操作** --- 缩放（Cmd+滚轮）/ 平移（滚轮 / Space+拖拽）/ 画框导航（Cmd+P）
- **容错渲染** --- 未知节点类型以虚线占位符显示，不影响整体渲染
- **移动端适配** --- 响应式 CSS，小屏幕自动隐藏编辑面板，专注查看体验

## 可选：URL 共享（Cloudflare Workers）

可通过 Cloudflare Workers + KV 为 `.pen` 文件生成可共享的短链接。
**此功能完全可选** --- 不启用也不影响查看器的任何功能。如未设置 `VITE_SHARE_API_URL`，Share 按钮会自动隐藏。

如果你 Fork 后想在自己的实例上启用：

1. 创建免费 Cloudflare 账号
2. 按照 [`workers/share-api/README.md`](./workers/share-api/README.md) 的步骤操作
3. 将部署后得到的 Worker URL 设置到 `VITE_SHARE_API_URL`，然后重新构建前端

免费套餐每日 10 万请求，个人使用或小型 OSS 项目完全够用。

## 路线图

| 状态 | 功能 |
|---|---|
| :white_check_mark: | 核心渲染器（所有主要节点类型） |
| :white_check_mark: | Flex 布局 |
| :white_check_mark: | 渐变 / 模糊 / 阴影 |
| :white_check_mark: | 变量（`$token`）解析 |
| :white_check_mark: | 文件加载（拖放 / URL / 示例） |
| :white_check_mark: | 缩放 / 平移 / 画框导航 |
| :white_check_mark: | 响应式移动端布局 |
| :white_check_mark: | GitHub Pages 部署（免费） |
| :white_check_mark: | 主题切换（亮色 / 暗色变量） |
| :white_check_mark: | `ref`（组件实例）解析 |
| :white_check_mark: | `connection` / `note` 节点渲染 |
| :white_check_mark: | SVG / PNG 导出 |
| :white_check_mark: | URL 共享协同查看（Cloudflare Workers + KV） |

## 许可证

[MIT](./LICENSE)

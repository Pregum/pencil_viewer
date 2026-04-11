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
| :construction: | Theme switching (light / dark variables) |
| :construction: | `ref` (component instance) resolution |
| :construction: | Full `connection` / `note` node rendering |
| :construction: | Export to PNG / SVG |
| :construction: | Collaborative viewing via shared URL |

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
| :construction: | テーマ切替(light / dark 変数) |
| :construction: | `ref`(コンポーネントインスタンス)解決 |
| :construction: | `connection` / `note` ノード描画 |
| :construction: | PNG / SVG エクスポート |
| :construction: | URL 共有による共同閲覧 |

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
| :construction: | 主题切换（亮色 / 暗色变量） |
| :construction: | `ref`（组件实例）解析 |
| :construction: | `connection` / `note` 节点渲染 |
| :construction: | PNG / SVG 导出 |
| :construction: | URL 共享协同查看 |

## 许可证

[MIT](./LICENSE)

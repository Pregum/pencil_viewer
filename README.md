# Pencil Viewer

> **Open-source online viewer & editor for [Pencil.dev](https://www.pencil.dev/) `.pen` files.**
>
> Runs entirely in the browser. No server required. Free to host.

[**Live Demo**](https://pregum.github.io/pencil_viewer/) | [Report Bug](https://github.com/Pregum/pencil_viewer/issues) | [Request Feature](https://github.com/Pregum/pencil_viewer/issues)

---

## ✨ Featured: AI Design Review

> **Your AI design reviewer, built into the canvas.** Spot missing UI states, get instant feedback on consistency and accessibility, and **fix issues with one click** — without leaving the viewer.

| | |
|---|---|
| 🤖 **Powered by** | Cloudflare Workers AI (Llama 3.3 70B) |
| 📋 **Modes** | Full Review · Five UI States · Accessibility · Quick |
| ✨ **Killer feature** | One-click "Repair Candidates" — AI generates the missing Empty / Loading / Error / Partial frame in your existing design tokens |
| 🔒 **Privacy** | Stateless: no DB, no logs, no training data |
| 💰 **Cost** | $0 in the free tier (~50–125 reviews/day), no Workers Paid required |

**Try it:** Open any `.pen` file → `Cmd + Shift + P` → "AI Design Review" → choose "Five UI States" → click `+ Empty State` on a screen with missing coverage. The AI generates a new frame in matching style and drops it next to the original.

→ See the in-app **Docs** page for the full guide, or [`workers/ai-review/README.md`](./workers/ai-review/README.md) for self-hosting.

## Features

- 🤖 **AI Design Review** ✨ — Cloudflare Workers AI (Llama 3.3 70B) powered. Full / Five UI States / Accessibility / Quick modes. **One-click repair** of missing UI states with style-matching auto-generation. Stateless, free tier covers daily use.
- **3 ways to load files** --- drag & drop, `?src=<url>` query, or bundled samples
- **Full node support** --- rectangle, ellipse, line, polygon, path, text, frame (flex layout), group, icon_font (Material Symbols + Lucide)
- **Paint & effects** --- solid color, linear/radial gradients, image fills, blur, drop shadow
- **Variable resolution** --- `$token` references in fills, strokes, radii and more are resolved from the document's `variables` block
- **Flex layout engine** --- horizontal/vertical layout, justify/align, gap, padding, `fill_container`, `fit_content`
- **Figma-like canvas** --- zoom (Cmd+scroll), pan (scroll / Space+drag), frame navigation (Cmd+P)
- **Resilient rendering** --- unknown node types render as dashed placeholders; one broken node never crashes the whole view
- **Mobile-ready** --- responsive CSS hides editor panels on small screens for a pure viewing experience
- **Vim mode** --- hjkl navigation, EasyMotion hint labels (f/t), text objects (vif/vaf/vir/vic), insert mode, number prefix
- **Node editing** --- click to select, property panel (right side), drag to move, corner handles to resize, Backspace to delete
- **Command palette** --- Cmd+Shift+P, align/distribute commands, vim mode toggle
- **P2P collaborative editing** --- WebRTC + Yjs CRDT, no server data storage ("No trace, no server, no cost")
- **MCP / REST API bridge** --- Claude Code integration via localhost bridge, real-time sync, edit animation
- **.pen export** --- Cmd+S quick export, Cmd+Shift+S save as
- **Undo / Redo** --- Cmd+Z / Cmd+Shift+Z with smart granularity (drag = single undo)
- **Layers panel** --- left sidebar with collapsible node tree, auto-scroll to selected
- **Documentation** --- in-app docs page with EN/JA/ZH support
- **Frame search with minimap** --- Cmd+P with category labels, distance sorting, minimap preview
- **Auto ID** --- batch rename frames with prefix/suffix (Cmd+I)
- **Edit animation** --- scanner + pulse glow effect when nodes are edited via MCP
- **Five UI States Audit** --- automated design quality check for Empty/Loading/Error/Partial/Ideal states per screen
- **Design Doc Export** --- generate Markdown design documents with component structure, UI state coverage, and design tokens
- **Vision page** --- product vision and use-case documentation for PMs, designers, and engineers

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
| :white_check_mark: | Vim mode editing |
| :white_check_mark: | Node selection & property editing |
| :white_check_mark: | P2P collaborative editing (WebRTC) |
| :white_check_mark: | MCP / REST API bridge (Claude Code) |
| :white_check_mark: | In-app documentation (i18n) |
| :white_check_mark: | Edit animation effects |
| :white_check_mark: | Layers panel & frame search with minimap |
| :white_check_mark: | Five UI States audit |
| :white_check_mark: | Design document export (Markdown) |
| :white_check_mark: | Vision & Use Cases page |
| :white_check_mark: | Undo / Redo (Figma-equivalent granularity) |
| :white_check_mark: | AI Design Review (Cloudflare Workers AI) |
| :construction: | Figma Import (Figma API → .pen conversion) |
| :construction: | Notion API (direct page creation / update) |
| :construction: | CI Integration (GitHub Actions design review) |

### MCP / CLI Integration [BETA]

Pencil Viewer exposes a collab-bridge server that lets external tools --- including Claude Code and plain `curl` --- read and write nodes on the canvas in real time via WebRTC.

```bash
# Start the bridge (requires Node 18+)
cd tools/collab-bridge && npm start
```

Once running, Claude Code (or any HTTP client) can `GET` / `POST` against `http://localhost:<port>` to query nodes, push edits, and trigger edit animations. See [`tools/collab-bridge/README.md`](./tools/collab-bridge/README.md) for the full API reference and setup instructions.

### AI Design Review

> **The killer feature.** Pencil Viewer has a built-in AI design reviewer that runs on Cloudflare Workers AI (Llama 3.3 70B). It can analyze your screens for missing UI states, accessibility issues, and design consistency — and **fix them in one click**.

#### How to use

1. Open any `.pen` file (drag & drop, sample, or shared URL)
2. Press `Cmd + Shift + P` to open the command palette
3. Run **"AI Design Review"**
4. Choose a mode and click **"Run Review"**

#### Review modes

| Mode | What it analyzes | Best for |
|---|---|---|
| **Full Review** | Layout, typography, color, consistency, navigation, missing screens | Comprehensive audit before handoff |
| **Five UI States** | Empty / Loading / Error / Partial / Ideal coverage per screen | Catching edge-case screens |
| **Accessibility** | Contrast, touch targets, text size, WCAG compliance | Inclusive design review |
| **Quick Feedback** | 3–5 actionable bullet points | Rapid iteration during early sketches |

#### ✨ Five UI States Auto-Repair (Killer feature)

When the **Five UI States** review finds a screen missing an Empty / Loading / Error / Partial state, the panel surfaces **"🔧 Repair Candidates"** — a row of one-click buttons. Click `+ Empty State` on Home, and within seconds the AI generates a brand-new frame **in the same visual style as the original** (same colors, fonts, layout tokens) and drops it in your canvas right next to the source.

- 🎯 **Style-matching** — AI re-uses your existing `$bg`, `$primary`, `$text` design tokens
- ⚡ **Seconds, not hours** — A single Empty/Loading/Error placeholder takes 3–5 seconds vs 5–10 minutes by hand
- ↩️ **Fully undoable** — Cmd+Z reverts the addition
- 🔒 **Stateless & private** — Your design is processed in-memory, never stored

#### Setup (self-hosting)

This feature is **entirely optional** — the viewer works fully without it. The AI Review panel only appears when `VITE_AI_REVIEW_URL` is set at build time. To enable it on your fork:

```bash
# 1. Deploy the Worker
cd workers/ai-review
cp wrangler.toml.example wrangler.toml
npm install
npx wrangler login
npx wrangler deploy

# 2. Set the URL in your repo
gh variable set VITE_AI_REVIEW_URL --body "https://pencil-ai-review.YOUR.workers.dev"

# 3. Trigger a rebuild
git commit --allow-empty -m "ci: enable AI Review"
git push
```

| Item | Cost |
|---|---|
| Workers Plan | Free tier works (Workers Paid not required) |
| Free quota | 10,000 neurons / day (~50–125 reviews) |
| Beyond free | $0.293 / 1M input tokens · $2.253 / 1M output tokens |
| **Typical monthly cost** | **$0** for personal use |

## License

[MIT](./LICENSE)

---

# Pencil Viewer (日本語)

> **[Pencil.dev](https://www.pencil.dev/) の `.pen` ファイルを表示・編集するオープンソースのオンラインビュワー。**
>
> 完全にブラウザ上で動作。サーバー不要。ホスティング無料。

## ✨ 注目機能: AI デザインレビュー

> **AI デザインレビュアーが、ビューアの中に常駐。** 不足している UI ステートを検出、一貫性・アクセシビリティの問題を即座に指摘し、**ワンクリックで修復**まで完結します — ビューアから離れることなく。

| | |
|---|---|
| 🤖 **使用モデル** | Cloudflare Workers AI (Llama 3.3 70B) |
| 📋 **モード** | 総合レビュー · Five UI States · アクセシビリティ · クイック |
| ✨ **キラー機能** | ワンクリック「修復候補」 — AI が既存のデザイントークンを使って Empty / Loading / Error / Partial フレームを自動生成 |
| 🔒 **プライバシー** | ステートレス: DB なし、ログなし、学習データに使われない |
| 💰 **コスト** | 無料枠で $0(1 日 50〜125 リクエスト相当)、Workers Paid 不要 |

**試し方:** 任意の `.pen` ファイルを開く → `Cmd + Shift + P` → 「AI Design Review」 → 「Five UI States」モード → 不足してる画面の `+ 空状態` ボタンをクリック。AI が同じスタイルで新しいフレームを生成し、元の右隣に配置します。

→ 詳しい使い方は アプリ内の **Docs** ページを開くか、[`workers/ai-review/README.md`](./workers/ai-review/README.md) を参照。

## 特徴

- 🤖 **AI デザインレビュー** ✨ --- Cloudflare Workers AI(Llama 3.3 70B)を使用。総合 / Five UI States / アクセシビリティ / クイック の 4 モード。**ワンクリックで欠けた UI ステートをスタイル一致で自動生成**。ステートレス、無料枠で日常利用十分。
- **3 つのファイル読み込み方法** --- ドラッグ & ドロップ / `?src=<url>` クエリ / バンドルサンプル
- **全主要ノード対応** --- rectangle / ellipse / line / polygon / path / text / frame(flex レイアウト) / group / icon_font(Material Symbols + Lucide)
- **塗り & 効果** --- ソリッド色 / 線形・放射グラデーション / 画像パターン / ぼかし / ドロップシャドウ
- **変数解決** --- fill / stroke / cornerRadius 等の `$token` 参照をドキュメントの `variables` ブロックから自動解決
- **Flex レイアウトエンジン** --- horizontal / vertical / justify / align / gap / padding / fill_container / fit_content
- **Figma ライクなキャンバス操作** --- ズーム(Cmd+スクロール) / パン(スクロール / Space+ドラッグ) / フレームナビゲーション(Cmd+P)
- **未対応ノードに耐性** --- 未知の `type` は破線プレースホルダで表示、全体描画は止まらない
- **モバイル対応** --- レスポンシブ CSS で小画面では編集パネルを非表示にし、閲覧に特化
- **Vim モード** --- hjkl ナビゲーション、EasyMotion ヒントラベル(f/t)、テキストオブジェクト(vif/vaf/vir/vic)、挿入モード、数値プレフィクス
- **ノード編集** --- クリックで選択、プロパティパネル(右側)、ドラッグで移動、コーナーハンドルでリサイズ、Backspace で削除
- **コマンドパレット** --- Cmd+Shift+P、整列・分配コマンド、Vim モード切替
- **P2P 共同編集** --- WebRTC + Yjs CRDT、サーバーにデータを保存しない(「No trace, no server, no cost」)
- **MCP / REST API ブリッジ** --- Claude Code 連携(localhost ブリッジ経由)、リアルタイム同期、編集アニメーション
- **.pen エクスポート** --- Cmd+S で即時保存、Cmd+Shift+S で名前を付けて保存
- **元に戻す / やり直す** --- Cmd+Z / Cmd+Shift+Z、スマート粒度(ドラッグ = 1 回の取り消し)
- **レイヤーパネル** --- 左サイドバーに折りたたみ可能なノードツリー、選択ノードへ自動スクロール
- **ドキュメント** --- アプリ内ドキュメントページ(EN/JA/ZH 対応)
- **フレーム検索 + ミニマップ** --- Cmd+P でカテゴリラベル、距離順ソート、ミニマッププレビュー
- **Auto ID** --- フレームの一括リネーム(プレフィクス / サフィックス指定、Cmd+I)
- **編集アニメーション** --- MCP 経由でノード編集時にスキャナー + パルスグローエフェクト
- **Five UI States 監査** --- 各画面の Empty/Loading/Error/Partial/Ideal 状態を自動チェックするデザイン品質監査
- **デザインドキュメントエクスポート** --- コンポーネント構造、UI 状態カバレッジ、デザイントークンを含む Markdown デザインドキュメントを生成
- **ビジョンページ** --- PM・デザイナー・エンジニア向けのプロダクトビジョンとユースケースドキュメント

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
| :white_check_mark: | Vim モード編集 |
| :white_check_mark: | ノード選択 & プロパティ編集 |
| :white_check_mark: | P2P 共同編集(WebRTC) |
| :white_check_mark: | MCP / REST API ブリッジ(Claude Code) |
| :white_check_mark: | アプリ内ドキュメント(i18n) |
| :white_check_mark: | 編集アニメーション |
| :white_check_mark: | レイヤーパネル & フレーム検索 + ミニマップ |
| :white_check_mark: | Five UI States 監査 |
| :white_check_mark: | デザインドキュメントエクスポート(Markdown) |
| :white_check_mark: | ビジョン & ユースケースページ |
| :white_check_mark: | Undo / Redo (Figma 同等の粒度) |
| :white_check_mark: | AI デザインレビュー (Cloudflare Workers AI) |
| :construction: | Figma インポート (Figma API → .pen 変換) |
| :construction: | Notion API (ページ直接作成/更新) |
| :construction: | CI 連携 (GitHub Actions デザインレビュー) |

### MCP / CLI 連携 [BETA]

Pencil Viewer は collab-bridge サーバーを提供しており、Claude Code や `curl` などの外部ツールから WebRTC 経由でキャンバス上のノードをリアルタイムに読み書きできます。

```bash
# ブリッジの起動(Node 18+ が必要)
cd tools/collab-bridge && npm start
```

起動後、Claude Code(または任意の HTTP クライアント)が `http://localhost:<port>` に対して `GET` / `POST` を実行し、ノードの取得・編集・編集アニメーションのトリガーが可能です。詳しい API リファレンスとセットアップ手順は [`tools/collab-bridge/README.md`](./tools/collab-bridge/README.md) を参照してください。

### AI デザインレビュー [BETA]

Pencil Viewer は Cloudflare Workers AI（Llama 3.1）と連携し、キャンバスから直接 AI によるデザイン分析を行えます。**この機能は完全に任意です** --- 無効でもビューアの全機能は使えます。

**セットアップ:**

```bash
cd workers/ai-review && cp wrangler.toml.example wrangler.toml && npm install && npx wrangler deploy
```

デプロイ後、`VITE_AI_REVIEW_URL` をリポジトリ変数（または `.env`）に設定してフロントエンドを再ビルドします。

**レビューモード:**

| モード | 説明 |
|---|---|
| フルレビュー | レイアウト、タイポグラフィ、色、一貫性を包括的に分析 |
| Five UI States | Empty / Loading / Error / Partial / Ideal 状態のカバレッジを確認 |
| アクセシビリティ | コントラスト、タッチターゲット、スクリーンリーダー対応、WCAG 準拠を評価 |
| クイックフィードバック | 素早い反復のための短く実用的なフィードバック |

> **注意:** この機能は任意で、$0（Cloudflare Workers AI 無料枠）、完全にステートレスです --- デザインデータはサーバーに保存されません。

## ライセンス

[MIT](./LICENSE)

---

# Pencil Viewer (中文)

> **[Pencil.dev](https://www.pencil.dev/) `.pen` 文件的开源在线查看器和编辑工具。**
>
> 完全在浏览器中运行。无需服务器。免费托管。

## ✨ 重点功能：AI 设计审查

> **集成在画布中的 AI 设计审查员。** 一键发现缺失的 UI 状态、获得即时的一致性和无障碍性反馈,并在不离开查看器的情况下**一键修复**。

| | |
|---|---|
| 🤖 **使用模型** | Cloudflare Workers AI (Llama 3.3 70B) |
| 📋 **模式** | 全面审查 · Five UI States · 无障碍性 · 快速反馈 |
| ✨ **杀手级功能** | 一键"修复候选" — AI 使用现有设计令牌自动生成 Empty / Loading / Error / Partial 画面 |
| 🔒 **隐私** | 无状态:无数据库、无日志、不用于训练数据 |
| 💰 **成本** | 免费额度内 $0(每天约 50-125 次审查)、无需 Workers Paid |

**试用方法：** 打开任何 `.pen` 文件 → `Cmd + Shift + P` → "AI Design Review" → 选择 "Five UI States" → 点击缺失画面上的 `+ 空状态` 按钮。AI 会以匹配的样式生成新画面并放置在原始画面右侧。

→ 详情请查看应用内 **Docs** 页面,或参阅 [`workers/ai-review/README.md`](./workers/ai-review/README.md)。

## 功能

- 🤖 **AI 设计审查** ✨ --- Cloudflare Workers AI（Llama 3.3 70B）驱动的设计分析。全面审查 / Five UI States / 无障碍性 / 快速反馈 四种模式。**一键修复缺失的 UI 状态,自动匹配视觉样式**。无状态,免费额度足以日常使用。
- **3 种文件加载方式** --- 拖放 / `?src=<url>` 查询参数 / 内置示例
- **全节点支持** --- rectangle / ellipse / line / polygon / path / text / frame（flex 布局）/ group / icon_font（Material Symbols + Lucide）
- **填充与特效** --- 纯色 / 线性渐变 / 径向渐变 / 图像填充 / 模糊 / 阴影
- **变量解析** --- 自动解析文档 `variables` 块中的 `$token` 引用（填充、描边、圆角等）
- **Flex 布局引擎** --- horizontal / vertical / justify / align / gap / padding / fill_container / fit_content
- **类 Figma 画布操作** --- 缩放（Cmd+滚轮）/ 平移（滚轮 / Space+拖拽）/ 画框导航（Cmd+P）
- **容错渲染** --- 未知节点类型以虚线占位符显示，不影响整体渲染
- **移动端适配** --- 响应式 CSS，小屏幕自动隐藏编辑面板，专注查看体验
- **Vim 模式** --- hjkl 导航、EasyMotion 提示标签（f/t）、文本对象（vif/vaf/vir/vic）、插入模式、数字前缀
- **节点编辑** --- 点击选中、属性面板（右侧）、拖动移动、角柄缩放、Backspace 删除
- **命令面板** --- Cmd+Shift+P、对齐/分布命令、Vim 模式切换
- **P2P 协同编辑** --- WebRTC + Yjs CRDT，服务器不存储数据（"No trace, no server, no cost"）
- **MCP / REST API 桥接** --- 通过 localhost 桥接集成 Claude Code，实时同步，编辑动画
- **.pen 导出** --- Cmd+S 快速导出、Cmd+Shift+S 另存为
- **撤销 / 重做** --- Cmd+Z / Cmd+Shift+Z，智能粒度（拖动 = 单次撤销）
- **图层面板** --- 左侧边栏可折叠节点树，自动滚动到选中节点
- **文档** --- 应用内文档页面，支持 EN/JA/ZH
- **画框搜索 + 小地图** --- Cmd+P 带分类标签、距离排序、小地图预览
- **Auto ID** --- 批量重命名画框（前缀/后缀，Cmd+I）
- **编辑动画** --- 通过 MCP 编辑节点时触发扫描线 + 脉冲辉光效果
- **Five UI States 审计** --- 自动检查每个画面的 Empty/Loading/Error/Partial/Ideal 状态，进行设计质量审计
- **设计文档导出** --- 生成包含组件结构、UI 状态覆盖率和设计令牌的 Markdown 设计文档
- **愿景页面** --- 面向产品经理、设计师和工程师的产品愿景与用例文档

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
| :white_check_mark: | Vim 模式编辑 |
| :white_check_mark: | 节点选择与属性编辑 |
| :white_check_mark: | P2P 协同编辑（WebRTC） |
| :white_check_mark: | MCP / REST API 桥接（Claude Code） |
| :white_check_mark: | 应用内文档（i18n） |
| :white_check_mark: | 编辑动画效果 |
| :white_check_mark: | 图层面板与画框搜索 + 小地图 |
| :white_check_mark: | Five UI States 审计 |
| :white_check_mark: | 设计文档导出（Markdown） |
| :white_check_mark: | 愿景与用例页面 |
| :white_check_mark: | 撤销 / 重做（Figma 等效粒度） |
| :white_check_mark: | AI 设计审查（Cloudflare Workers AI） |
| :construction: | Figma 导入（Figma API → .pen 转换） |
| :construction: | Notion API（直接创建/更新页面） |
| :construction: | CI 集成（GitHub Actions 设计审查） |

### MCP / CLI 集成 [BETA]

Pencil Viewer 提供 collab-bridge 服务器，允许 Claude Code 和 `curl` 等外部工具通过 WebRTC 实时读写画布上的节点。

```bash
# 启动桥接（需要 Node 18+）
cd tools/collab-bridge && npm start
```

启动后，Claude Code（或任意 HTTP 客户端）可对 `http://localhost:<port>` 发送 `GET` / `POST` 请求，查询节点、推送编辑、触发编辑动画。完整的 API 参考和配置说明请参阅 [`tools/collab-bridge/README.md`](./tools/collab-bridge/README.md)。

### AI 设计审查 [BETA]

Pencil Viewer 集成了 Cloudflare Workers AI（Llama 3.1），可直接从画布进行 AI 驱动的设计分析。**此功能完全可选** --- 不启用也不影响查看器的任何功能。

**设置：**

```bash
cd workers/ai-review && cp wrangler.toml.example wrangler.toml && npm install && npx wrangler deploy
```

部署后，在仓库变量（或 `.env`）中设置 `VITE_AI_REVIEW_URL`，然后重新构建前端。

**审查模式：**

| 模式 | 说明 |
|---|---|
| 全面审查 | 涵盖布局、排版、颜色和一致性的综合设计分析 |
| Five UI States | 检查 Empty / Loading / Error / Partial / Ideal 状态的覆盖情况 |
| 无障碍性 | 评估对比度、触摸目标、屏幕阅读器友好性和 WCAG 合规性 |
| 快速反馈 | 用于快速迭代的简短可操作反馈 |

> **注意：** 此功能可选，$0 成本（Cloudflare Workers AI 免费套餐），完全无状态 --- 不会在服务器上存储任何设计数据。

## 许可证

[MIT](./LICENSE)

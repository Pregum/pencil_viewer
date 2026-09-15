# promo — 紹介記事と紹介動画

Pencil Viewer を紹介するための素材置き場。アプリ本体のビルドには含まれません。

```
promo/
  blog/hatena-intro.md      はてなブログ用の紹介記事（Markdown モードで貼る）
  public/shots/*.png        実画面のスクリーンショット（記事と動画の両方で使う）
  src/                      Remotion の紹介動画
  out/                      レンダリング結果（git 管理外）
```

## 紹介動画（Remotion）

```bash
cd promo
npm install
npm run studio    # プレビュー（http://localhost:3000）
npm run render    # out/pencil-viewer-intro.mp4  1920x1080 / 30fps / 約 48 秒
npm run render:gif # out/pencil-viewer-intro.gif 短縮版（はてなに直接貼れる）
```

`--browser-executable` でシステムの Google Chrome を使うようスクリプトに書いてあるため、
Remotion 用の Chrome Headless Shell（100MB 超）をダウンロードせずにレンダリングできます。

日本語は Web フォントを取りに行かず、macOS のヒラギノ（`"Hiragino Sans"`）で描画しています。
別 OS でレンダリングする場合は `src/theme.ts` の `FONT.sans` を差し替えてください。

構成は `src/Intro.tsx` の `INTRO_SCENES` にシーンと尺（フレーム数 / 30fps）が並んでいるだけです。
シーンの中身は `src/scenes.tsx`、共通パーツは `src/components.tsx`。

## スクリーンショットの撮り直し

`public/shots/*.png` はアプリの本番ビルドを headless Chrome で開いて撮ったものです。
撮り直すときは、リポジトリのルートで以下を実行してからスクリプトを回します。

```bash
VITE_BASE=/ npm run build
npm run preview -- --port 4177
```

撮影は CDP（Chrome DevTools Protocol）で「パネルを畳む → Fit → 少しズームアウト → 撮影」の順に行います。
注意点として、ツールバーの `title="Hide (Cmd+Shift+H)"` は**パネルではなくノードを非表示にする**ボタンなので、
パネルを畳む処理では `Hide Pages` / `Hide Components` / `Hide Layers` / `Hide Properties` だけを対象にしてください。

## はてなブログに載せるとき

1. 記事は Markdown モードで `blog/hatena-intro.md` の中身を貼る。
2. 画像は `public/shots/*.png` をはてなフォトライフにアップロードし、
   記事中の `![...](../public/shots/xxx.png)` を、はてなが生成する記法に差し替える。
3. **はてなフォトライフは mp4 を置けません。** 動画は YouTube にアップロードして URL を単独行に置くか、
   `npm run render:gif` で作った GIF をフォトライフに上げて貼ってください。

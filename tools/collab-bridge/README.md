# Pencil Collab Bridge [BETA]

> **Claude Code から Pencil Viewer をリアルタイム編集する MCP ブリッジ。**

## 仕組み

```
┌─────────────┐   WebSocket    ┌──────────────┐   MCP (stdio)   ┌─────────────┐
│  Browser     │◄─────────────►│ Collab Bridge │◄───────────────►│ Claude Code │
│  (Viewer)    │  localhost:4567│  (Node.js)    │                 │             │
└─────────────┘               └──────────────┘                 └─────────────┘
```

- ブラウザとブリッジが WebSocket で Yjs ドキュメントを同期
- Claude Code が MCP プロトコルでブリッジに接続し、ノードを読み書き
- 変更はリアルタイムでブラウザに反映

## セットアップ

### 1. ブリッジを起動

```bash
cd tools/collab-bridge
npm install
node index.js
```

### 2. ブラウザで接続

1. Pencil Viewer で .pen ファイルを開く
2. ツールバーの「**MCP**」ボタンをクリック
3. ⚡ Bridge 表示に変わったら接続完了

### 3. Claude Code の MCP 設定

`.claude/settings.json` または `.mcp.json` に追加:

```json
{
  "mcpServers": {
    "pencil-collab": {
      "command": "node",
      "args": ["tools/collab-bridge/index.js"],
      "cwd": "/path/to/pencil_viewer"
    }
  }
}
```

## MCP ツール

| ツール | 説明 |
|---|---|
| `list_frames` | ドキュメント内の全フレーム一覧 |
| `read_node(id)` | ノードのプロパティを取得 |
| `update_node(id, patch)` | ノードのプロパティを更新 |
| `get_document` | ドキュメント全体を取得 |
| `get_status` | ブリッジの接続状態を確認 |

## 使用例

```
Claude> フレーム一覧を見せて
→ list_frames

Claude> ヘッダーの色を青に変えて
→ update_node("header-id", {"fill": "#2563eb"})
→ ブラウザにリアルタイム反映！
```

## 注意事項

- **BETA 機能**: API は変更される可能性があります
- データはメモリ上のみ。ブリッジを停止するとデータは消えます
- セキュリティ: localhost のみで接続。外部公開しないでください

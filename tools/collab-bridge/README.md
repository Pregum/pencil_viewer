# Pencil Collab Bridge [BETA]

> **Real-time MCP bridge for editing Pencil Viewer from Claude Code.**

## How it works

```
┌─────────────┐   WebSocket    ┌──────────────┐   MCP (stdio)   ┌─────────────┐
│  Browser     │◄─────────────►│ Collab Bridge │◄───────────────►│ Claude Code │
│  (Viewer)    │  localhost:4567│  (Node.js)    │                 │             │
└─────────────┘               └──────────────┘                 └─────────────┘
```

- Browser and bridge sync the Yjs document via WebSocket
- Claude Code connects to the bridge via MCP protocol to read/write nodes
- Changes are reflected in real-time in the browser

## Setup

### 1. Start the bridge

```bash
cd tools/collab-bridge
npm install
node index.js
```

### 2. Connect from the browser

1. Open a `.pen` file in Pencil Viewer
2. Click the "**MCP**" button in the toolbar
3. When it changes to ⚡ **Bridge**, you're connected

### 3. Configure Claude Code MCP

Add to `.claude/settings.json` or `.mcp.json`:

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

## REST API

You can also use the bridge via HTTP without MCP:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/status` | Bridge status |
| GET | `/document` | Full document JSON |
| GET | `/frames` | Frame list |
| GET | `/node/:id` | Read a node |
| PUT | `/node/:id` | Update a node (body: patch JSON) |
| POST | `/document` | Set full document |

```bash
# List frames
curl http://localhost:4567/frames

# Update a node's fill color
curl -X PUT http://localhost:4567/node/abc123 \
  -H 'Content-Type: application/json' \
  -d '{"fill": "#ff0000"}'
```

## MCP Tools

| Tool | Description |
|---|---|
| `list_frames` | List all frames in the document |
| `read_node(id)` | Get a node's properties |
| `update_node(id, patch)` | Update a node's properties |
| `get_document` | Get the full document |
| `get_status` | Check bridge connection status |

## Example

```
Claude> Show me the frame list
→ list_frames

Claude> Change the header color to blue
→ update_node("header-id", {"fill": "#2563eb"})
→ Reflected in the browser in real-time!
```

## Notes

- **BETA**: API may change
- Data is in-memory only. Stopping the bridge erases all data
- Security: localhost only. Do not expose to the internet

---

# Pencil Collab Bridge [BETA] (日本語)

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

1. Pencil Viewer で `.pen` ファイルを開く
2. ツールバーの「**MCP**」ボタンをクリック
3. ⚡ **Bridge** 表示に変わったら接続完了

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

## REST API

MCP を使わず HTTP でも操作できます:

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/status` | ブリッジの状態 |
| GET | `/document` | ドキュメント全体 |
| GET | `/frames` | フレーム一覧 |
| GET | `/node/:id` | ノード取得 |
| PUT | `/node/:id` | ノード更新（body: パッチ JSON） |
| POST | `/document` | ドキュメント全体を設定 |

```bash
# フレーム一覧を取得
curl http://localhost:4567/frames

# ノードの fill 色を変更
curl -X PUT http://localhost:4567/node/abc123 \
  -H 'Content-Type: application/json' \
  -d '{"fill": "#ff0000"}'
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

---

# Pencil Collab Bridge [BETA] (中文)

> **通过 MCP 从 Claude Code 实时编辑 Pencil Viewer 的桥接工具。**

## 工作原理

```
┌─────────────┐   WebSocket    ┌──────────────┐   MCP (stdio)   ┌─────────────┐
│  Browser     │◄─────────────►│ Collab Bridge │◄───────────────►│ Claude Code │
│  (Viewer)    │  localhost:4567│  (Node.js)    │                 │             │
└─────────────┘               └──────────────┘                 └─────────────┘
```

- 浏览器和桥接通过 WebSocket 同步 Yjs 文档
- Claude Code 通过 MCP 协议连接桥接，读写节点
- 更改实时反映在浏览器中

## 设置

### 1. 启动桥接

```bash
cd tools/collab-bridge
npm install
node index.js
```

### 2. 从浏览器连接

1. 在 Pencil Viewer 中打开 `.pen` 文件
2. 点击工具栏中的 "**MCP**" 按钮
3. 当显示 ⚡ **Bridge** 时，连接成功

### 3. 配置 Claude Code MCP

添加到 `.claude/settings.json` 或 `.mcp.json`:

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

## REST API

也可以通过 HTTP 直接操作，无需 MCP:

| 方法 | 端点 | 说明 |
|---|---|---|
| GET | `/status` | 桥接状态 |
| GET | `/document` | 完整文档 JSON |
| GET | `/frames` | 画框列表 |
| GET | `/node/:id` | 读取节点 |
| PUT | `/node/:id` | 更新节点（body: 补丁 JSON） |
| POST | `/document` | 设置完整文档 |

```bash
# 获取画框列表
curl http://localhost:4567/frames

# 更新节点的填充颜色
curl -X PUT http://localhost:4567/node/abc123 \
  -H 'Content-Type: application/json' \
  -d '{"fill": "#ff0000"}'
```

## MCP 工具

| 工具 | 说明 |
|---|---|
| `list_frames` | 列出文档中的所有画框 |
| `read_node(id)` | 获取节点属性 |
| `update_node(id, patch)` | 更新节点属性 |
| `get_document` | 获取完整文档 |
| `get_status` | 检查桥接连接状态 |

## 示例

```
Claude> 显示画框列表
→ list_frames

Claude> 把标题颜色改成蓝色
→ update_node("header-id", {"fill": "#2563eb"})
→ 实时反映在浏览器中！
```

## 注意事项

- **BETA 功能**: API 可能会变更
- 数据仅存储在内存中。停止桥接后数据将消失
- 安全性: 仅限 localhost 连接。请勿暴露到互联网

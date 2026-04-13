#!/usr/bin/env node
/**
 * Pencil Collab Bridge — WebSocket サーバー + MCP サーバー
 *
 * 1. WebSocket サーバー (localhost:4567) で Yjs ドキュメントを共有
 * 2. stdin/stdout で MCP プロトコルを提供（Claude Code 連携）
 *
 * 使い方:
 *   node tools/collab-bridge/index.js          # 起動
 *   ブラウザで Collab → "MCP Bridge" を ON     # ブラウザ接続
 *   Claude Code の MCP 設定に追加              # AI 連携
 *
 * [BETA] この機能は実験的です。
 */

import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { createInterface } from 'readline';

const PORT = parseInt(process.env.PORT ?? '4567', 10);

// ── Yjs Document ──
const ydoc = new Y.Doc();
const ymap = ydoc.getMap('pen-document');

// ── WebSocket Server (Yjs sync) ──
const wss = new WebSocketServer({ port: PORT });
const clients = new Set();

function broadcast(data, sender) {
  for (const ws of clients) {
    if (ws !== sender && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

wss.on('connection', (ws) => {
  clients.add(ws);
  log(`Client connected (${clients.size} total)`);

  // Send current state
  const state = Y.encodeStateAsUpdate(ydoc);
  ws.send(JSON.stringify({ type: 'sync-step-1', data: Array.from(state) }));

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'yjs-update') {
        const update = new Uint8Array(parsed.data);
        Y.applyUpdate(ydoc, update);
        broadcast(msg, ws);
      } else if (parsed.type === 'sync-step-1') {
        // Client sending its state
        const update = new Uint8Array(parsed.data);
        Y.applyUpdate(ydoc, update);
      } else if (parsed.type === 'pen-doc') {
        // Full document update from browser
        ydoc.transact(() => {
          ymap.set('version', parsed.doc.version ?? '1.0');
          ymap.set('children', JSON.stringify(parsed.doc.children));
          if (parsed.doc.variables) ymap.set('variables', JSON.stringify(parsed.doc.variables));
        });
        broadcast(msg, ws);
      }
    } catch {
      // ignore
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    log(`Client disconnected (${clients.size} total)`);
  });
});

// ── Helper: get current PenDocument from Yjs ──
function getPenDoc() {
  const version = ymap.get('version') ?? '1.0';
  const childrenStr = ymap.get('children');
  const variablesStr = ymap.get('variables');
  if (!childrenStr) return { version, children: [] };
  try {
    return {
      version,
      children: JSON.parse(childrenStr),
      variables: variablesStr ? JSON.parse(variablesStr) : undefined,
    };
  } catch {
    return { version, children: [] };
  }
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function updateNode(nodes, id, patch) {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, ...patch };
    if (n.children) return { ...n, children: updateNode(n.children, id, patch) };
    return n;
  });
}

function listFrames(nodes, result = []) {
  for (const n of nodes) {
    if (n.type === 'frame' || n.type === 'group') {
      result.push({ id: n.id, name: n.name ?? n.id, type: n.type, x: n.x, y: n.y, width: n.width, height: n.height });
    }
    if (n.children) listFrames(n.children, result);
  }
  return result;
}

// ── MCP Server (stdio JSON-RPC) ──
const rl = createInterface({ input: process.stdin });

const TOOLS = [
  {
    name: 'list_frames',
    description: 'List all frames in the document',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'read_node',
    description: 'Read a node by ID',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Node ID' } },
      required: ['id'],
    },
  },
  {
    name: 'update_node',
    description: 'Update a node property (e.g. fill, content, x, y, width, height)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Node ID' },
        patch: { type: 'object', description: 'Properties to update (e.g. {"fill": "#ff0000", "content": "Hello"})' },
      },
      required: ['id', 'patch'],
    },
  },
  {
    name: 'get_document',
    description: 'Get the full PenDocument JSON',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_status',
    description: 'Get bridge status (connected clients, room info)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

function handleMcpRequest(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return respond(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'pencil-collab-bridge', version: '0.1.0' },
      capabilities: { tools: {} },
    });
  }

  if (method === 'tools/list') {
    return respond(id, { tools: TOOLS });
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments ?? {};
    const doc = getPenDoc();

    switch (toolName) {
      case 'list_frames': {
        const frames = listFrames(doc.children);
        return respond(id, {
          content: [{ type: 'text', text: JSON.stringify(frames, null, 2) }],
        });
      }
      case 'read_node': {
        const node = findNode(doc.children, args.id);
        if (!node) {
          return respond(id, {
            content: [{ type: 'text', text: `Node not found: ${args.id}` }],
            isError: true,
          });
        }
        return respond(id, {
          content: [{ type: 'text', text: JSON.stringify(node, null, 2) }],
        });
      }
      case 'update_node': {
        const updated = updateNode(doc.children, args.id, args.patch);
        ydoc.transact(() => {
          ymap.set('children', JSON.stringify(updated));
        });
        // Broadcast to browser clients
        const newDoc = getPenDoc();
        broadcastDoc(newDoc);
        return respond(id, {
          content: [{ type: 'text', text: `Updated node ${args.id}` }],
        });
      }
      case 'get_document': {
        return respond(id, {
          content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }],
        });
      }
      case 'get_status': {
        return respond(id, {
          content: [{
            type: 'text',
            text: JSON.stringify({
              wsPort: PORT,
              connectedClients: clients.size,
              hasDocument: ymap.size > 0,
              nodeCount: doc.children.length,
            }, null, 2),
          }],
        });
      }
      default:
        return respond(id, {
          content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
          isError: true,
        });
    }
  }

  // notifications (no response needed)
  if (method === 'notifications/initialized') return;

  // Unknown method
  return respondError(id, -32601, `Method not found: ${method}`);
}

function respond(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(msg + '\n');
}

function respondError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(msg + '\n');
}

function broadcastDoc(doc) {
  const msg = JSON.stringify({ type: 'pen-doc', doc });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function log(msg) {
  process.stderr.write(`[collab-bridge] ${msg}\n`);
}

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    handleMcpRequest(msg);
  } catch {
    // ignore
  }
});

log(`WebSocket server listening on ws://localhost:${PORT}`);
log('MCP server ready on stdin/stdout');
log('Waiting for connections...');

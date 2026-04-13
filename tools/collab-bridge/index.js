#!/usr/bin/env node
/**
 * Pencil Collab Bridge — WebSocket + HTTP REST + MCP サーバー
 *
 * 3つのインターフェースを同時に提供:
 *   1. WebSocket (ws://localhost:4567)  — ブラウザとリアルタイム同期
 *   2. HTTP REST  (http://localhost:4567) — CLI / curl / 外部ツール連携
 *   3. MCP (stdin/stdout)               — Claude Code 連携
 *
 * [BETA] この機能は実験的です。
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { createInterface } from 'readline';

const PORT = parseInt(process.env.PORT ?? '4567', 10);

// ── Yjs Document ──
const ydoc = new Y.Doc();
const ymap = ydoc.getMap('pen-document');

// ── HTTP Server ──
const httpServer = createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    // GET /status
    if (req.method === 'GET' && path === '/status') {
      return json(res, {
        wsPort: PORT,
        connectedClients: wsClients.size,
        hasDocument: ymap.size > 0,
        nodeCount: getPenDoc().children.length,
      });
    }

    // GET /document
    if (req.method === 'GET' && path === '/document') {
      return json(res, getPenDoc());
    }

    // GET /frames
    if (req.method === 'GET' && path === '/frames') {
      return json(res, listFrames(getPenDoc().children));
    }

    // GET /node/:id
    if (req.method === 'GET' && path.startsWith('/node/')) {
      const id = path.slice(6);
      const node = findNode(getPenDoc().children, id);
      if (!node) return json(res, { error: `Node not found: ${id}` }, 404);
      return json(res, node);
    }

    // PUT /node/:id  — body: { ...patch }
    if (req.method === 'PUT' && path.startsWith('/node/')) {
      const id = path.slice(6);
      const body = await readBody(req);
      const patch = JSON.parse(body);
      const doc = getPenDoc();
      const updated = updateNode(doc.children, id, patch);
      ydoc.transact(() => { ymap.set('children', JSON.stringify(updated)); });
      broadcastDoc(getPenDoc());
      return json(res, { ok: true, id });
    }

    // POST /document — body: full PenDocument
    if (req.method === 'POST' && path === '/document') {
      const body = await readBody(req);
      const doc = JSON.parse(body);
      ydoc.transact(() => {
        ymap.set('version', doc.version ?? '1.0');
        ymap.set('children', JSON.stringify(doc.children));
        if (doc.variables) ymap.set('variables', JSON.stringify(doc.variables));
      });
      broadcastDoc(getPenDoc());
      return json(res, { ok: true });
    }

    // GET /check-ui-states
    if (req.method === 'GET' && path === '/check-ui-states') {
      const doc = getPenDoc();
      const results = analyzeUIStates(doc);
      return json(res, { report: formatReport(results), data: results });
    }

    // 404
    json(res, { error: 'Not found' }, 404);
  } catch (e) {
    json(res, { error: String(e) }, 500);
  }
});

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// ── WebSocket Server (同じ HTTP サーバー上) ──
const wss = new WebSocketServer({ server: httpServer });
const wsClients = new Set();

function broadcast(data, sender) {
  for (const ws of wsClients) {
    if (ws !== sender && ws.readyState === 1) ws.send(data);
  }
}

function broadcastDoc(doc) {
  const msg = JSON.stringify({ type: 'pen-doc', doc });
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

wss.on('connection', (ws) => {
  wsClients.add(ws);
  log(`WebSocket client connected (${wsClients.size} total)`);

  // Send current state
  const doc = getPenDoc();
  if (doc.children.length > 0) {
    ws.send(JSON.stringify({ type: 'pen-doc', doc }));
  }

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'pen-doc' && parsed.doc) {
        ydoc.transact(() => {
          ymap.set('version', parsed.doc.version ?? '1.0');
          ymap.set('children', JSON.stringify(parsed.doc.children));
          if (parsed.doc.variables) ymap.set('variables', JSON.stringify(parsed.doc.variables));
        });
        broadcast(msg, ws);
      }
    } catch { /* ignore */ }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    log(`WebSocket client disconnected (${wsClients.size} total)`);
  });
});

// ── Document helpers ──
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
  } catch { return { version, children: [] }; }
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) { const f = findNode(n.children, id); if (f) return f; }
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

// ── Five UI States Analyzer ──
const STATE_PATTERNS = [
  { state: 'empty', patterns: [/empty/i, /no.?data/i, /no.?result/i, /no.?item/i, /zero.?state/i, /blank/i, /空/i, /データなし/i, /結果なし/i, /未登録/i, /まだ/i] },
  { state: 'loading', patterns: [/loading/i, /spinner/i, /skeleton/i, /shimmer/i, /progress/i, /読み込み/i, /ロード/i] },
  { state: 'error', patterns: [/error/i, /fail/i, /404/i, /500/i, /offline/i, /エラー/i, /失敗/i, /not.?found/i] },
  { state: 'partial', patterns: [/partial/i, /incomplete/i, /limited/i, /部分/i, /一部/i, /制限/i] },
];

function inferState(name) {
  for (const { state, patterns } of STATE_PATTERNS) {
    if (patterns.some(p => p.test(name))) return state;
  }
  return 'ideal';
}

function extractScreenName(name) {
  let clean = name.replace(/^WF:\s*/i, '').replace(/^Screen:\s*/i, '');
  for (const { patterns } of STATE_PATTERNS) {
    for (const p of patterns) {
      clean = clean.replace(new RegExp(`[\\s\\-_/|]+${p.source}$`, 'i'), '');
    }
  }
  return clean.trim() || name;
}

function analyzeUIStates(doc) {
  const allStates = ['ideal', 'empty', 'loading', 'error', 'partial'];
  const frames = doc.children
    .filter(n => n.type === 'frame' && typeof n.width === 'number' && n.width >= 100 && typeof n.height === 'number' && n.height >= 100)
    .map(n => ({ id: n.id, name: n.name ?? n.id, x: n.x ?? 0, y: n.y ?? 0, width: n.width, height: n.height, inferredState: inferState(n.name ?? '') }));

  const groups = new Map();
  for (const f of frames) {
    const screen = extractScreenName(f.name);
    if (!groups.has(screen)) groups.set(screen, []);
    groups.get(screen).push(f);
  }

  const results = [];
  for (const [screenName, screenFrames] of groups) {
    const detected = [...new Set(screenFrames.map(f => f.inferredState))];
    const missing = allStates.filter(s => !detected.includes(s));
    const coverage = Math.round((detected.length / allStates.length) * 100);
    results.push({ screenName, frames: screenFrames, detectedStates: detected, missingStates: missing, coverage });
  }
  results.sort((a, b) => a.coverage - b.coverage);
  return results;
}

function formatReport(results) {
  const lines = ['# Five UI States Analysis Report', ''];
  const total = results.length;
  const full = results.filter(r => r.coverage === 100).length;
  lines.push(`> ${full} of ${total} screens have full coverage`, '');

  const stateLabels = { ideal: '✅ Ideal', empty: '📭 Empty', loading: '⏳ Loading', error: '❌ Error', partial: '🔶 Partial' };
  for (const g of results) {
    const icon = g.coverage === 100 ? '✅' : g.coverage >= 60 ? '⚠️' : '❌';
    lines.push(`## ${icon} ${g.screenName} (${g.coverage}%)`);
    lines.push(`**Detected**: ${g.detectedStates.map(s => stateLabels[s]).join(', ')}`);
    if (g.missingStates.length > 0) {
      lines.push(`**Missing**: ${g.missingStates.map(s => stateLabels[s]).join(', ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function getStateDescription(state, screenName) {
  switch (state) {
    case 'empty': return `${screenName} にデータがまだ存在しない場合の表示。初回利用時やフィルタ結果が0件の場合。アクションへの導線を提示する。`;
    case 'loading': return `${screenName} のデータを読み込み中の表示。スケルトン UI やスピナーを使い、進捗を示す。`;
    case 'error': return `${screenName} でエラーが発生した場合の表示。原因の説明とリトライ操作を提示する。`;
    case 'partial': return `${screenName} のデータが一部のみ表示されている状態。ネットワーク不安定時やページネーション途中。`;
    case 'ideal': return `${screenName} の正常表示。データが正しく読み込まれた理想的な状態。`;
    default: return '';
  }
}

// ── MCP Server (stdin/stdout JSON-RPC) ──
const rl = createInterface({ input: process.stdin });

const TOOLS = [
  { name: 'list_frames', description: 'List all frames in the document', inputSchema: { type: 'object', properties: {} } },
  { name: 'read_node', description: 'Read a node by ID', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'update_node', description: 'Update node properties', inputSchema: { type: 'object', properties: { id: { type: 'string' }, patch: { type: 'object' } }, required: ['id', 'patch'] } },
  { name: 'get_document', description: 'Get full PenDocument', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_status', description: 'Get bridge status', inputSchema: { type: 'object', properties: {} } },
  { name: 'check_ui_states', description: 'Analyze Five UI States coverage for all screens. Returns a report showing which states (Ideal/Empty/Loading/Error/Partial) are defined and which are missing.', inputSchema: { type: 'object', properties: {} } },
  { name: 'suggest_missing_states', description: 'Get suggestions for missing UI states with frame templates that can be added to the document.', inputSchema: { type: 'object', properties: { screenName: { type: 'string', description: 'Screen name to get suggestions for (from check_ui_states result)' } }, required: ['screenName'] } },
];

function handleMcpRequest(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') return respond(id, { protocolVersion: '2024-11-05', serverInfo: { name: 'pencil-collab-bridge', version: '0.2.0' }, capabilities: { tools: {} } });
  if (method === 'tools/list') return respond(id, { tools: TOOLS });
  if (method === 'notifications/initialized') return;

  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments ?? {};
    const doc = getPenDoc();
    switch (name) {
      case 'list_frames': return respond(id, { content: [{ type: 'text', text: JSON.stringify(listFrames(doc.children), null, 2) }] });
      case 'read_node': {
        const node = findNode(doc.children, args.id);
        return respond(id, { content: [{ type: 'text', text: node ? JSON.stringify(node, null, 2) : `Not found: ${args.id}` }], ...(node ? {} : { isError: true }) });
      }
      case 'update_node': {
        const updated = updateNode(doc.children, args.id, args.patch);
        ydoc.transact(() => { ymap.set('children', JSON.stringify(updated)); });
        broadcastDoc(getPenDoc());
        return respond(id, { content: [{ type: 'text', text: `Updated: ${args.id}` }] });
      }
      case 'get_document': return respond(id, { content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }] });
      case 'get_status': return respond(id, { content: [{ type: 'text', text: JSON.stringify({ wsPort: PORT, clients: wsClients.size, nodes: doc.children.length }, null, 2) }] });
      case 'check_ui_states': {
        const results = analyzeUIStates(doc);
        const report = formatReport(results);
        return respond(id, { content: [{ type: 'text', text: report }, { type: 'text', text: '\n---\nRaw data:\n' + JSON.stringify(results, null, 2) }] });
      }
      case 'suggest_missing_states': {
        const results = analyzeUIStates(doc);
        const screen = results.find(r => r.screenName === args.screenName);
        if (!screen) return respond(id, { content: [{ type: 'text', text: `Screen not found: ${args.screenName}. Available: ${results.map(r => r.screenName).join(', ')}` }], isError: true });
        if (screen.missingStates.length === 0) return respond(id, { content: [{ type: 'text', text: `${args.screenName}: All Five UI States are covered! 🎉` }] });
        // Generate frame templates for missing states
        const baseFrame = screen.frames[0];
        const suggestions = screen.missingStates.map((state, i) => ({
          type: 'frame',
          id: `${baseFrame.id}_${state}`,
          name: `WF: ${screen.screenName} - ${state.charAt(0).toUpperCase() + state.slice(1)}`,
          x: baseFrame.x + (baseFrame.width + 40) * (screen.frames.length + i),
          y: baseFrame.y,
          width: baseFrame.width,
          height: baseFrame.height,
          fill: '#FAF8F5',
          layout: 'vertical',
          children: [
            { type: 'text', id: `${baseFrame.id}_${state}_title`, content: `${screen.screenName} — ${state.charAt(0).toUpperCase() + state.slice(1)} State`, fontSize: 18, fontWeight: '600', fill: '#111827', x: 20, y: 20 },
            { type: 'text', id: `${baseFrame.id}_${state}_desc`, content: getStateDescription(state, screen.screenName), fontSize: 14, fill: '#6B7280', x: 20, y: 50, textGrowth: 'fixed-width', width: baseFrame.width - 40 },
          ],
        }));
        return respond(id, { content: [
          { type: 'text', text: `Missing states for "${args.screenName}": ${screen.missingStates.join(', ')}\n\nSuggested frames (use update_node or add these to the document):\n` },
          { type: 'text', text: JSON.stringify(suggestions, null, 2) },
        ] });
      }
      default: return respond(id, { content: [{ type: 'text', text: `Unknown: ${name}` }], isError: true });
    }
  }
  respondError(id, -32601, `Unknown: ${method}`);
}

function respond(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function respondError(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }
function log(msg) { process.stderr.write(`[collab-bridge] ${msg}\n`); }

rl.on('line', (line) => { try { handleMcpRequest(JSON.parse(line)); } catch { /* ignore */ } });

// ── Start ──
httpServer.listen(PORT, () => {
  log(`Server listening on http://localhost:${PORT}`);
  log('');
  log('Endpoints:');
  log(`  WebSocket: ws://localhost:${PORT}`);
  log(`  REST API:  http://localhost:${PORT}`);
  log(`  MCP:       stdin/stdout`);
  log('');
  log('REST API:');
  log(`  GET  /status        — Bridge status`);
  log(`  GET  /document      — Full document`);
  log(`  GET  /frames        — Frame list`);
  log(`  GET  /node/:id      — Read node`);
  log(`  PUT  /node/:id      — Update node {patch}`);
  log(`  POST /document      — Set full document`);
  log('');
  log('Example:');
  log(`  curl http://localhost:${PORT}/frames`);
  log(`  curl -X PUT http://localhost:${PORT}/node/abc -d '{"fill":"#ff0000"}'`);
});

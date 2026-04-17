/**
 * Pencil AI Design Review — Cloudflare Workers AI
 *
 * .pen ドキュメントを受け取り、AI でデザインレビューを実行する。
 * ステートレス: DB なし、ストレージなし。リクエスト処理して返すだけ。
 *
 * 無料枠: Workers AI 10,000 neurons/日、Workers 10万 req/日
 */

interface Env {
  AI: Ai;
  ALLOWED_ORIGINS?: string;
}

interface PenNode {
  type: string;
  id: string;
  name?: string;
  width?: number | string;
  height?: number | string;
  children?: PenNode[];
  content?: string;
  fill?: unknown;
  stroke?: unknown;
  layout?: string;
  [key: string]: unknown;
}

interface ReviewRequest {
  children: PenNode[];
  version?: string;
  locale?: 'en' | 'ja' | 'zh';
  mode?: 'full' | 'five-states' | 'accessibility' | 'quick';
}

interface RepairRequest {
  /** 元になる screen frame の JSON(deep cloneしたもの) */
  frame: PenNode;
  /** 生成したい state */
  state: 'empty' | 'loading' | 'error' | 'partial';
  locale?: 'en' | 'ja' | 'zh';
  /** 配置 X 座標(右隣に並べる用) */
  offsetX?: number;
}

interface GenerateRequest {
  /** モード識別子: body.mode === 'generate' のとき生成 API */
  mode: 'generate';
  /** ユーザ入力プロンプト。例: "モバイルのログイン画面" */
  prompt: string;
  /** 配置 X 座標（既存ページ群の右隣に並べるため） */
  offsetX?: number;
  /** フレームの種類（サイズのプリセット） */
  kind?: 'mobile' | 'tablet' | 'desktop';
  locale?: 'en' | 'ja' | 'zh';
}

/** フレーム情報を抽出（AI に渡すコンテキスト — 簡潔に） */
function extractFrameInfo(nodes: PenNode[]): string {
  const lines: string[] = [];

  for (const node of nodes) {
    if (node.type !== 'frame' || typeof node.width !== 'number' || node.width < 100) continue;
    const name = node.name ?? node.id;
    const w = node.width;
    const h = typeof node.height === 'number' ? node.height : '?';
    const childCount = node.children?.length ?? 0;
    const layout = node.layout ?? 'none';
    // 子の名前を最大5個
    const childNames = (node.children ?? []).slice(0, 5).map(c => c.name ?? c.type).join(', ');
    lines.push(`- ${name} (${w}×${h}, ${layout}, ${childCount} children: ${childNames})`);
  }

  return lines.join('\n');
}

/** Five UI States のパターン検出 */
function detectStates(nodes: PenNode[]): string {
  const statePatterns = [
    { state: 'Empty', patterns: ['empty', 'no data', 'no result', '空', 'データなし', 'blank', 'zero'] },
    { state: 'Loading', patterns: ['loading', 'spinner', 'skeleton', '読み込み', 'ロード'] },
    { state: 'Error', patterns: ['error', 'fail', '404', '500', 'エラー', '失敗'] },
    { state: 'Partial', patterns: ['partial', 'incomplete', '部分', '一部'] },
  ];

  const screens = new Map<string, Set<string>>();

  function checkName(name: string): string | null {
    const lower = name.toLowerCase();
    for (const { state, patterns } of statePatterns) {
      if (patterns.some(p => lower.includes(p))) return state;
    }
    return null;
  }

  for (const node of nodes) {
    if (node.type !== 'frame' || typeof node.width !== 'number' || node.width < 100) continue;
    const name = node.name ?? '';
    // Extract screen base name (remove state suffixes)
    let baseName = name.replace(/^WF:\s*/i, '').replace(/\s*[-–—]\s*(empty|loading|error|partial|空|エラー|読み込み).*/i, '').trim();
    if (!baseName) baseName = name;

    const state = checkName(name) ?? 'Ideal';
    if (!screens.has(baseName)) screens.set(baseName, new Set());
    screens.get(baseName)!.add(state);
  }

  const lines: string[] = [];
  for (const [screen, states] of screens) {
    const allStates = ['Ideal', 'Empty', 'Loading', 'Error', 'Partial'];
    const missing = allStates.filter(s => !states.has(s));
    const coverage = Math.round((states.size / 5) * 100);
    lines.push(`${screen}: ${coverage}% (has: ${[...states].join(',')}, missing: ${missing.join(',') || 'none'})`);
  }

  return lines.join('\n');
}

function getSystemPrompt(mode: string, locale: string): string {
  const lang = locale === 'ja' ? '日本語' : locale === 'zh' ? '中文' : 'English';

  if (mode === 'five-states') {
    return `You are a UI/UX design reviewer specializing in the Five UI States framework (Ideal, Empty, Loading, Error, Partial). Analyze the provided screen designs and report which states are missing for each screen. Be specific and actionable. Respond in ${lang}.`;
  }

  if (mode === 'accessibility') {
    return `You are an accessibility expert reviewing mobile/web UI designs. Check for: contrast issues, touch target sizes, text readability, missing labels, navigation flow. Respond in ${lang}.`;
  }

  if (mode === 'quick') {
    return `You are a senior UI/UX designer giving a quick review. Provide 3-5 bullet points of the most important issues or improvements. Be concise. Respond in ${lang}.`;
  }

  // full
  return `You are a senior UI/UX design reviewer. Analyze the provided screen designs comprehensively:

1. **Five UI States** — Check if Empty, Loading, Error, Partial states are defined for each screen
2. **Consistency** — Navigation patterns, spacing, typography consistency
3. **Missing screens** — Suggest any screens that should exist but don't
4. **Accessibility** — Touch targets, contrast, text size concerns
5. **Flow** — Screen transition logic, missing back navigation, dead ends

Be specific, actionable, and constructive. Respond in ${lang}.`;
}

/**
 * AI へ渡す前にフレームを必須プロパティだけにスリム化(token 削減と AI の混乱回避)。
 * @param maxDepth 子の再帰最大深度。デフォルト 2(root の子の子まで)。
 *                 これ以上深いと AI に渡すデータが大きくなりすぎて context 超過 + 出力切断を招く。
 */
function slimFrame(node: PenNode, maxDepth = 2, currentDepth = 0): unknown {
  const slim: Record<string, unknown> = { type: node.type, id: node.id };
  const allow = ['name', 'width', 'height', 'fill', 'layout', 'cornerRadius', 'content', 'fontSize', 'gap', 'padding'];
  for (const k of allow) {
    if (k in node && (node as Record<string, unknown>)[k] !== undefined) {
      slim[k] = (node as Record<string, unknown>)[k];
    }
  }
  if (node.children && Array.isArray(node.children) && currentDepth < maxDepth) {
    slim.children = node.children.map((c) => slimFrame(c, maxDepth, currentDepth + 1));
  }
  return slim;
}

/** AI への指示を最小限に抑え、JSON 出力だけに集中させるための system prompt */
function getRepairSystemPrompt(state: string, locale: string): string {
  const lang = locale === 'ja' ? 'Japanese (日本語)' : locale === 'zh' ? 'Chinese (中文)' : 'English';

  const exampleMessage: Record<string, Record<string, string>> = {
    empty: { ja: 'まだデータがありません', zh: '暂无数据', en: 'No items yet' },
    loading: { ja: '読み込み中…', zh: '加载中…', en: 'Loading…' },
    error: { ja: '読み込みに失敗しました', zh: '加载失败', en: 'Something went wrong' },
    partial: { ja: '一部のみ表示中', zh: '仅显示部分', en: 'Showing partial results' },
  };
  const cta: Record<string, Record<string, string>> = {
    empty: { ja: '追加する', zh: '添加', en: 'Add item' },
    error: { ja: '再試行', zh: '重试', en: 'Retry' },
    loading: { ja: '', zh: '', en: '' },
    partial: { ja: 'もっと見る', zh: '查看更多', en: 'Show more' },
  };
  const msg = exampleMessage[state]?.[locale] ?? exampleMessage[state]?.en ?? '';
  const ctaText = cta[state]?.[locale] ?? cta[state]?.en ?? '';

  const stateGuide: Record<string, string> = {
    empty: `EMPTY STATE: Replace data-bearing children (lists, cards, items) with ONE centered placeholder frame containing: a large icon (📭 emoji as text), a message text "${msg}", and a CTA button text "${ctaText}". Keep header / navigation / chrome unchanged.`,
    loading: `LOADING STATE: Replace data-bearing children with 3 skeleton placeholder frames (light-gray rectangles, height matches original cards). Add a small "${msg}" text at top.`,
    error: `ERROR STATE: Replace data-bearing children with ONE centered placeholder frame containing: a large icon (⚠️ emoji as text), a message text "${msg}", and a button text "${ctaText}". Keep header / navigation unchanged.`,
    partial: `PARTIAL STATE: Keep only ABOUT HALF of the original data items (drop the second half). Add a footer text "${msg}" with a "${ctaText}" button below it.`,
  };

  return `You output ONLY raw JSON. No markdown, no code fences, no commentary, no preamble.

TASK: ${stateGuide[state] ?? stateGuide.empty}

OUTPUT RULES (must follow exactly):
1. Output ONE JSON object starting with { and ending with } — nothing before or after
2. Keep root frame's width, height, fill, layout, cornerRadius EXACTLY the same as input
3. Root frame's name must be "<original name> — ${state}"
4. Root frame's id must be "<original id>_${state}"
5. KEEP IT MINIMAL — output only 2-4 children total in the root. DO NOT reproduce the original children list. Replace them with a single placeholder block.
6. ALL text content must be in ${lang}
7. Use ONLY these field names: type (must be "frame" or "text"), id, name, width, height, fill, layout, children, content, fontSize, gap, padding, cornerRadius
8. DO NOT use type "button" — use type "frame" with a child "text" instead
9. DO NOT add x, y, opacity, stroke, fontWeight, justifyContent, alignItems, or any field not listed above
10. DO NOT nest deeper than 2 levels (root → child → grandchild max)
11. Keep total output under 1500 characters — be very concise

Output the JSON now (nothing else):`;
}

/**
 * AI 出力から JSON ブロックだけを抽出。
 * 末尾の閉じ括弧 `}`/`]` が欠けている場合は自動補完する(Llama 3.1 8B の早期停止対策)。
 */
function extractJson(text: string): string | null {
  // markdown code fence の中にある場合を最優先
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenced) return fenced[1];

  const first = text.indexOf('{');
  if (first === -1) return null;

  let curlyDepth = 0;
  let squareDepth = 0;
  let inString = false;
  let escape = false;
  let lastBalancedEnd = -1;

  for (let i = first; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') curlyDepth++;
    else if (c === '}') {
      curlyDepth--;
      if (curlyDepth === 0 && squareDepth === 0) {
        lastBalancedEnd = i;
      }
    } else if (c === '[') squareDepth++;
    else if (c === ']') squareDepth--;
  }

  // 完全に閉じた JSON を見つけた場合
  if (lastBalancedEnd !== -1) {
    return text.slice(first, lastBalancedEnd + 1);
  }

  // 末尾欠落: 残った開き括弧の分だけ閉じ括弧を補完して救う
  if (curlyDepth > 0 || squareDepth > 0) {
    // string 内で終わっている場合は閉じ引用符も足す
    const tail = text.slice(first);
    let recovered = inString ? tail + '"' : tail;
    // 開いている [ と { を逆順で閉じる必要があるが、ネストされた最後の数個だけ補完すれば十分。
    // 実際には ] と } の必要数を多めに足しても JSON.parse は前の閉じで止まるので問題なし。
    recovered += ']'.repeat(squareDepth) + '}'.repeat(curlyDepth);
    return recovered;
  }

  return null;
}

/**
 * Figma ライクな "AI デザイン生成" プロンプト。
 * ユーザの自由入力 (例: "モバイルのログイン画面") から .pen 形式の Frame を直接 JSON で吐かせる。
 */
function getGenerateSystemPrompt(kind: 'mobile' | 'tablet' | 'desktop', locale: string): string {
  const dims = {
    mobile: { w: 375, h: 812 },
    tablet: { w: 768, h: 1024 },
    desktop: { w: 1440, h: 900 },
  }[kind];
  const lang = locale === 'ja' ? 'Japanese (日本語)' : locale === 'zh' ? 'Chinese (中文)' : 'English';

  return `You are a UI designer AI. You output ONLY raw JSON — no markdown, no code fences, no commentary.

TASK: Generate a ${kind} screen (${dims.w}×${dims.h}) matching the user's request.

OUTPUT SHAPE:
- Root: a single frame node with type="frame", width=${dims.w}, height=${dims.h}
- Root frame must have: id, name, width=${dims.w}, height=${dims.h}, fill (hex like "#FFFFFF"), layout="vertical" or "none", children
- Children: use type "frame" (for containers/cards/buttons) or type "text" (for labels)
- DO NOT use types "button", "rectangle", "ellipse", "line" — use "frame" with fill + cornerRadius instead
- Text children need: id, type="text", content, fontSize (14-32), fill (hex), x, y

LAYOUT RULES:
- Each child must have x, y, width, height fields (numbers in px, relative to root frame's top-left)
- Space children realistically: header ~60px tall at top, form fields ~48px tall with 16px gap, CTA button 48px tall
- Padding ~24px from frame edges
- Use gray/muted colors: #111827 for text, #F9FAFB for backgrounds, #E5E7EB for borders, #4F46E5 for accents
- Text fontSize: 28 for titles, 16 for body, 14 for captions

CONTENT RULES:
- ALL visible text content must be in ${lang}
- Keep it minimal: 5-12 children total in the root frame (don't overdo it)
- Make the design realistic and useful, not abstract

OUTPUT CONSTRAINTS:
1. Output ONE JSON object starting with { and ending with } — nothing before or after
2. Only use these fields: type, id, name, x, y, width, height, fill, stroke, content, fontSize, fontWeight, cornerRadius, children, layout, gap, padding
3. Max 2 levels of nesting (root → child → grandchild)
4. Total output under 2500 characters
5. id fields must be unique strings (e.g. "title_1", "btn_login")

Output the JSON for the requested design now:`;
}

/** 生成された frame の最低限のバリデーション */
function validateRepairedFrame(node: unknown): node is PenNode {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  if (n.type !== 'frame') return false;
  if (typeof n.id !== 'string' || !n.id) return false;
  if (typeof n.width !== 'number' || typeof n.height !== 'number') return false;
  if (n.children && !Array.isArray(n.children)) return false;
  return true;
}

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : ['*'];

  const isAllowed = allowed.includes('*') || allowed.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin || '*' : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return Response.json({ error: 'POST only' }, { status: 405, headers: cors });
    }

    try {
      const body = await request.json() as ReviewRequest | RepairRequest | GenerateRequest;

      // --- Generate endpoint (AI design from prompt) ---
      if ('mode' in body && body.mode === 'generate') {
        const gen = body as GenerateRequest;
        const { prompt, locale = 'ja', kind = 'mobile', offsetX = 0 } = gen;

        if (typeof prompt !== 'string' || prompt.trim().length === 0) {
          return Response.json({ error: 'prompt is required' }, { status: 400, headers: cors });
        }
        if (prompt.length > 500) {
          return Response.json({ error: 'prompt too long (max 500 chars)' }, { status: 400, headers: cors });
        }

        const systemPrompt = getGenerateSystemPrompt(kind, locale);
        const userMessage = `User request: ${prompt.trim()}\n\nNow output the JSON for this design.`;

        const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 4096,
          temperature: 0.5,
        });

        const rawAny = (result as { response?: unknown }).response;
        let raw: string;
        if (typeof rawAny === 'string') raw = rawAny;
        else if (rawAny && typeof rawAny === 'object') raw = JSON.stringify(rawAny);
        else raw = JSON.stringify(result);

        const jsonStr = extractJson(raw);
        if (!jsonStr) {
          return Response.json({ error: 'AI did not return valid JSON', raw: raw.slice(0, 500) }, { status: 502, headers: cors });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonStr);
        } catch (e) {
          return Response.json({ error: `JSON parse failed: ${String(e)}`, raw: jsonStr.slice(0, 500) }, { status: 502, headers: cors });
        }

        if (!validateRepairedFrame(parsed)) {
          return Response.json({ error: 'AI output failed validation', raw: jsonStr.slice(0, 500) }, { status: 502, headers: cors });
        }

        // 配置を強制: offsetX, y=0 で新規ページとして配置
        const generated = parsed as PenNode & { x?: number; y?: number; name?: string };
        generated.x = offsetX;
        generated.y = 0;
        if (!generated.name) generated.name = prompt.trim().slice(0, 40);

        return Response.json({
          node: generated,
          meta: {
            mode: 'generate',
            kind,
            locale,
            prompt: prompt.trim(),
            model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          },
        }, { headers: cors });
      }

      // --- Repair (state generation) endpoint ---
      // body に `frame` と `state` があれば repair モード
      if ('frame' in body && 'state' in body) {
        const repair = body as RepairRequest;
        const { frame, state, locale = 'ja', offsetX } = repair;

        if (!frame || typeof frame !== 'object' || frame.type !== 'frame') {
          return Response.json({ error: 'Invalid request: frame must be a frame node' }, { status: 400, headers: cors });
        }
        if (!['empty', 'loading', 'error', 'partial'].includes(state)) {
          return Response.json({ error: 'Invalid state' }, { status: 400, headers: cors });
        }

        const systemPrompt = getRepairSystemPrompt(state, locale);
        // 入力フレームをスリム化(token 数削減 + AI が冗長な props をコピーしないように)
        const slimmedFrame = slimFrame(frame);
        const userMessage = `Input frame:\n${JSON.stringify(slimmedFrame)}\n\nNow output the "${state}" state version as raw JSON.`;

        // Llama 3.3 70B(Paid プラン): 128k context, JSON 生成精度 が 8B より大幅に高い。
        // 旧 8B モデルでは context overflow + 不完全 JSON の問題があったが、
        // 70B では入力 + 出力ともに余裕。深いツリーや日本語の精度も良好。
        const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 4096,
          temperature: 0.1,
        });

        // Llama モデルによってレスポンス形式が異なる(string / object / tool_calls 配列)
        const rawAny = (result as { response?: unknown }).response;
        let raw: string;
        if (typeof rawAny === 'string') {
          raw = rawAny;
        } else if (rawAny && typeof rawAny === 'object') {
          // 70B は時々オブジェクトとして JSON を直接返してくる
          raw = JSON.stringify(rawAny);
        } else {
          // 最後の手段: result 全体を string 化
          raw = JSON.stringify(result);
        }

        const jsonStr = extractJson(raw);
        if (!jsonStr) {
          return Response.json({ error: 'AI did not return valid JSON', raw: raw.slice(0, 500) }, { status: 502, headers: cors });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonStr);
        } catch (e) {
          return Response.json({ error: `JSON parse failed: ${String(e)}`, raw: jsonStr.slice(0, 500) }, { status: 502, headers: cors });
        }

        if (!validateRepairedFrame(parsed)) {
          return Response.json({ error: 'AI output failed validation (missing type/id/width/height)', raw: jsonStr.slice(0, 500) }, { status: 502, headers: cors });
        }

        // x/y を強制設定: 元フレームの右隣
        const repaired = parsed as PenNode & { x?: number; y?: number };
        if (typeof offsetX === 'number') repaired.x = offsetX;
        const frameY = (frame as unknown as { y?: number }).y;
        if (typeof frameY === 'number') repaired.y = frameY;

        return Response.json({
          node: repaired,
          meta: {
            mode: 'repair-state',
            state,
            locale,
            model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          },
        }, { headers: cors });
      }

      // --- Review endpoint (existing) ---
      const reviewBody = body as ReviewRequest;
      const { children, locale = 'ja', mode = 'full' } = reviewBody;

      if (!children || !Array.isArray(children)) {
        return Response.json({ error: 'Invalid request: children array required' }, { status: 400, headers: cors });
      }

      // Build context for AI — truncate to fit context window
      const frameInfo = extractFrameInfo(children);
      const stateAnalysis = detectStates(children);

      // Llama 3.1 8B has ~8k context. Keep user message under ~3000 chars
      const MAX_FRAME_INFO = 2000;
      const truncatedFrameInfo = frameInfo.length > MAX_FRAME_INFO
        ? frameInfo.slice(0, MAX_FRAME_INFO) + `\n... (${children.length} total frames, truncated)`
        : frameInfo;

      const userMessage = `## Screens (${children.filter(n => n.type === 'frame').length} total)
${truncatedFrameInfo}

## Five UI States
${stateAnalysis}

Review this design.`;

      const systemPrompt = getSystemPrompt(mode, locale);

      // Call Cloudflare AI
      const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1024,
      });

      return Response.json({
        review: (result as { response: string }).response,
        meta: {
          mode,
          locale,
          screenCount: children.filter(n => n.type === 'frame' && typeof n.width === 'number' && n.width >= 100).length,
          model: '@cf/meta/llama-3.1-8b-instruct',
        },
      }, { headers: cors });

    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500, headers: cors });
    }
  },
};

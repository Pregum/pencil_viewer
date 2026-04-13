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

/** フレーム情報を抽出（AI に渡すコンテキスト） */
function extractFrameInfo(nodes: PenNode[]): string {
  const frames: string[] = [];

  function walk(node: PenNode, depth: number, parentName: string) {
    if (depth > 3) return; // 深さ制限
    const name = node.name ?? node.id;
    const w = typeof node.width === 'number' ? node.width : node.width;
    const h = typeof node.height === 'number' ? node.height : node.height;

    if (node.type === 'frame' && typeof node.width === 'number' && node.width >= 100) {
      const children = node.children ?? [];
      const childTypes = children.map(c => c.type).join(', ');
      const childNames = children.slice(0, 10).map(c => c.name ?? c.type).join(', ');
      const layout = node.layout ?? 'none';
      frames.push(`- ${name} (${w}×${h}, layout:${layout}, children: [${childNames}])`);
    }

    if (node.type === 'text' && node.content && depth <= 2) {
      const content = (node.content as string).slice(0, 50);
      frames.push(`  - text: "${content}" (in ${parentName})`);
    }

    if (node.children) {
      for (const child of node.children) {
        walk(child, depth + 1, name);
      }
    }
  }

  for (const node of nodes) {
    walk(node, 0, 'root');
  }

  return frames.join('\n');
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
      const body = await request.json() as ReviewRequest;
      const { children, locale = 'ja', mode = 'full' } = body;

      if (!children || !Array.isArray(children)) {
        return Response.json({ error: 'Invalid request: children array required' }, { status: 400, headers: cors });
      }

      // Build context for AI
      const frameInfo = extractFrameInfo(children);
      const stateAnalysis = detectStates(children);

      const userMessage = `## Screen Structure
${frameInfo}

## Five UI States Analysis (auto-detected)
${stateAnalysis}

Please review this design.`;

      const systemPrompt = getSystemPrompt(mode, locale);

      // Call Cloudflare AI
      const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 2048,
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

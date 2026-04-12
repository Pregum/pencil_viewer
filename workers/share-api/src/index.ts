/**
 * Pencil Viewer Share API — Cloudflare Worker + KV
 *
 * Endpoints:
 *   POST /api/share       — .pen JSON をアップロード、短縮 ID を返す
 *   GET  /api/files/:id   — ID から .pen JSON を取得
 *   GET  /api/health      — ヘルスチェック
 */

interface Env {
  PEN_FILES: KVNamespace;
  ALLOWED_ORIGIN: string;
  TTL_SECONDS: string;
  MAX_SIZE: string;
}

// nanoid-like の短い ID を生成 (8文字 = 62^8 ≈ 218兆通り)
function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const arr = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  // 本番 + localhost を許可
  const allowed =
    origin === env.ALLOWED_ORIGIN ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:');

  return {
    'Access-Control-Allow-Origin': allowed ? origin : env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(
  data: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(env, request);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // --- Health ---
    if (url.pathname === '/api/health') {
      return jsonResponse({ ok: true, ts: Date.now() }, 200, cors);
    }

    // --- Share (upload) ---
    if (url.pathname === '/api/share' && request.method === 'POST') {
      const maxSize = parseInt(env.MAX_SIZE, 10);
      const contentLength = parseInt(request.headers.get('Content-Length') ?? '0', 10);

      if (contentLength > maxSize) {
        return jsonResponse(
          { error: `File too large. Max ${maxSize} bytes.` },
          413,
          cors,
        );
      }

      let body: string;
      try {
        body = await request.text();
      } catch {
        return jsonResponse({ error: 'Failed to read body.' }, 400, cors);
      }

      if (body.length > maxSize) {
        return jsonResponse(
          { error: `File too large. Max ${maxSize} bytes.` },
          413,
          cors,
        );
      }

      // JSON として有効か最低限チェック (version + children)
      try {
        const parsed = JSON.parse(body);
        if (!parsed.version || !Array.isArray(parsed.children)) {
          return jsonResponse(
            { error: 'Invalid .pen file: missing version or children.' },
            400,
            cors,
          );
        }
      } catch {
        return jsonResponse({ error: 'Invalid JSON.' }, 400, cors);
      }

      const id = generateId();
      const ttl = parseInt(env.TTL_SECONDS, 10);

      await env.PEN_FILES.put(id, body, {
        expirationTtl: ttl,
        metadata: {
          size: body.length,
          createdAt: new Date().toISOString(),
        },
      });

      return jsonResponse(
        {
          id,
          url: `${env.ALLOWED_ORIGIN}/pencil_viewer/?id=${id}`,
          expiresIn: `${ttl / 86400} days`,
        },
        201,
        cors,
      );
    }

    // --- Get file ---
    const fileMatch = url.pathname.match(/^\/api\/files\/([A-Za-z0-9]{4,16})$/);
    if (fileMatch && request.method === 'GET') {
      const id = fileMatch[1];
      const data = await env.PEN_FILES.get(id);
      if (!data) {
        return jsonResponse(
          { error: 'File not found or expired.' },
          404,
          cors,
        );
      }
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
          ...cors,
        },
      });
    }

    return jsonResponse({ error: 'Not found.' }, 404, cors);
  },
};

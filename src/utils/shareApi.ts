/**
 * Pencil Viewer Share API クライアント。
 * Cloudflare Workers の share-api にファイルをアップロード / 取得する。
 *
 * Worker 未デプロイ時は全て静かに失敗する(Share ボタンは無効化)。
 */

// Worker の URL — デプロイ後に実際の URL に差し替える
// 開発中は wrangler dev の localhost を使う
const API_BASE = import.meta.env.VITE_SHARE_API_URL ?? '';

export interface ShareResult {
  id: string;
  url: string;
  expiresIn: string;
}

export function isShareEnabled(): boolean {
  return API_BASE.length > 0;
}

export async function uploadPen(content: string): Promise<ShareResult> {
  if (!API_BASE) throw new Error('Share API is not configured (VITE_SHARE_API_URL).');

  const res = await fetch(`${API_BASE}/api/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: content,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error: string }).error ?? `Upload failed: ${res.status}`);
  }

  return res.json() as Promise<ShareResult>;
}

export async function fetchSharedPen(id: string): Promise<string> {
  if (!API_BASE) throw new Error('Share API is not configured.');

  const res = await fetch(`${API_BASE}/api/files/${encodeURIComponent(id)}`);

  if (!res.ok) {
    if (res.status === 404) throw new Error('共有ファイルが見つからないか期限切れです。');
    throw new Error(`Failed to load shared file: HTTP ${res.status}`);
  }

  return res.text();
}

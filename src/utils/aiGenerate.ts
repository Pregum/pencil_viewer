/**
 * Cloudflare Workers AI デザイン生成 API クライアント。
 * VITE_AI_REVIEW_URL を共有（Worker は `mode: 'generate'` ボディで分岐）。
 * 無料枠を超えたらリクエスト側で普通に HTTP エラーが返って止まるだけ（graceful fail）。
 */

import type { PenNode } from '../pen/types';

const AI_URL = import.meta.env.VITE_AI_REVIEW_URL as string | undefined;

export type GenerateKind = 'mobile' | 'tablet' | 'desktop';

export interface GenerateResult {
  node: PenNode;
  meta: {
    mode: 'generate';
    kind: GenerateKind;
    locale: 'en' | 'ja' | 'zh';
    prompt: string;
    model: string;
  };
}

export function isAIGenerateEnabled(): boolean {
  return !!AI_URL;
}

export async function requestAIGenerate(
  prompt: string,
  kind: GenerateKind = 'mobile',
  locale: 'en' | 'ja' | 'zh' = 'ja',
  offsetX = 0,
): Promise<GenerateResult> {
  if (!AI_URL) throw new Error('AI is not configured (VITE_AI_REVIEW_URL)');

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'generate',
      prompt,
      kind,
      locale,
      offsetX,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    // Cloudflare 無料枠超過時は 429 / 500 等のエラーが返る。
    // 呼び出し側でメッセージ表示するだけの静かな failure を想定。
    throw new Error((err as { error: string }).error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<GenerateResult>;
}

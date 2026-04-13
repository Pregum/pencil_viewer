/**
 * Cloudflare Workers AI デザインレビュー API クライアント。
 * VITE_AI_REVIEW_URL が未設定なら無効。
 */

import type { PenDocument } from '../pen/types';

const AI_REVIEW_URL = import.meta.env.VITE_AI_REVIEW_URL as string | undefined;

export type ReviewMode = 'full' | 'five-states' | 'accessibility' | 'quick';

export interface ReviewResult {
  review: string;
  meta: {
    mode: string;
    locale: string;
    screenCount: number;
    model: string;
  };
}

export function isAIReviewEnabled(): boolean {
  return !!AI_REVIEW_URL;
}

export async function requestAIReview(
  doc: PenDocument,
  mode: ReviewMode = 'full',
  locale: 'en' | 'ja' | 'zh' = 'ja',
): Promise<ReviewResult> {
  if (!AI_REVIEW_URL) throw new Error('AI Review is not configured');

  const res = await fetch(AI_REVIEW_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      children: doc.children,
      version: doc.version,
      locale,
      mode,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<ReviewResult>;
}

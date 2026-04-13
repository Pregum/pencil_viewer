/**
 * Cloudflare Workers AI デザインレビュー API クライアント。
 * VITE_AI_REVIEW_URL が未設定なら無効。
 */

import type { PenDocument, PenNode } from '../pen/types';

const AI_REVIEW_URL = import.meta.env.VITE_AI_REVIEW_URL as string | undefined;

export type ReviewMode = 'full' | 'five-states' | 'accessibility' | 'quick';
export type RepairState = 'empty' | 'loading' | 'error' | 'partial';

export interface ReviewResult {
  review: string;
  meta: {
    mode: string;
    locale: string;
    screenCount: number;
    model: string;
  };
}

export interface RepairResult {
  node: PenNode;
  meta: {
    mode: 'repair-state';
    state: RepairState;
    locale: string;
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

/**
 * 既存フレームを元に、指定された UI state バリエーションを AI で生成する。
 * 結果は元フレームの右隣 (offsetX = frame.x + frame.width + 60) に配置される。
 */
export async function requestStateRepair(
  frame: PenNode,
  state: RepairState,
  locale: 'en' | 'ja' | 'zh' = 'ja',
): Promise<RepairResult> {
  if (!AI_REVIEW_URL) throw new Error('AI Review is not configured');

  const fx = (frame as { x?: number }).x ?? 0;
  const fw = (frame as { width?: number }).width;
  const offsetX = fx + (typeof fw === 'number' ? fw : 400) + 60;

  const res = await fetch(AI_REVIEW_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frame,
      state,
      locale,
      offsetX,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<RepairResult>;
}

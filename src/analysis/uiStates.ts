/**
 * Five UI States 分析エンジン。
 *
 * Five UI States (by Scott Hurff):
 *   1. Ideal State    — 正常にデータが表示されている状態
 *   2. Empty State    — データがない、初回表示
 *   3. Loading State  — データ読み込み中
 *   4. Error State    — エラー発生
 *   5. Partial State  — 一部データのみ表示（不完全な状態）
 *
 * フレーム名やノード構造から各状態の対応状況を推定する。
 */

import type { PenDocument, PenNode } from '../pen/types';

export type UIState = 'ideal' | 'empty' | 'loading' | 'error' | 'partial';

export const UI_STATE_LABELS: Record<UIState, { en: string; ja: string; zh: string; icon: string; color: string }> = {
  ideal:   { en: 'Ideal',   ja: '通常',     zh: '理想', icon: '✅', color: '#22c55e' },
  empty:   { en: 'Empty',   ja: '空状態',   zh: '空状态', icon: '📭', color: '#eab308' },
  loading: { en: 'Loading', ja: '読込中',   zh: '加载中', icon: '⏳', color: '#3b82f6' },
  error:   { en: 'Error',   ja: 'エラー',   zh: '错误', icon: '❌', color: '#ef4444' },
  partial: { en: 'Partial', ja: '部分表示', zh: '部分', icon: '🔶', color: '#f97316' },
};

/** フレーム名からどの UI State に該当するか推定 */
const STATE_PATTERNS: { state: UIState; patterns: RegExp[] }[] = [
  {
    state: 'empty',
    patterns: [
      /empty/i, /no.?data/i, /no.?result/i, /no.?item/i, /no.?content/i,
      /空/i, /データなし/i, /結果なし/i, /アイテムなし/i,
      /zero.?state/i, /blank/i, /初回/i, /未登録/i, /まだ/i,
    ],
  },
  {
    state: 'loading',
    patterns: [
      /loading/i, /spinner/i, /skeleton/i, /shimmer/i, /progress/i,
      /読み込み/i, /ロード/i, /読込/i, /待機/i,
    ],
  },
  {
    state: 'error',
    patterns: [
      /error/i, /fail/i, /404/i, /500/i, /offline/i, /timeout/i,
      /エラー/i, /失敗/i, /接続/i, /タイムアウト/i, /障害/i,
      /not.?found/i, /unavailable/i,
    ],
  },
  {
    state: 'partial',
    patterns: [
      /partial/i, /incomplete/i, /limited/i, /degraded/i,
      /部分/i, /一部/i, /制限/i, /不完全/i,
    ],
  },
];

export interface ScreenGroup {
  /** 画面名（共通プレフィックスから推定） */
  screenName: string;
  /** この画面に属するフレーム */
  frames: FrameStateInfo[];
  /** 検出された UI States */
  detectedStates: Set<UIState>;
  /** 不足している UI States */
  missingStates: UIState[];
  /** カバー率 (0-100) */
  coverage: number;
}

export interface FrameStateInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 推定された UI State */
  inferredState: UIState;
}

/** フレーム名から UI State を推定 */
function inferState(name: string): UIState {
  for (const { state, patterns } of STATE_PATTERNS) {
    if (patterns.some((p) => p.test(name))) return state;
  }
  return 'ideal'; // デフォルトは通常状態
}

/** フレーム名から画面グループ名を抽出 */
function extractScreenName(name: string): string {
  // "WF: ホーム" → "ホーム"
  // "WF: ホーム - Empty" → "ホーム"
  // "Login Screen" → "Login Screen"
  let clean = name.replace(/^WF:\s*/i, '').replace(/^Screen:\s*/i, '');

  // State サフィックスを除去
  for (const { patterns } of STATE_PATTERNS) {
    for (const p of patterns) {
      clean = clean.replace(new RegExp(`[\\s\\-_/|]+${p.source}$`, 'i'), '');
      clean = clean.replace(new RegExp(`^${p.source}[\\s\\-_/|]+`, 'i'), '');
    }
  }

  return clean.trim() || name;
}

/** トップレベルフレームを収集 */
function collectFrames(nodes: PenNode[]): FrameStateInfo[] {
  const result: FrameStateInfo[] = [];
  for (const node of nodes) {
    if (node.type !== 'frame') continue;
    const w = typeof node.width === 'number' ? node.width : 0;
    const h = typeof node.height === 'number' ? node.height : 0;
    // 小さいフレーム（ラベル、セクションヘッダー等）はスキップ
    if (w < 100 || h < 100) continue;
    result.push({
      id: node.id,
      name: node.name ?? node.id,
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: w,
      height: h,
      inferredState: inferState(node.name ?? ''),
    });
  }
  return result;
}

/** フレームを画面グループに分類 */
function groupByScreen(frames: FrameStateInfo[]): Map<string, FrameStateInfo[]> {
  const groups = new Map<string, FrameStateInfo[]>();
  for (const f of frames) {
    const screenName = extractScreenName(f.name);
    const existing = groups.get(screenName) ?? [];
    existing.push(f);
    groups.set(screenName, existing);
  }
  return groups;
}

/** Five UI States 分析を実行 */
export function analyzeUIStates(doc: PenDocument): ScreenGroup[] {
  const frames = collectFrames(doc.children);
  const grouped = groupByScreen(frames);
  const allStates: UIState[] = ['ideal', 'empty', 'loading', 'error', 'partial'];

  const results: ScreenGroup[] = [];
  for (const [screenName, screenFrames] of grouped) {
    const detected = new Set(screenFrames.map((f) => f.inferredState));
    const missing = allStates.filter((s) => !detected.has(s));
    const coverage = Math.round((detected.size / allStates.length) * 100);

    results.push({
      screenName,
      frames: screenFrames,
      detectedStates: detected,
      missingStates: missing,
      coverage,
    });
  }

  // カバー率の低い順にソート
  results.sort((a, b) => a.coverage - b.coverage);
  return results;
}

/** 分析結果を Markdown レポートにフォーマット */
export function formatReport(results: ScreenGroup[], locale: 'en' | 'ja' | 'zh' = 'en'): string {
  const lines: string[] = [];
  const title = locale === 'ja' ? '# Five UI States 分析レポート'
    : locale === 'zh' ? '# Five UI States 分析报告'
    : '# Five UI States Analysis Report';
  lines.push(title);
  lines.push('');

  const totalScreens = results.length;
  const fullCoverage = results.filter((r) => r.coverage === 100).length;
  const summary = locale === 'ja'
    ? `全 ${totalScreens} 画面中 ${fullCoverage} 画面が全状態をカバー`
    : locale === 'zh'
    ? `共 ${totalScreens} 个画面，${fullCoverage} 个画面完全覆盖`
    : `${fullCoverage} of ${totalScreens} screens have full coverage`;
  lines.push(`> ${summary}`);
  lines.push('');

  for (const group of results) {
    const icon = group.coverage === 100 ? '✅' : group.coverage >= 60 ? '⚠️' : '❌';
    lines.push(`## ${icon} ${group.screenName} (${group.coverage}%)`);
    lines.push('');

    // Detected
    const detected = Array.from(group.detectedStates)
      .map((s) => `${UI_STATE_LABELS[s].icon} ${UI_STATE_LABELS[s][locale]}`)
      .join(', ');
    const detectedLabel = locale === 'ja' ? '検出済み' : locale === 'zh' ? '已检测' : 'Detected';
    lines.push(`**${detectedLabel}**: ${detected}`);

    // Missing
    if (group.missingStates.length > 0) {
      const missing = group.missingStates
        .map((s) => `${UI_STATE_LABELS[s].icon} ${UI_STATE_LABELS[s][locale]}`)
        .join(', ');
      const missingLabel = locale === 'ja' ? '不足' : locale === 'zh' ? '缺失' : 'Missing';
      lines.push(`**${missingLabel}**: ${missing}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

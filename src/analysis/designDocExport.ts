/**
 * 設計書エクスポーター。
 * .pen ドキュメントから Markdown 形式の設計書を生成する。
 * Notion インポートや GitHub PR にそのまま使える。
 */

import type { PenDocument, PenNode } from '../pen/types';
import { analyzeUIStates, UI_STATE_LABELS, type UIState } from './uiStates';

export interface ExportOptions {
  projectName?: string;
  locale?: 'en' | 'ja';
}

const ALL_STATES: UIState[] = ['ideal', 'empty', 'loading', 'error', 'partial'];

/** コンポーネントツリーを再帰的に Markdown リストに変換 */
function nodeTree(nodes: PenNode[], depth = 0, maxDepth = 3): string[] {
  if (depth >= maxDepth) return [];
  const lines: string[] = [];
  const indent = '  '.repeat(depth);
  for (const n of nodes) {
    const name = (n as { name?: string }).name ?? n.id;
    const typeLabel = n.type;
    const extra: string[] = [];

    if (n.type === 'text') {
      const content = (n as { content?: string }).content;
      if (content) extra.push(`"${content.slice(0, 30)}${content.length > 30 ? '…' : ''}"`);
    }
    if (n.type === 'icon_font') {
      const iconName = (n as { iconFontName?: string }).iconFontName;
      if (iconName) extra.push(iconName);
    }

    const extraStr = extra.length > 0 ? ` — ${extra.join(', ')}` : '';
    lines.push(`${indent}- **${name}** (${typeLabel})${extraStr}`);

    if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
      lines.push(...nodeTree((n as { children: PenNode[] }).children, depth + 1, maxDepth));
    }
  }
  return lines;
}

/** 使用中のデザイントークンを抽出 */
function extractTokens(nodes: PenNode[]): Map<string, string> {
  const tokens = new Map<string, string>();
  function walk(node: PenNode) {
    const fill = (node as { fill?: unknown }).fill;
    if (typeof fill === 'string' && fill.startsWith('#')) {
      tokens.set(fill, fill);
    }
    if (fill && typeof fill === 'object' && (fill as { color?: string }).color) {
      tokens.set((fill as { color: string }).color, (fill as { color: string }).color);
    }
    if ('children' in node && Array.isArray((node as { children?: PenNode[] }).children)) {
      for (const c of (node as { children: PenNode[] }).children) walk(c);
    }
  }
  for (const n of nodes) walk(n);
  return tokens;
}

/** 1画面分の Markdown を生成 */
function generateScreenPage(
  frame: PenNode,
  stateInfo: { detectedStates: Set<UIState>; missingStates: UIState[] },
  locale: 'en' | 'ja',
): string {
  const name = (frame as { name?: string }).name ?? frame.id;
  const w = typeof (frame as { width?: unknown }).width === 'number' ? (frame as { width: number }).width : '?';
  const h = typeof (frame as { height?: unknown }).height === 'number' ? (frame as { height: number }).height : '?';
  const layout = (frame as { layout?: string }).layout ?? 'none';

  const lines: string[] = [];
  lines.push(`# 📱 ${name}`);
  lines.push('');

  // 基本情報
  const infoTitle = locale === 'ja' ? '## 基本情報' : '## Basic Info';
  lines.push(infoTitle);
  lines.push(`- Frame ID: \`${frame.id}\``);
  lines.push(`- ${locale === 'ja' ? 'サイズ' : 'Size'}: ${w} × ${h}`);
  lines.push(`- Layout: ${layout}`);
  lines.push('');

  // Five UI States
  lines.push('## Five UI States');
  lines.push('');
  lines.push(`| State | ${locale === 'ja' ? '状態' : 'Status'} |`);
  lines.push('|---|---|');
  for (const s of ALL_STATES) {
    const label = UI_STATE_LABELS[s];
    const detected = stateInfo.detectedStates.has(s);
    const status = detected
      ? (locale === 'ja' ? '✅ 定義済み' : '✅ Defined')
      : (locale === 'ja' ? '⚠️ 未定義' : '⚠️ Missing');
    lines.push(`| ${label.icon} ${label.en} | ${status} |`);
  }
  lines.push('');

  // コンポーネント構成
  const compTitle = locale === 'ja' ? '## コンポーネント構成' : '## Component Structure';
  lines.push(compTitle);
  lines.push('');
  if ('children' in frame && Array.isArray((frame as { children?: PenNode[] }).children)) {
    lines.push(...nodeTree((frame as { children: PenNode[] }).children));
  }
  lines.push('');

  // 使用色
  const colorTitle = locale === 'ja' ? '## 使用色' : '## Colors Used';
  lines.push(colorTitle);
  lines.push('');
  const tokens = extractTokens([frame]);
  if (tokens.size > 0) {
    for (const [color] of tokens) {
      lines.push(`- \`${color}\``);
    }
  } else {
    lines.push(locale === 'ja' ? '（なし）' : '(none)');
  }
  lines.push('');

  // 実装メモ
  const memoTitle = locale === 'ja' ? '## 実装メモ' : '## Implementation Notes';
  lines.push(memoTitle);
  lines.push('');
  lines.push(`> ${locale === 'ja' ? '（エンジニアが自由に記入）' : '(Engineers can add notes here)'}`);
  lines.push('');

  return lines.join('\n');
}

/** ドキュメント全体の設計書 Markdown を生成 */
export function generateDesignDoc(doc: PenDocument, options: ExportOptions = {}): string {
  const { projectName = 'Design Document', locale = 'ja' } = options;
  const uiStates = analyzeUIStates(doc);

  const lines: string[] = [];

  // タイトル
  lines.push(`# 📐 ${projectName}`);
  lines.push('');
  lines.push(`> ${locale === 'ja' ? '自動生成:' : 'Auto-generated:'} ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // サマリーテーブル
  const summaryTitle = locale === 'ja' ? '## 📊 画面サマリー' : '## 📊 Screen Summary';
  lines.push(summaryTitle);
  lines.push('');
  lines.push(`| ${locale === 'ja' ? '画面名' : 'Screen'} | States | ${locale === 'ja' ? 'カバー率' : 'Coverage'} | ${locale === 'ja' ? '不足' : 'Missing'} |`);
  lines.push('|---|---|---|---|');

  for (const group of uiStates) {
    const stateIcons = ALL_STATES.map((s) =>
      group.detectedStates.has(s) ? UI_STATE_LABELS[s].icon : '⬜'
    ).join('');
    const missing = group.missingStates.length > 0
      ? group.missingStates.map((s) => UI_STATE_LABELS[s][locale]).join(', ')
      : (locale === 'ja' ? '—' : '—');
    lines.push(`| ${group.screenName} | ${stateIcons} | ${group.coverage}% | ${missing} |`);
  }
  lines.push('');

  // 統計
  const total = uiStates.length;
  const full = uiStates.filter((r) => r.coverage === 100).length;
  const avg = total > 0 ? Math.round(uiStates.reduce((s, r) => s + r.coverage, 0) / total) : 0;
  const statsTitle = locale === 'ja' ? '### 統計' : '### Statistics';
  lines.push(statsTitle);
  lines.push(`- ${locale === 'ja' ? '全画面数' : 'Total screens'}: ${total}`);
  lines.push(`- ${locale === 'ja' ? '完全カバー' : 'Full coverage'}: ${full}`);
  lines.push(`- ${locale === 'ja' ? '平均カバー率' : 'Average coverage'}: ${avg}%`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 各画面の詳細
  const frames = doc.children.filter((n) => n.type === 'frame' && typeof (n as { width?: unknown }).width === 'number' && ((n as { width: number }).width) >= 100);

  for (const frame of frames) {
    const group = uiStates.find((g) => g.frames.some((f) => f.id === frame.id));
    const stateInfo = group
      ? { detectedStates: group.detectedStates, missingStates: group.missingStates }
      : { detectedStates: new Set<UIState>(['ideal']), missingStates: ALL_STATES.filter((s) => s !== 'ideal') };

    lines.push(generateScreenPage(frame, stateInfo, locale));
    lines.push('---');
    lines.push('');
  }

  // デザイントークン
  if (doc.variables && typeof doc.variables === 'object') {
    const tokenTitle = locale === 'ja' ? '# 🔧 デザイントークン' : '# 🔧 Design Tokens';
    lines.push(tokenTitle);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(doc.variables, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

/** Markdown をファイルとしてダウンロード */
export function downloadMarkdown(content: string, fileName = 'design-doc.md'): void {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

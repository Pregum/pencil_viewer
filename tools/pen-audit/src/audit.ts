/**
 * pen-audit の中核。ここは純粋関数だけを置く。
 *
 * ファイルシステムにも GitHub API にも触れないので、vitest からそのまま呼べる。
 * 実際の入出力は index.ts (glue) と github.ts が担当する。
 */

import { parsePen } from '../../../src/pen/parser';
import { analyzeUIStates, type ScreenGroup } from '../../../src/analysis/uiStates';

export type Locale = 'en' | 'ja' | 'zh';

/** 監査対象の 1 ファイル。内容は呼び出し側が読み込んで渡す。 */
export interface PenFileInput {
  path: string;
  text: string;
}

export interface ParseFailure {
  summary: string;
  issues: Array<{ path: string; message: string }>;
}

export interface FileAudit {
  path: string;
  /** zod 検証を通ったか。false なら screens は空。 */
  valid: boolean;
  error?: ParseFailure;
  screens: ScreenGroup[];
  /** ファイル内の画面カバレッジ平均 (画面が 0 件なら null) */
  coverage: number | null;
}

export interface AuditResult {
  files: FileAudit[];
  invalidCount: number;
  screenCount: number;
  /** 全画面のカバレッジ平均 (画面が 0 件なら null) */
  averageCoverage: number | null;
  /** 最も低い画面のカバレッジ (画面が 0 件なら null) */
  lowestCoverage: number | null;
}

const AVERAGE = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

/** 1 ファイルを検証して Five UI States を集計する。 */
export function auditFile(file: PenFileInput): FileAudit {
  // JSON 構文エラーは自前で受ける。ビューアー側の summary は日本語固定で、
  // このアクションの既定 locale (en) のレポートに混ざると読めなくなるため。
  let json: unknown;
  try {
    json = JSON.parse(file.text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      path: file.path,
      valid: false,
      error: { summary: `Not valid JSON: ${message}`, issues: [{ path: '', message }] },
      screens: [],
      coverage: null,
    };
  }
  const parsed = parsePen(json);
  if (!parsed.ok) {
    return { path: file.path, valid: false, error: parsed.error, screens: [], coverage: null };
  }
  const screens = analyzeUIStates(parsed.doc);
  return {
    path: file.path,
    valid: true,
    screens,
    coverage: AVERAGE(screens.map((s) => s.coverage)),
  };
}

/** 複数ファイルを監査して全体のサマリまで作る。 */
export function audit(files: PenFileInput[]): AuditResult {
  const results = files.map(auditFile);
  const coverages = results.flatMap((f) => f.screens.map((s) => s.coverage));
  return {
    files: results,
    invalidCount: results.filter((f) => !f.valid).length,
    screenCount: coverages.length,
    averageCoverage: AVERAGE(coverages),
    lowestCoverage: coverages.length === 0 ? null : Math.min(...coverages),
  };
}

/**
 * 失敗理由。文言はここでは作らず report.ts が locale ごとに組み立てる。
 */
export type VerdictReason =
  { kind: 'parse-error'; count: number } | { kind: 'low-coverage'; minCoverage: number; screens: string[] };

export interface Verdict {
  /** チェックを失敗させるか */
  failed: boolean;
  /** 失敗理由。failed が false なら空配列。 */
  reasons: VerdictReason[];
}

export interface VerdictOptions {
  /** パース失敗をチェック失敗として扱うか */
  failOnParseError: boolean;
  /** 下回ったら失敗させるカバレッジ (null なら判定しない) */
  minCoverage: number | null;
}

/** 監査結果からチェックの合否を決める。 */
export function verdict(result: AuditResult, options: VerdictOptions): Verdict {
  const reasons: VerdictReason[] = [];
  if (options.failOnParseError && result.invalidCount > 0) {
    reasons.push({ kind: 'parse-error', count: result.invalidCount });
  }
  const { minCoverage } = options;
  if (minCoverage !== null && result.lowestCoverage !== null) {
    const screens = result.files.flatMap((f) =>
      f.screens.filter((s) => s.coverage < minCoverage).map((s) => `${f.path} › ${s.screenName}`),
    );
    if (screens.length > 0) {
      reasons.push({ kind: 'low-coverage', minCoverage, screens });
    }
  }
  return { failed: reasons.length > 0, reasons };
}

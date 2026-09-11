/**
 * 監査結果を Markdown に整形する。ここも純粋関数だけ。
 *
 * 出力は 2 か所で使う。
 * - `$GITHUB_STEP_SUMMARY` (ジョブの要約)
 * - PR コメント (同じ本文をそのまま貼る)
 */

import { UI_STATE_LABELS, type UIState } from '../../../src/analysis/uiStates';
import type { AuditResult, FileAudit, Locale, Verdict, VerdictReason } from './audit';

/** PR コメントを一意に特定するための隠しマーカー。本文の先頭に必ず入れる。 */
export const COMMENT_MARKER = '<!-- pen-audit -->';

/** GitHub のコメント本文上限は 65536 文字。余白を見て少し手前で切る。 */
export const MAX_COMMENT_LENGTH = 60000;

const T = {
  en: {
    title: 'Pencil design check',
    checked: (n: number) => `${n} \`.pen\` file${n === 1 ? '' : 's'} checked`,
    invalid: (n: number) => `${n} invalid`,
    allValid: 'all valid',
    noFiles: 'No `.pen` files matched. Nothing to check.',
    errHead: 'Validation errors',
    errCol: ['File', 'Problem'],
    statesHead: 'Five UI States',
    statesCol: ['File', 'Screen', 'Coverage', 'Missing'],
    noScreens: 'No frames were recognised as screens, so there is nothing to report on UI states.',
    complete: 'complete',
    failed: 'Check failed',
    passed: 'Check passed',
    parseErrorReason: (n: number) => `${n} \`.pen\` file${n === 1 ? '' : 's'} failed validation.`,
    lowCoverageReason: (n: number, min: number, screens: string) =>
      `${n} screen${n === 1 ? '' : 's'} below ${min}% state coverage: ${screens}.`,
    advisory: 'State coverage is advisory. Only validation errors fail this check by default.',
    truncated:
      'Report truncated because it exceeded the comment size limit. See the job summary for the full version.',
  },
  ja: {
    title: 'Pencil デザインチェック',
    checked: (n: number) => `\`.pen\` ファイル ${n} 件を検査`,
    invalid: (n: number) => `${n} 件が不正`,
    allValid: 'すべて正常',
    noFiles: '対象の `.pen` ファイルがありません。チェックはスキップしました。',
    errHead: '検証エラー',
    errCol: ['ファイル', '内容'],
    statesHead: 'Five UI States',
    statesCol: ['ファイル', '画面', 'カバレッジ', '不足している状態'],
    noScreens: '画面として認識できるフレームがないため、状態の集計対象はありません。',
    complete: '充足',
    failed: 'チェック失敗',
    passed: 'チェック成功',
    parseErrorReason: (n: number) => `\`.pen\` ファイル ${n} 件が検証に失敗しました。`,
    lowCoverageReason: (n: number, min: number, screens: string) =>
      `${n} 画面がカバレッジ ${min}% を下回りました: ${screens}。`,
    advisory: 'カバレッジは参考値です。既定でチェックを失敗させるのは検証エラーだけです。',
    truncated: 'コメントの文字数上限を超えたため省略しました。全文はジョブサマリーを見てください。',
  },
  zh: {
    title: 'Pencil 设计检查',
    checked: (n: number) => `已检查 ${n} 个 \`.pen\` 文件`,
    invalid: (n: number) => `${n} 个无效`,
    allValid: '全部有效',
    noFiles: '没有匹配到 `.pen` 文件，已跳过检查。',
    errHead: '校验错误',
    errCol: ['文件', '问题'],
    statesHead: 'Five UI States',
    statesCol: ['文件', '画面', '覆盖率', '缺失状态'],
    noScreens: '没有可识别为画面的框架，因此没有状态统计。',
    complete: '完整',
    failed: '检查失败',
    passed: '检查通过',
    parseErrorReason: (n: number) => `${n} 个 \`.pen\` 文件校验失败。`,
    lowCoverageReason: (n: number, min: number, screens: string) =>
      `${n} 个画面低于 ${min}% 覆盖率：${screens}。`,
    advisory: '覆盖率仅供参考。默认只有校验错误会让检查失败。',
    truncated: '因超出评论长度上限而截断。完整内容请查看作业摘要。',
  },
} as const;

/** Markdown の表セルに入れても崩れないように整える。 */
export function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

const stateLabel = (state: UIState, locale: Locale): string =>
  `${UI_STATE_LABELS[state].icon} ${UI_STATE_LABELS[state][locale]}`;

const coverageIcon = (coverage: number): string => (coverage === 100 ? '✅' : coverage >= 60 ? '⚠️' : '❌');

/** 失敗理由を locale に合わせた 1 行に直す。 */
export function formatReason(reason: VerdictReason, locale: Locale): string {
  const t = T[locale];
  if (reason.kind === 'parse-error') return t.parseErrorReason(reason.count);
  return t.lowCoverageReason(
    reason.screens.length,
    reason.minCoverage,
    reason.screens.map((s) => `\`${s}\``).join(', '),
  );
}

function errorTable(files: FileAudit[], locale: Locale): string[] {
  const t = T[locale];
  const invalid = files.filter((f) => !f.valid);
  if (invalid.length === 0) return [];
  const lines = [`### ❌ ${t.errHead}`, '', `| ${t.errCol[0]} | ${t.errCol[1]} |`, '| --- | --- |'];
  for (const file of invalid) {
    const detail = file.error?.issues.length
      ? file.error.issues.map((i) => `\`${i.path || '(root)'}\`: ${i.message}`).join('<br>')
      : (file.error?.summary ?? 'unknown error');
    lines.push(`| \`${escapeCell(file.path)}\` | ${escapeCell(detail)} |`);
  }
  lines.push('');
  return lines;
}

function statesTable(files: FileAudit[], locale: Locale): string[] {
  const t = T[locale];
  const valid = files.filter((f) => f.valid);
  if (valid.length === 0) return [];
  const rows = valid.flatMap((file) =>
    file.screens.map((screen) => {
      const missing =
        screen.missingStates.length === 0
          ? `— (${t.complete})`
          : screen.missingStates.map((s) => stateLabel(s, locale)).join(', ');
      return `| \`${escapeCell(file.path)}\` | ${escapeCell(screen.screenName)} | ${coverageIcon(screen.coverage)} ${screen.coverage}% | ${missing} |`;
    }),
  );
  const lines = [`### ${t.statesHead}`, ''];
  if (rows.length === 0) {
    lines.push(t.noScreens, '');
    return lines;
  }
  lines.push(`| ${t.statesCol.join(' | ')} |`, '| --- | --- | --- | --- |', ...rows, '');
  return lines;
}

export interface RenderOptions {
  locale?: Locale;
  /** 見出しの下に出す 1 行。ワークフロー名など。 */
  context?: string;
}

/** 監査結果と合否から、そのまま貼れる Markdown を作る。 */
export function renderReport(result: AuditResult, check: Verdict, options: RenderOptions = {}): string {
  const locale = options.locale ?? 'en';
  const t = T[locale];
  const lines: string[] = [COMMENT_MARKER, `## 🖊 ${t.title}`, ''];

  if (result.files.length === 0) {
    lines.push(t.noFiles, '');
    return lines.join('\n');
  }

  const status = check.failed ? `❌ **${t.failed}**` : `✅ **${t.passed}**`;
  const validity = result.invalidCount > 0 ? t.invalid(result.invalidCount) : t.allValid;
  const [comma, period] = locale === 'en' ? [', ', '.'] : ['、', '。'];
  lines.push(`${status} — ${t.checked(result.files.length)}${comma}${validity}${period}`, '');

  if (check.failed) {
    lines.push(...check.reasons.map((r) => `- ${formatReason(r, locale)}`), '');
  }
  if (options.context) {
    lines.push(`<sub>${options.context}</sub>`, '');
  }

  lines.push(...errorTable(result.files, locale));
  lines.push(...statesTable(result.files, locale));
  lines.push(`<sub>${t.advisory}</sub>`);
  return lines.join('\n');
}

/** コメント上限に収まるように末尾を落とす。 */
export function truncateForComment(body: string, locale: Locale = 'en'): string {
  if (body.length <= MAX_COMMENT_LENGTH) return body;
  const note = `\n\n<sub>${T[locale].truncated}</sub>`;
  return `${body.slice(0, MAX_COMMENT_LENGTH - note.length)}${note}`;
}

/**
 * GitHub Actions のエントリポイント。
 *
 * ここは環境変数の読み取りと出力だけを担当する。判断は audit.ts / report.ts に置く。
 */

import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { audit, verdict, type Locale } from './audit';
import { collectPaths, matchesAny, readPenFiles } from './files';
import { GitHubClient } from './github';
import { readBoolInput, readInput, readLines } from './inputs';
import { renderReport, truncateForComment } from './report';

const LOCALES = new Set<Locale>(['en', 'ja', 'zh']);

const input = (name: string, fallback = ''): string => readInput(process.env, name, fallback);

const boolInput = (name: string, fallback: boolean): boolean => readBoolInput(process.env, name, fallback);

async function writeFileLines(target: string | undefined, text: string): Promise<void> {
  if (!target) return;
  await appendFile(target, `${text}\n`, 'utf8');
}

/** Actions のログに出すアノテーション。UI 上でファイルに紐づいて表示される。 */
function annotate(level: 'error' | 'warning', file: string, message: string): void {
  const escaped = message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::${level} file=${file}::${escaped}`);
}

async function main(): Promise<number> {
  const root = path.resolve(process.cwd(), input('working-directory', '.'));
  // アノテーションとファイル一覧の突き合わせはワークスペース相対のパスで行う
  const prefix = toPosix(path.relative(process.cwd(), root));
  const inRepo = (filePath: string): string =>
    prefix === '' || prefix.startsWith('..') ? filePath : `${prefix}/${filePath}`;
  const patterns = readLines(input('paths', '**/*.pen'));
  const changedOnly = boolInput('changed-only', true);
  const failOnParseError = boolInput('fail-on-parse-error', true);
  const wantComment = boolInput('comment', true);
  const minCoverageRaw = input('min-coverage');
  const minCoverage = minCoverageRaw === '' ? null : Number(minCoverageRaw);
  if (minCoverage !== null && !Number.isFinite(minCoverage)) {
    console.log(`::error::min-coverage must be a number, got "${minCoverageRaw}"`);
    return 1;
  }
  const localeRaw = input('locale', 'en') as Locale;
  const locale = LOCALES.has(localeRaw) ? localeRaw : 'en';

  const token = input('token');
  const repo = process.env.GITHUB_REPOSITORY ?? '';
  const prNumber = await readPullRequestNumber();
  const client = token && repo ? new GitHubClient({ token, repo, apiUrl: process.env.GITHUB_API_URL }) : null;

  let targets = await collectPaths(root, patterns);
  let scope = 'all matching files';
  if (changedOnly && client && prNumber !== null) {
    try {
      const changed = new Set(await client.listChangedFiles(prNumber));
      targets = targets.filter((p) => changed.has(inRepo(p)));
      scope = `files changed in #${prNumber}`;
    } catch (error) {
      console.log(`::warning::could not list changed files, auditing everything (${String(error)})`);
    }
  }
  // パターンを二重に適用しておく。変更ファイル一覧経由でも対象が広がらないようにする
  targets = targets.filter((p) => matchesAny(p, patterns));

  const files = await readPenFiles(root, targets);
  const result = audit(files);
  const check = verdict(result, { failOnParseError, minCoverage });

  for (const file of result.files) {
    if (file.valid) continue;
    const first = file.error?.issues[0];
    const message = first
      ? `${first.path || '(root)'}: ${first.message}`
      : (file.error?.summary ?? 'invalid .pen file');
    annotate('error', inRepo(file.path), message);
  }

  // 通常は走査範囲だけ。1 件も拾えなかったときは追跡できるように条件も添える
  const context =
    result.files.length === 0
      ? `Scope: ${scope} · Patterns: ${patterns.join(', ')} · Root: ${root}`
      : `Scope: ${scope}`;
  const body = renderReport(result, check, { locale, context });
  await writeFileLines(process.env.GITHUB_STEP_SUMMARY, body);
  console.log(body);

  await writeOutputs({
    'invalid-count': String(result.invalidCount),
    'screen-count': String(result.screenCount),
    'average-coverage': result.averageCoverage === null ? '' : String(result.averageCoverage),
    'lowest-coverage': result.lowestCoverage === null ? '' : String(result.lowestCoverage),
    failed: String(check.failed),
  });

  if (wantComment && client && prNumber !== null) {
    try {
      // 対象ファイルが 1 件も無いときに新しいコメントを立てても邪魔なだけ。
      // 既にあるコメントは「今回は対象なし」に更新しておく。
      const outcome = await client.upsertComment(prNumber, truncateForComment(body, locale), {
        createIfMissing: result.files.length > 0,
      });
      if (outcome === null) {
        console.log('::notice::no permission to comment on this pull request, summary only');
      }
    } catch (error) {
      console.log(`::warning::could not post the pull request comment (${String(error)})`);
    }
  }

  return check.failed ? 1 : 0;
}

/** Windows ランナーでも突き合わせが壊れないように区切りを `/` に揃える。 */
function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * 対象の PR 番号。イベントペイロードを正とし、無ければ `GITHUB_REF` から拾う。
 * どちらも無ければ PR コンテキストではないので null。
 */
async function readPullRequestNumber(): Promise<number | null> {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    try {
      const payload = JSON.parse(await readFile(eventPath, 'utf8')) as {
        pull_request?: { number?: number };
        issue?: { number?: number; pull_request?: unknown };
      };
      if (typeof payload.pull_request?.number === 'number') return payload.pull_request.number;
      if (payload.issue?.pull_request && typeof payload.issue.number === 'number') {
        return payload.issue.number;
      }
    } catch {
      // ペイロードが読めないときは ref にフォールバックする
    }
  }
  const fromRef = /^refs\/pull\/(\d+)\//.exec(process.env.GITHUB_REF ?? '');
  return fromRef ? Number(fromRef[1]) : null;
}

async function writeOutputs(outputs: Record<string, string>): Promise<void> {
  const target = process.env.GITHUB_OUTPUT;
  if (!target) return;
  const text = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  await writeFileLines(target, text);
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.log(`::error::pen-audit crashed: ${String(error)}`);
    process.exitCode = 1;
  },
);

import { describe, it, expect, vi } from 'vitest';
import { audit, auditFile, verdict } from '../tools/pen-audit/src/audit';
import { globToRegExp, matchesAny } from '../tools/pen-audit/src/files';
import { inputEnvName, readBoolInput, readInput, readLines } from '../tools/pen-audit/src/inputs';
import { GitHubClient, selectExistingComment, type IssueComment } from '../tools/pen-audit/src/github';
import {
  COMMENT_MARKER,
  MAX_COMMENT_LENGTH,
  escapeCell,
  formatReason,
  renderReport,
  truncateForComment,
} from '../tools/pen-audit/src/report';

/** 画面 1 枚ぶんのフレーム。100x100 未満はスキップされるので大きめに作る。 */
const frame = (id: string, name: string) => ({
  type: 'frame',
  id,
  name,
  x: 0,
  y: 0,
  width: 390,
  height: 844,
  children: [],
});

const docText = (...names: string[]) =>
  JSON.stringify({
    version: '2.10',
    children: names.map((name, index) => frame(`f${index}`, name)),
  });

describe('アクション入力の読み取り', () => {
  it('GitHub はハイフンを保ったまま大文字にする', () => {
    expect(inputEnvName('changed-only')).toBe('INPUT_CHANGED-ONLY');
    expect(inputEnvName('paths')).toBe('INPUT_PATHS');
  });

  it('空白だけがアンダースコアになる', () => {
    expect(inputEnvName('min coverage')).toBe('INPUT_MIN_COVERAGE');
  });

  it('GitHub が渡す名前で読める', () => {
    expect(readBoolInput({ 'INPUT_CHANGED-ONLY': 'false' }, 'changed-only', true)).toBe(false);
  });

  it('手動実行用にアンダースコア版も読む', () => {
    expect(readBoolInput({ INPUT_CHANGED_ONLY: 'false' }, 'changed-only', true)).toBe(false);
  });

  it('GitHub 形式を優先する', () => {
    const env = { 'INPUT_CHANGED-ONLY': 'false', INPUT_CHANGED_ONLY: 'true' };
    expect(readBoolInput(env, 'changed-only', true)).toBe(false);
  });

  it('未設定と空文字は既定値に落ちる', () => {
    expect(readBoolInput({}, 'changed-only', true)).toBe(true);
    expect(readBoolInput({ 'INPUT_CHANGED-ONLY': '   ' }, 'changed-only', true)).toBe(true);
    expect(readInput({ INPUT_PATHS: '' }, 'paths', '**/*.pen')).toBe('**/*.pen');
  });

  it('true 以外はすべて false として扱う', () => {
    expect(readBoolInput({ 'INPUT_CHANGED-ONLY': 'TRUE' }, 'changed-only', false)).toBe(true);
    expect(readBoolInput({ 'INPUT_CHANGED-ONLY': 'yes' }, 'changed-only', true)).toBe(false);
  });

  it('複数行入力から空行とコメントを落とす', () => {
    expect(readLines('a.pen\n\n  # メモ\n  b/*.pen  ')).toEqual(['a.pen', 'b/*.pen']);
  });
});

describe('globToRegExp / matchesAny', () => {
  it('* は階層をまたがない', () => {
    expect(globToRegExp('*.pen').test('a.pen')).toBe(true);
    expect(globToRegExp('*.pen').test('designs/a.pen')).toBe(false);
  });

  it('**/ は 0 階層以上に当たる', () => {
    const re = globToRegExp('**/*.pen');
    expect(re.test('a.pen')).toBe(true);
    expect(re.test('designs/wf/a.pen')).toBe(true);
  });

  it('拡張子の . をワイルドカードとして扱わない', () => {
    expect(globToRegExp('*.pen').test('axpen')).toBe(false);
  });

  it('? は 1 文字ぶん', () => {
    expect(globToRegExp('a?.pen').test('ab.pen')).toBe(true);
    expect(globToRegExp('a?.pen').test('abc.pen')).toBe(false);
  });

  it('先頭の ./ を無視し、いずれかのパターンに当たれば true', () => {
    expect(matchesAny('./designs/a.pen', ['designs/**/*.pen'])).toBe(true);
    expect(matchesAny('docs/a.md', ['**/*.pen', '**/*.md'])).toBe(true);
    expect(matchesAny('docs/a.md', ['**/*.pen'])).toBe(false);
  });
});

describe('auditFile', () => {
  it('検証を通ったファイルは画面を集計する', () => {
    const result = auditFile({ path: 'a.pen', text: docText('Login', 'Login - Empty') });
    expect(result.valid).toBe(true);
    expect(result.screens).toHaveLength(1);
    expect(result.screens[0].screenName).toBe('Login');
    expect(result.screens[0].coverage).toBe(40);
    expect(result.coverage).toBe(40);
  });

  it('壊れた JSON はエラーとして返り、例外を投げない', () => {
    const result = auditFile({ path: 'a.pen', text: '{ nope' });
    expect(result.valid).toBe(false);
    expect(result.screens).toEqual([]);
    expect(result.coverage).toBeNull();
  });

  it('JSON 構文エラーの文言は既定 locale に合わせて英語で返す', () => {
    const result = auditFile({ path: 'a.pen', text: '{ nope' });
    expect(result.error?.summary).toMatch(/^Not valid JSON: /);
    expect(result.error?.issues).toHaveLength(1);
  });

  it('スキーマに合わない JSON もエラーとして返る', () => {
    const result = auditFile({ path: 'a.pen', text: '{"version":"1.0","children":"nope"}' });
    expect(result.valid).toBe(false);
    expect(result.error?.issues.length).toBeGreaterThan(0);
  });

  it('画面が 1 つも無いファイルの平均は null', () => {
    const result = auditFile({ path: 'a.pen', text: JSON.stringify({ version: '2.10', children: [] }) });
    expect(result.valid).toBe(true);
    expect(result.coverage).toBeNull();
  });
});

describe('audit', () => {
  const result = audit([
    { path: 'ok.pen', text: docText('Login', 'Login - Empty', 'Login - Loading') },
    { path: 'bad.pen', text: '{ nope' },
    { path: 'thin.pen', text: docText('Home') },
  ]);

  it('不正なファイルを数える', () => {
    expect(result.invalidCount).toBe(1);
  });

  it('画面数は全ファイルの合計', () => {
    expect(result.screenCount).toBe(2);
  });

  it('平均と最小を全画面から出す', () => {
    expect(result.averageCoverage).toBe(40); // (60 + 20) / 2
    expect(result.lowestCoverage).toBe(20);
  });

  it('画面が無ければ平均も最小も null', () => {
    const empty = audit([]);
    expect(empty.averageCoverage).toBeNull();
    expect(empty.lowestCoverage).toBeNull();
  });
});

describe('verdict', () => {
  const withError = audit([{ path: 'bad.pen', text: '{ nope' }]);
  const lowCoverage = audit([{ path: 'a.pen', text: docText('Home') }]);

  it('既定では検証エラーで落ちる', () => {
    expect(verdict(withError, { failOnParseError: true, minCoverage: null }).failed).toBe(true);
  });

  it('fail-on-parse-error を切れば検証エラーでは落ちない', () => {
    expect(verdict(withError, { failOnParseError: false, minCoverage: null }).failed).toBe(false);
  });

  it('カバレッジ未指定なら低くても落ちない', () => {
    expect(verdict(lowCoverage, { failOnParseError: true, minCoverage: null }).failed).toBe(false);
  });

  it('min-coverage を下回る画面があれば落ち、画面名を理由に持つ', () => {
    const check = verdict(lowCoverage, { failOnParseError: true, minCoverage: 60 });
    expect(check.failed).toBe(true);
    expect(check.reasons[0]).toEqual({
      kind: 'low-coverage',
      minCoverage: 60,
      screens: ['a.pen › Home'],
    });
  });

  it('理由は文言ではなく種別で返す', () => {
    const check = verdict(withError, { failOnParseError: true, minCoverage: null });
    expect(check.reasons[0]).toEqual({ kind: 'parse-error', count: 1 });
  });

  it('min-coverage を満たしていれば落ちない', () => {
    const check = verdict(lowCoverage, { failOnParseError: true, minCoverage: 20 });
    expect(check.failed).toBe(false);
    expect(check.reasons).toEqual([]);
  });
});

describe('renderReport', () => {
  const result = audit([
    { path: 'designs/app.pen', text: docText('Home') },
    { path: 'designs/bad.pen', text: '{"version":"1.0","children":"nope"}' },
  ]);
  const check = verdict(result, { failOnParseError: true, minCoverage: null });
  const body = renderReport(result, check, { locale: 'en' });

  it('本文はマーカーで始まる', () => {
    expect(body.startsWith(COMMENT_MARKER)).toBe(true);
  });

  it('失敗した理由を箇条書きで出す', () => {
    expect(body).toContain('Check failed');
    expect(body).toContain('- 1 `.pen` file failed validation.');
  });

  it('検証エラーの表にファイルと内容を出す', () => {
    expect(body).toContain('Validation errors');
    expect(body).toContain('`designs/bad.pen`');
    expect(body).toContain('expected array');
  });

  it('状態の表に不足している状態を出す', () => {
    expect(body).toContain('Five UI States');
    expect(body).toContain('| `designs/app.pen` | Home |');
    expect(body).toContain('Loading');
  });

  it('対象が無ければその旨だけを出す', () => {
    const empty = audit([]);
    const rendered = renderReport(empty, verdict(empty, { failOnParseError: true, minCoverage: null }));
    expect(rendered).toContain('No `.pen` files matched');
    expect(rendered).not.toContain('Five UI States');
  });

  it('locale で見出しが切り替わる', () => {
    const ja = renderReport(result, check, { locale: 'ja' });
    expect(ja).toContain('Pencil デザインチェック');
    expect(ja).toContain('検証エラー');
  });

  it('失敗理由も locale に追随する', () => {
    const ja = renderReport(result, check, { locale: 'ja' });
    expect(ja).toContain('- `.pen` ファイル 1 件が検証に失敗しました。');
    expect(ja).not.toContain('failed validation');
  });

  it('カバレッジ不足の理由は画面名と閾値を含む', () => {
    const low = audit([{ path: 'a.pen', text: docText('Home') }]);
    const rendered = renderReport(low, verdict(low, { failOnParseError: true, minCoverage: 60 }));
    expect(rendered).toContain('below 60% state coverage');
    expect(rendered).toContain('a.pen › Home');
  });

  it('context を渡すと本文に添える', () => {
    expect(renderReport(result, check, { context: 'Scope: x' })).toContain('<sub>Scope: x</sub>');
  });

  it('成功したときは理由を出さない', () => {
    const ok = audit([{ path: 'a.pen', text: docText('Home') }]);
    const rendered = renderReport(ok, verdict(ok, { failOnParseError: true, minCoverage: null }));
    expect(rendered).toContain('Check passed');
    expect(rendered).not.toContain('Check failed');
  });
});

describe('formatReason', () => {
  it('単数と複数で語尾を変える', () => {
    expect(formatReason({ kind: 'parse-error', count: 1 }, 'en')).toContain('file failed');
    expect(formatReason({ kind: 'parse-error', count: 2 }, 'en')).toContain('files failed');
  });

  it('zh でも中国語の文言を返す', () => {
    expect(formatReason({ kind: 'parse-error', count: 1 }, 'zh')).toContain('校验失败');
  });
});

describe('escapeCell / truncateForComment', () => {
  it('セルを壊すパイプと改行を無害化する', () => {
    expect(escapeCell('a | b\nc')).toBe('a \\| b c');
  });

  it('上限以下ならそのまま返す', () => {
    expect(truncateForComment('short')).toBe('short');
  });

  it('上限を超えたら切って注記を足す', () => {
    const long = 'x'.repeat(MAX_COMMENT_LENGTH + 100);
    const cut = truncateForComment(long, 'ja');
    expect(cut.length).toBeLessThanOrEqual(MAX_COMMENT_LENGTH);
    expect(cut).toContain('省略しました');
  });
});

describe('selectExistingComment', () => {
  const comments: IssueComment[] = [
    { id: 1, body: 'looks good' },
    { id: 2, body: `${COMMENT_MARKER}\n## report` },
    { id: 3, body: `${COMMENT_MARKER}\n## older` },
  ];

  it('マーカーを含む最初のコメントを選ぶ', () => {
    expect(selectExistingComment(comments)?.id).toBe(2);
  });

  it('マーカーが無ければ null', () => {
    expect(selectExistingComment([{ id: 1, body: 'hi' }])).toBeNull();
  });

  it('本文が null のコメントでも落ちない', () => {
    expect(selectExistingComment([{ id: 1, body: null }])).toBeNull();
  });
});

/** fetch のふりをして、呼ばれた順にレスポンスを返す。 */
const fakeFetch = (responses: Array<{ status: number; body?: unknown }>) => {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const next = responses[calls.length] ?? { status: 500 };
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(next.body === undefined ? '' : JSON.stringify(next.body), {
      status: next.status,
    });
  });
  return { impl: impl as unknown as typeof fetch, calls };
};

describe('GitHubClient', () => {
  const client = (responses: Array<{ status: number; body?: unknown }>) => {
    const { impl, calls } = fakeFetch(responses);
    return {
      calls,
      client: new GitHubClient({ token: 't', repo: 'o/r', fetchImpl: impl }),
    };
  };

  it('既存コメントが無ければ新規投稿する', async () => {
    const { client: c, calls } = client([
      { status: 200, body: [{ id: 1, body: 'unrelated' }] },
      { status: 201, body: { id: 9 } },
    ]);
    expect(await c.upsertComment(7, 'hello')).toBe('created');
    expect(calls[1].method).toBe('POST');
    expect(calls[1].url).toContain('/repos/o/r/issues/7/comments');
    expect(calls[1].body).toEqual({ body: 'hello' });
  });

  it('既存コメントがあれば書き換える', async () => {
    const { client: c, calls } = client([
      { status: 200, body: [{ id: 42, body: `${COMMENT_MARKER} old` }] },
      { status: 200, body: { id: 42 } },
    ]);
    expect(await c.upsertComment(7, 'new')).toBe('updated');
    expect(calls[1].method).toBe('PATCH');
    expect(calls[1].url).toContain('/repos/o/r/issues/comments/42');
  });

  it('fork の PR で権限が無ければ例外にせず null を返す', async () => {
    const { client: c } = client([{ status: 403 }]);
    expect(await c.upsertComment(7, 'x')).toBeNull();
  });

  it('投稿だけ拒否された場合も null を返す', async () => {
    const { client: c } = client([{ status: 200, body: [] }, { status: 403 }]);
    expect(await c.upsertComment(7, 'x')).toBeNull();
  });

  it('2 ページ目にマーカーがあっても見つけて書き換える', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, body: 'noise' }));
    const { client: c, calls } = client([
      { status: 200, body: page1 },
      { status: 200, body: [{ id: 777, body: `${COMMENT_MARKER} old` }] },
      { status: 200, body: { id: 777 } },
    ]);
    expect(await c.upsertComment(7, 'new')).toBe('updated');
    expect(calls[1].url).toContain('page=2');
    expect(calls[2].url).toContain('/issues/comments/777');
  });

  it('createIfMissing が false なら新規投稿しない', async () => {
    const { client: c, calls } = client([{ status: 200, body: [] }]);
    expect(await c.upsertComment(7, 'x', { createIfMissing: false })).toBe('skipped');
    expect(calls).toHaveLength(1);
  });

  it('createIfMissing が false でも既存があれば書き換える', async () => {
    const { client: c, calls } = client([
      { status: 200, body: [{ id: 5, body: `${COMMENT_MARKER} old` }] },
      { status: 200, body: { id: 5 } },
    ]);
    expect(await c.upsertComment(7, 'x', { createIfMissing: false })).toBe('updated');
    expect(calls[1].method).toBe('PATCH');
  });

  it('一覧取得が想定外に失敗したら例外にする', async () => {
    const { client: c } = client([{ status: 500 }]);
    await expect(c.upsertComment(7, 'x')).rejects.toThrow('list comments failed: 500');
  });

  it('変更ファイルから削除されたものを除く', async () => {
    const { client: c } = client([
      {
        status: 200,
        body: [
          { filename: 'a.pen', status: 'modified' },
          { filename: 'gone.pen', status: 'removed' },
        ],
      },
    ]);
    expect(await c.listChangedFiles(3)).toEqual(['a.pen']);
  });

  it('100 件ちょうどなら次のページも取りに行く', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      filename: `f${i}.pen`,
      status: 'added',
    }));
    const { client: c, calls } = client([
      { status: 200, body: page1 },
      { status: 200, body: [{ filename: 'last.pen', status: 'added' }] },
    ]);
    const files = await c.listChangedFiles(3);
    expect(files).toHaveLength(101);
    expect(calls[1].url).toContain('page=2');
  });
});

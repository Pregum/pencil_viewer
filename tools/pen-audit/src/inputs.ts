/**
 * アクション入力の読み取り。
 *
 * GitHub は入力名をそのまま大文字にして `INPUT_` を付けるだけで、
 * ハイフンはアンダースコアに**しない**。`changed-only` は
 * `INPUT_CHANGED-ONLY` になる (空白だけが `_` に置き換わる)。
 * ローカルで手動実行するときのために `INPUT_CHANGED_ONLY` も見る。
 */

export type Env = Record<string, string | undefined>;

/** GitHub が実際に設定する環境変数名。 */
export function inputEnvName(name: string): string {
  return `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
}

export function readInput(env: Env, name: string, fallback = ''): string {
  const primary = env[inputEnvName(name)];
  const alias = env[inputEnvName(name).replace(/-/g, '_')];
  const raw = primary ?? alias;
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

export function readBoolInput(env: Env, name: string, fallback: boolean): boolean {
  const raw = readInput(env, name);
  return raw === '' ? fallback : raw.toLowerCase() === 'true';
}

/** 複数行入力を行の配列にする。空行と `#` 始まりは捨てる。 */
export function readLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

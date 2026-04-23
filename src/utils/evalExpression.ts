/**
 * PropertyPanel 等の数値入力欄用の安全な数式評価。
 *
 * Figma 相当の挙動:
 *   "100 + 20"     -> 120
 *   "100 * 2"      -> 200
 *   "100 / 3"      -> 33.333...
 *   "10 + 5 * 2"   -> 20 (precedence)
 *   "(10 + 5) * 2" -> 30
 *   "-10"          -> -10
 *   "10%"          -> current * 0.1 when ctx.current given
 *   "50vw" / "50vh" -> 50 percent of viewport width / height
 *
 * eval / Function は使わず、再帰降下パーサで + - * / ( ) と単項 - のみ受け付ける。
 * トークナイザが許可するのは 数字 / dot / 四則 / 括弧 / 空白 のみ。
 */

export interface EvalContext {
  /** percent input (e.g. "50%") の基準値 */
  current?: number;
  /** viewport 寸法 (vw / vh 用) */
  viewport?: { width: number; height: number };
}

export function evalExpression(input: string, ctx: EvalContext = {}): number | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;

  // 単純な数値ならそのまま
  const simple = Number(trimmed);
  if (!isNaN(simple) && isFinite(simple)) return simple;

  // `NN%` / `NNvw` / `NNvh` の suffix 展開は先に処理
  const suffixMatch = /^(-?\d*\.?\d+)(%|vw|vh)$/i.exec(trimmed);
  if (suffixMatch) {
    const n = parseFloat(suffixMatch[1]);
    const suffix = suffixMatch[2].toLowerCase();
    if (isNaN(n)) return null;
    if (suffix === '%') {
      if (ctx.current == null) return null;
      return (ctx.current * n) / 100;
    }
    if (suffix === 'vw') {
      if (!ctx.viewport) return null;
      return (ctx.viewport.width * n) / 100;
    }
    if (suffix === 'vh') {
      if (!ctx.viewport) return null;
      return (ctx.viewport.height * n) / 100;
    }
  }

  // 許可文字セットで validate（安全のため）
  if (!/^[-+*/().\d\s]+$/.test(trimmed)) return null;

  try {
    const tokens = tokenize(trimmed);
    const result = new Parser(tokens).parseExpr();
    if (!isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

// ---------------------- Tokenizer ----------------------
type Token = { kind: 'num'; value: number } | { kind: 'op'; value: '+' | '-' | '*' | '/' | '(' | ')' };

function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/\d|\./.test(ch)) {
      let j = i;
      while (j < s.length && /[\d.]/.test(s[j])) j++;
      const n = parseFloat(s.slice(i, j));
      if (isNaN(n)) throw new Error('invalid number');
      out.push({ kind: 'num', value: n });
      i = j;
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      out.push({ kind: 'op', value: ch as '+' | '-' | '*' | '/' | '(' | ')' });
      i++;
      continue;
    }
    throw new Error(`unexpected char: ${ch}`);
  }
  return out;
}

// ---------------------- Recursive descent parser ----------------------
class Parser {
  constructor(private tokens: Token[], private pos = 0) {}

  parseExpr(): number {
    const v = this.parseAddSub();
    if (this.pos < this.tokens.length) throw new Error('trailing tokens');
    return v;
  }

  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private advance(): Token { return this.tokens[this.pos++]; }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (true) {
      const t = this.peek();
      if (!t || t.kind !== 'op') break;
      if (t.value !== '+' && t.value !== '-') break;
      this.advance();
      const right = this.parseMulDiv();
      left = t.value === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (!t || t.kind !== 'op') break;
      if (t.value !== '*' && t.value !== '/') break;
      this.advance();
      const right = this.parseUnary();
      if (t.value === '/' && right === 0) throw new Error('div by zero');
      left = t.value === '*' ? left * right : left / right;
    }
    return left;
  }

  private parseUnary(): number {
    const t = this.peek();
    if (t && t.kind === 'op' && (t.value === '+' || t.value === '-')) {
      this.advance();
      const v = this.parseUnary();
      return t.value === '-' ? -v : v;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const t = this.advance();
    if (!t) throw new Error('unexpected end');
    if (t.kind === 'num') return t.value;
    if (t.kind === 'op' && t.value === '(') {
      const v = this.parseAddSub();
      const close = this.advance();
      if (!close || close.kind !== 'op' || close.value !== ')') throw new Error('missing )');
      return v;
    }
    throw new Error(`unexpected token: ${JSON.stringify(t)}`);
  }
}

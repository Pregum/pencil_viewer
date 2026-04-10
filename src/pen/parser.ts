/**
 * .pen ファイルのパーサー。
 *
 * - `parsePen(json)`: 任意の JSON 値を受け取り、Result 型で返す
 * - zod の safeParse をラップ
 * - 未知ノード `type` は捨てずに `UnsupportedNode` として通す(一部が未対応でも
 *   全体描画を止めないため)
 */

import { zPenDocument } from './schema';
import type {
  PenDocument,
  PenNode,
  FrameNode,
  GroupNode,
  UnsupportedNode,
} from './types';

export type ParseResult =
  | { ok: true; doc: PenDocument }
  | { ok: false; error: ParseError };

export interface ParseError {
  /** 先頭数件のエラー概要(UI 表示用) */
  summary: string;
  /** zod の issue の一部(デバッグ用) */
  issues: Array<{ path: string; message: string }>;
}

const KNOWN_TYPES = new Set([
  'rectangle',
  'ellipse',
  'line',
  'polygon',
  'path',
  'text',
  'frame',
  'group',
  'icon_font',
]);

/** ビューアーで非表示にするノードタイプ(開発者メモ等) */
const HIDDEN_TYPES = new Set(['context', 'note', 'connection']);

export function parsePen(input: unknown): ParseResult {
  const result = zPenDocument.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 5).map((i) => ({
      path: i.path.join('.') || '<root>',
      message: i.message,
    }));
    return {
      ok: false,
      error: {
        summary:
          issues.length > 0
            ? `スキーマ検証に失敗しました (${issues[0].path}: ${issues[0].message})`
            : 'スキーマ検証に失敗しました',
        issues,
      },
    };
  }

  // zod は unknown で通しているので、ノードを UnsupportedNode に振り分けて
  // 型を確定させる
  const raw = result.data as { version: string; children: unknown[] };
  const children = raw.children.map(normalizeNode).filter((n): n is PenNode => n != null);

  return {
    ok: true,
    doc: {
      ...raw,
      children,
    } as PenDocument,
  };
}

/**
 * JSON 文字列をパースして parsePen にかける統合関数。
 */
export function parsePenText(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: {
        summary: `JSON として読めませんでした: ${message}`,
        issues: [],
      },
    };
  }
  return parsePen(json);
}

function normalizeNode(raw: unknown): PenNode {
  if (!raw || typeof raw !== 'object') {
    return makeUnsupported(raw, '<invalid>');
  }
  const obj = raw as Record<string, unknown>;
  const type = typeof obj.type === 'string' ? obj.type : undefined;
  if (!type) {
    return makeUnsupported(raw, '<missing-type>');
  }
  // 非表示ノードはスキップ(null を返して親で除外)
  if (HIDDEN_TYPES.has(type)) {
    return null as unknown as PenNode; // filtered out by caller
  }
  if (!KNOWN_TYPES.has(type)) {
    return makeUnsupported(raw, type);
  }

  // frame / group は子ノードを再帰的に normalize
  if (type === 'frame' || type === 'group') {
    const children = Array.isArray(obj.children)
      ? (obj.children as unknown[]).map(normalizeNode).filter((n): n is PenNode => n != null)
      : undefined;
    return { ...(obj as unknown as FrameNode | GroupNode), children } as PenNode;
  }

  return obj as unknown as PenNode;
}

function makeUnsupported(raw: unknown, originalType: string): UnsupportedNode {
  const obj = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  return {
    type: 'unsupported',
    id: typeof obj.id === 'string' ? obj.id : `__unsupported_${Math.random().toString(36).slice(2, 8)}`,
    x: typeof obj.x === 'number' ? obj.x : 0,
    y: typeof obj.y === 'number' ? obj.y : 0,
    width: typeof obj.width === 'number' || typeof obj.width === 'string' ? obj.width : 120,
    height: typeof obj.height === 'number' || typeof obj.height === 'string' ? obj.height : 60,
    originalType,
    raw,
  };
}

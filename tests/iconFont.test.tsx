/**
 * IconFont のレンダリング検証 (#68 の遅延ロード込み)。
 *
 * lucide を動的 import に切り替えたため、初回描画では何も出ず、
 * ロード完了後にアイコンへ差し替わる。この 2 段階を確認する。
 * Material Symbols 側は同期描画のままであることも押さえる。
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { IconFont } from '../src/pen/renderer/IconFont';
import { __resetLucideForTest } from '../src/pen/renderer/lucideIcons';
import type { IconFontNode } from '../src/pen/types';

function icon(partial: Partial<IconFontNode> = {}): IconFontNode {
  return {
    type: 'icon_font', id: 'i1', x: 0, y: 0, width: 24, height: 24,
    iconFontFamily: 'lucide', iconFontName: 'arrow-left',
    ...partial,
  } as IconFontNode;
}

/** SVG 要素は <svg> の中に置く必要がある */
function renderIcon(node: IconFontNode) {
  return render(<svg>{<IconFont node={node} />}</svg>);
}

beforeEach(() => {
  __resetLucideForTest(null);
});

describe('IconFont — lucide (遅延ロード)', () => {
  it('ロード前は描画せず、ロード後にアイコンが現れる', async () => {
    const { container } = renderIcon(icon());

    // 初回は空の <g> のみでパスは無い
    expect(container.querySelectorAll('path, line, polyline, circle').length).toBe(0);

    await waitFor(() => {
      expect(container.querySelectorAll('path, line, polyline, circle').length).toBeGreaterThan(0);
    });
  });

  it('ロード後は stroke に fill 色が反映される', async () => {
    const { container } = renderIcon(icon({ fill: '#ff0000' } as Partial<IconFontNode>));
    await waitFor(() => {
      const g = container.querySelector('g[stroke]');
      expect(g?.getAttribute('stroke')).toBe('#ff0000');
    });
  });

  it('存在しないアイコン名はロード後にプレースホルダを描く', async () => {
    const { container } = renderIcon(icon({ iconFontName: 'definitely-not-an-icon-xyz' }));
    await waitFor(() => {
      expect(container.querySelector('rect')).toBeTruthy();
    });
  });

  it('サイズに応じて scale transform が付く', async () => {
    const { container } = renderIcon(icon({ width: 48, height: 48 }));
    await waitFor(() => {
      const g = container.querySelector('g[transform]');
      expect(g?.getAttribute('transform')).toContain('scale(2)');
    });
  });
});

describe('IconFont — Material Symbols (同期描画)', () => {
  it('lucide のロードを待たずに即座にテキストで描画する', () => {
    const { container } = renderIcon(icon({
      iconFontFamily: 'Material Symbols Outlined',
      iconFontName: 'home',
    }));

    const text = container.querySelector('text');
    expect(text?.textContent).toBe('home');
    expect(text?.getAttribute('font-family')).toBe('Material Symbols Outlined');
  });

  it('weight を fontVariationSettings に渡す', () => {
    const { container } = renderIcon(icon({
      iconFontFamily: 'Material Symbols Rounded',
      iconFontName: 'star',
      weight: 700,
    } as Partial<IconFontNode>));

    const text = container.querySelector('text');
    expect(text?.getAttribute('font-weight')).toBe('700');
  });
});

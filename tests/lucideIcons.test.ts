/**
 * lucide アイコンセットの遅延ロード層の検証 (#68)。
 *
 * lucide は初期バンドルから外して動的 import に切り替えた。ここでは
 * ロード前後の lookup の振る舞い、多重ロードの抑止、購読通知、
 * 名前変換 (kebab-case → PascalCase) を確認する。
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  ensureLucideLoaded,
  getLucideIcons,
  lookupLucideIcon,
  subscribeLucide,
  toPascalCase,
  __resetLucideForTest,
} from '../src/pen/renderer/lucideIcons';

beforeEach(() => {
  __resetLucideForTest(null);
});

describe('toPascalCase', () => {
  it('kebab-case を PascalCase にする', () => {
    expect(toPascalCase('arrow-left')).toBe('ArrowLeft');
  });
  it('snake_case を PascalCase にする', () => {
    expect(toPascalCase('arrow_left')).toBe('ArrowLeft');
  });
  it('単語 1 つでも先頭を大文字にする', () => {
    expect(toPascalCase('house')).toBe('House');
  });
  it('数字を含む名前を扱える', () => {
    expect(toPascalCase('circle-2')).toBe('Circle2');
  });
  it('すでに PascalCase なら変えない', () => {
    expect(toPascalCase('ArrowLeft')).toBe('ArrowLeft');
  });
});

describe('lucideIcons — ロード前', () => {
  it('getLucideIcons は null', () => {
    expect(getLucideIcons()).toBeNull();
  });

  it('lookupLucideIcon は null を返す (例外を投げない)', () => {
    expect(lookupLucideIcon('arrow-left')).toBeNull();
  });
});

describe('lucideIcons — ロード後', () => {
  it('実際に lucide を読み込むとアイコンが引ける', async () => {
    await ensureLucideLoaded();

    expect(getLucideIcons()).not.toBeNull();
    const icon = lookupLucideIcon('arrow-left');
    expect(icon).not.toBeNull();
    expect(Array.isArray(icon)).toBe(true);
    // IconNode は [tag, attrs] の組
    expect(typeof icon![0][0]).toBe('string');
  });

  it('存在しないアイコン名は null', async () => {
    await ensureLucideLoaded();
    expect(lookupLucideIcon('definitely-not-an-icon-xyz')).toBeNull();
  });

  it('kebab-case でも PascalCase でも同じアイコンが引ける', async () => {
    await ensureLucideLoaded();
    expect(lookupLucideIcon('arrow-left')).toEqual(lookupLucideIcon('ArrowLeft'));
  });

  it('ロード済みなら再呼び出しは即座に解決する', async () => {
    await ensureLucideLoaded();
    const before = getLucideIcons();
    await ensureLucideLoaded();
    expect(getLucideIcons()).toBe(before);
  });
});

describe('lucideIcons — 購読', () => {
  it('ロード完了で購読者に通知する', async () => {
    const onChange = vi.fn();
    subscribeLucide(onChange);

    await ensureLucideLoaded();

    expect(onChange).toHaveBeenCalled();
  });

  it('解除した購読者には通知しない', async () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeLucide(onChange);
    unsubscribe();

    await ensureLucideLoaded();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('同時に呼んでもロードは 1 回にまとまる', async () => {
    const onChange = vi.fn();
    subscribeLucide(onChange);

    await Promise.all([ensureLucideLoaded(), ensureLucideLoaded(), ensureLucideLoaded()]);

    // 通知は 1 回だけ (import が 3 回走っていれば 3 回来る)
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

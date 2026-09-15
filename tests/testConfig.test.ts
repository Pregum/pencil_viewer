import { describe, expect, it } from 'vitest';
import { getConfig } from '@testing-library/react';

/**
 * tests/setup.ts が実際に読み込まれていることの歯止め。
 * vite.config.ts の setupFiles が外れると待ち時間が既定の 1 秒に戻り、
 * 動的 import を待つテストが理由なく落ちるようになる。
 */
describe('テスト共通設定', () => {
  it('waitFor の待ち時間を既定の 1 秒より長く取っている', () => {
    expect(getConfig().asyncUtilTimeout).toBeGreaterThanOrEqual(5000);
  });
});

/**
 * テスト全体の共通設定。
 *
 * Testing Library の waitFor は既定で 1 秒しか待たない。lucide の動的
 * import を待つテスト (iconFont) は、カバレッジ計測のオーバーヘッドが
 * 乗ると 1 秒に収まらないことがあり、CI が理由なく赤くなっていた。
 * 待ち時間は「遅くても通る」ための上限であって、速さの指標ではないので
 * 余裕を持たせる。正常時はこれより早く解決するのでテストは遅くならない。
 */

import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 5000 });

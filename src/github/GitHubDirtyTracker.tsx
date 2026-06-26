/**
 * 未コミット差分（dirty）トラッカー。EditorProvider 配下に置く。
 *
 * - マウント時（= ファイルを開くたびに key で remount される）に現在の rawDoc JSON を
 *   baseline として記録する。
 * - 以後、編集で rawDoc JSON が baseline と変われば dirty = true。
 * - dirty は GitHubContext 経由でヘッダーのインジケータに伝わる。
 * コミット成功時は CommitButton 側で baseline を更新して dirty を解消する。
 */

import { useEffect, useMemo, useRef } from 'react';
import { useEditor } from '../pen/state/EditorContext';
import { useGitHub } from './GitHubContext';

export function GitHubDirtyTracker() {
  const { state } = useEditor();
  const { baselineJson, setBaselineJson, currentFile, setDirty } = useGitHub();
  const json = useMemo(() => JSON.stringify(state.rawDoc), [state.rawDoc]);
  const inited = useRef(false);

  // マウント時に baseline を確定（remount ごとに 1 回）
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    setBaselineJson(json);
    // 初期化のみ。json を deps に入れない（編集で再実行させないため）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dirty 判定: GitHub 由来ファイルがあり、baseline と異なるとき
  useEffect(() => {
    setDirty(!!currentFile && baselineJson != null && json !== baselineJson);
  }, [json, baselineJson, currentFile, setDirty]);

  // アンマウント時は dirty を必ず落とす
  useEffect(() => () => setDirty(false), [setDirty]);

  return null;
}

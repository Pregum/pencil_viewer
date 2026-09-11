/**
 * プロパティパネルで使う入力部品と表示ヘルパー。
 *
 * PropertyPanel から切り出した (#71)。パネル本体が 900 行超あり、
 * 「数値入力に式を書けるようにしたい」ような変更のたびに全体を読む必要があった。
 * ここにあるのはノードの種類に依存しない汎用部品だけ。
 * 表示用フォーマッタは Fast Refresh の都合で propertyFormat.ts に置いてある。
 */

import { useCallback, useId, useState } from 'react';
import { evalExpression } from '../../utils/evalExpression';

export function EditableField({
  label,
  value,
  onChange,
  onFocus,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  type?: 'text' | 'number' | 'color';
}) {
  // label と input を紐付ける。読み上げと、ラベルクリックでのフォーカスのため。
  const id = useId();
  return (
    <div className="prop-panel__field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="prop-panel__input"
        type={type}
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * 数値入力欄。テキスト入力を許可し、blur / Enter 時に evalExpression で評価。
 *   - 単純な数値は即座に onChange に流す (スピナー併用のため)
 *   - "100+20" のような式は focus 中は text として保持、確定時に計算
 *   - 計算できない場合は元の value に復元
 */
export function NumberField({
  label,
  value,
  onChange,
  onFocus,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onFocus?: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? String(Math.round(value * 100) / 100);

  const commit = useCallback(() => {
    if (draft == null) return;
    const r = evalExpression(draft, { current: value });
    if (r != null && isFinite(r)) onChange(r);
    setDraft(null); // どちらにせよ draft を解除 → 元 or 新値で再描画
  }, [draft, value, onChange]);

  return (
    <div className="prop-panel__field-inline">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="prop-panel__input prop-panel__input--num"
        type="text"
        inputMode="decimal"
        spellCheck={false}
        value={displayValue}
        onFocus={(e) => {
          onFocus?.();
          e.currentTarget.select();
        }}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          // 単純数値なら即反映 (スライダー感覚の操作を妨げない)
          const asNum = Number(v);
          if (v.trim() !== '' && !isNaN(asNum) && isFinite(asNum)) {
            onChange(asNum);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(null);
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            // Figma 同様: 矢印で ±1 (Shift で ±10)
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const dir = e.key === 'ArrowUp' ? 1 : -1;
            onChange(value + step * dir);
            setDraft(null);
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

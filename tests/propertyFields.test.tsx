/**
 * プロパティパネルの入力部品と表示ヘルパー。
 *
 * NumberField は「式が書ける数値欄」で、確定のタイミングが独特
 * （入力中は文字列のまま、Enter / blur で評価、Esc で捨てる）。
 * ここが崩れると座標やサイズの編集が壊れるので固定しておく。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EditableField, NumberField } from '../src/components/Viewer/propertyFields';
import { formatColor } from '../src/components/Viewer/propertyFormat';

afterEach(cleanup);

describe('formatColor', () => {
  it('文字列はそのまま返す', () => {
    expect(formatColor('#FF0000')).toBe('#FF0000');
  });

  it('color オブジェクトから色を取り出す', () => {
    expect(formatColor({ type: 'color', color: '#00FF00' })).toBe('#00FF00');
  });

  it('グラデーションと画像は中身の代わりに種別を返す', () => {
    expect(formatColor({ type: 'gradient', stops: [] })).toBe('(gradient)');
    expect(formatColor({ type: 'image', url: 'x' })).toBe('(image)');
  });

  it('配列は先頭の塗りを使う', () => {
    expect(formatColor([{ type: 'color', color: '#123456' }, '#999999'])).toBe('#123456');
  });

  it('扱えない値は null', () => {
    expect(formatColor(null)).toBeNull();
    expect(formatColor(undefined)).toBeNull();
    expect(formatColor(42)).toBeNull();
    expect(formatColor([])).toBeNull();
    expect(formatColor({ type: 'unknown' })).toBeNull();
  });
});

describe('EditableField', () => {
  it('ラベルと値を出し、入力のたびに親へ渡す', () => {
    const onChange = vi.fn();
    render(<EditableField label="Name" value="button" onChange={onChange} />);

    const input = screen.getByLabelText('Name');
    expect(input).toHaveProperty('value', 'button');

    fireEvent.change(input, { target: { value: 'submit' } });
    expect(onChange).toHaveBeenCalledWith('submit');
  });

  it('フォーカスを親に伝える（undo チェックポイント用）', () => {
    const onFocus = vi.fn();
    render(<EditableField label="Name" value="a" onChange={vi.fn()} onFocus={onFocus} />);
    fireEvent.focus(screen.getByLabelText('Name'));
    expect(onFocus).toHaveBeenCalled();
  });

  it('type を指定できる', () => {
    render(<EditableField label="Fill" value="#fff" onChange={vi.fn()} type="color" />);
    expect(screen.getByLabelText('Fill')).toHaveProperty('type', 'color');
  });
});

describe('NumberField', () => {
  const setup = (value = 100) => {
    const onChange = vi.fn();
    render(<NumberField label="W" value={value} onChange={onChange} />);
    return { input: screen.getByLabelText('W'), onChange };
  };

  it('小数は 2 桁に丸めて表示する', () => {
    render(<NumberField label="W" value={12.3456} onChange={vi.fn()} />);
    expect(screen.getByLabelText('W')).toHaveProperty('value', '12.35');
  });

  it('入力中は文字列のまま保持し、まだ親へ流さない', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '100+20' } });
    expect(input).toHaveProperty('value', '100+20');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Enter で式を評価して確定する', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '100+20' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(120);
  });

  it('blur でも確定する', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '50*2' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('Escape は書きかけの式を捨てて元の値に戻す', () => {
    const { input, onChange } = setup(100);
    fireEvent.change(input, { target: { value: '100+900' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveProperty('value', '100');
  });

  it('単純な数値は打った時点で反映済みなので、Escape でも取り消せない', () => {
    // スピナー感覚で動かせるようにする代償。取り消したいときは Cmd+Z を使う。
    const { input, onChange } = setup(100);
    fireEvent.change(input, { target: { value: '999' } });
    expect(onChange).toHaveBeenCalledWith(999);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('評価できない入力は親へ流さず元の値に戻す', () => {
    const { input, onChange } = setup(100);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveProperty('value', '100');
  });

  it('矢印キーで 1 ずつ、Shift 併用で 10 ずつ動かす', () => {
    const { input, onChange } = setup(100);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(101);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(99);
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(110);
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(90);
  });

  it('単純な数値はその場で親へ流す（スピナー併用のため）', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '250' } });
    expect(onChange).toHaveBeenCalledWith(250);
  });
});

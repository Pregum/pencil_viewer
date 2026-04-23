import { describe, expect, it } from 'vitest';
import { evalExpression } from '../src/utils/evalExpression';

describe('evalExpression', () => {
  it('returns null for empty / non-string', () => {
    expect(evalExpression('')).toBeNull();
    expect(evalExpression('   ')).toBeNull();
    expect(evalExpression(undefined as unknown as string)).toBeNull();
  });

  it('parses a plain number', () => {
    expect(evalExpression('42')).toBe(42);
    expect(evalExpression('-7')).toBe(-7);
    expect(evalExpression('3.14')).toBeCloseTo(3.14);
  });

  it('evaluates addition, subtraction', () => {
    expect(evalExpression('100 + 20')).toBe(120);
    expect(evalExpression('100 - 30')).toBe(70);
  });

  it('evaluates multiplication, division', () => {
    expect(evalExpression('100 * 2')).toBe(200);
    expect(evalExpression('100 / 4')).toBe(25);
  });

  it('respects precedence', () => {
    expect(evalExpression('10 + 5 * 2')).toBe(20);
    expect(evalExpression('(10 + 5) * 2')).toBe(30);
  });

  it('supports unary minus', () => {
    expect(evalExpression('-(10 + 5)')).toBe(-15);
    expect(evalExpression('-10 + 5')).toBe(-5);
  });

  it('rejects non-numeric chars', () => {
    expect(evalExpression('10 + abc')).toBeNull();
    expect(evalExpression('alert(1)')).toBeNull();
  });

  it('rejects division by zero', () => {
    expect(evalExpression('10 / 0')).toBeNull();
  });

  it('rejects unbalanced parens', () => {
    expect(evalExpression('(10 + 5')).toBeNull();
    expect(evalExpression('10 + 5)')).toBeNull();
  });

  it('evaluates % against context.current', () => {
    expect(evalExpression('50%', { current: 200 })).toBe(100);
    expect(evalExpression('10%', { current: 500 })).toBe(50);
    expect(evalExpression('10%')).toBeNull();
  });

  it('evaluates vw / vh against context.viewport', () => {
    expect(evalExpression('50vw', { viewport: { width: 1000, height: 800 } })).toBe(500);
    expect(evalExpression('50vh', { viewport: { width: 1000, height: 800 } })).toBe(400);
    expect(evalExpression('50vw')).toBeNull();
  });

  it('handles decimal and negative in suffix', () => {
    expect(evalExpression('12.5%', { current: 400 })).toBe(50);
    expect(evalExpression('-10%', { current: 100 })).toBe(-10);
  });

  it('returns null for Infinity / NaN-ish results', () => {
    // 0/0 は div-by-zero で null
    expect(evalExpression('0 / 0')).toBeNull();
  });
});

import { cleanParams, cn, formatCurrency, formatNumber } from './utils';

describe('utils', () => {
  it('cn çakışan tailwind sınıflarını birleştirir', () => {
    expect(cn('px-2 py-1', 'px-4', undefined, { hidden: false })).toBe('py-1 px-4');
  });

  it('para birimini Türk lirası olarak biçimlendirir', () => {
    expect(formatCurrency(1234.5)).toMatch(/1\.234,50/);
    expect(formatCurrency('99.9')).toMatch(/99,90/);
  });

  it('sayıları binlik ayraçla biçimlendirir', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
  });

  it('cleanParams boş değerleri atar ama 0 ve false değerlerini korur', () => {
    expect(cleanParams({ a: '', b: undefined, c: 0, d: 'x', e: false })).toEqual({
      c: 0,
      d: 'x',
      e: false,
    });
  });
});

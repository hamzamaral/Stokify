import { toCsv } from './csv.util';

describe('toCsv', () => {
  it('UTF-8 BOM ve noktalı virgül ayraç kullanır', () => {
    const csv = toCsv(['a', 'b'], [[1, 'x']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.slice(1)).toBe('a;b\r\n1;x');
  });

  it('ayraç ve tırnak içeren hücreleri kaçışlar', () => {
    expect(toCsv(['h'], [['a;b "c"']]).slice(1)).toBe('h\r\n"a;b ""c"""');
  });

  it('formül enjeksiyonunu etkisizleştirir ama negatif sayıları korur', () => {
    expect(toCsv(['h'], [['=SUM(A1)'], [-5]]).slice(1)).toBe("h\r\n'=SUM(A1)\r\n-5");
  });
});

type Cell = string | number | boolean | null | undefined;

function escapeCell(value: Cell): string {
  const text = value === null || value === undefined ? '' : String(value);
  // CSV injection koruması: formül olarak yorumlanabilecek hücreleri etkisizleştir
  const safe = /^[=+\-@]/.test(text) && Number.isNaN(Number(text)) ? `'${text}` : text;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Türkçe Excel uyumlu (noktalı virgül ayraçlı, UTF-8 BOM'lu) CSV üretir. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(';'));
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Spreadsheet-safe serialization for user-controlled text.
 * Formula markers are neutralized before CSV/TSV quoting; numeric values remain numeric.
 */
export type SpreadsheetCell = string | number | boolean | null | undefined;

export function serializeSpreadsheetCell(value: SpreadsheetCell, delimiter: ',' | '\t' = ','): string {
  const raw = String(value ?? '');
  const formulaSafe = typeof value === 'string' && /^[\u0000-\u0020]*[=+\-@]/.test(raw)
    ? `'${raw}`
    : raw;
  const safe = delimiter === '\t' ? formulaSafe.replace(/[\t\r\n]+/g, ' ') : formulaSafe;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function serializeSpreadsheetRows(
  rows: SpreadsheetCell[][],
  delimiter: ',' | '\t' = ','
): string {
  return rows.map((row) => row.map((value) => serializeSpreadsheetCell(value, delimiter)).join(delimiter)).join('\r\n');
}

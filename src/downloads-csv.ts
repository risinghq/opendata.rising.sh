export type Cell = string | number | undefined;

function cell(value: Cell): string {
  if (value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csv(header: readonly string[], rows: Cell[][]): string {
  const lines = [header.join(","), ...rows.map((row) => row.map(cell).join(","))];
  return `${lines.join("\r\n")}\r\n`;
}

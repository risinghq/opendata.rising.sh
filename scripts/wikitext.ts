export interface Cell {
  attrs: string;
  text: string;
  rowspan: number;
  colspan: number;
}

export interface Table {
  rows: Cell[][];
}

export function splitOutside(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === "[[" || two === "{{") {
      depth++;
      i++;
    } else if (two === "]]" || two === "}}") {
      depth--;
      i++;
    } else if (depth === 0 && text.startsWith(separator, i)) {
      parts.push(text.slice(from, i));
      from = i + separator.length;
      i += separator.length - 1;
    }
  }
  parts.push(text.slice(from));
  return parts;
}

export function topTemplates(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("{{", i)) {
      if (depth++ === 0) start = i + 2;
      i++;
    } else if (text.startsWith("}}", i) && depth > 0) {
      if (--depth === 0) out.push(text.slice(start, i));
      i++;
    }
  }
  return out;
}

export function parameters(template: string): { name: string; named: Map<string, string> } {
  const [name = "", ...rest] = splitOutside(template, "|");
  const named = new Map<string, string>();
  for (const part of rest) {
    const m = /^\s*([\w-]+)\s*=([\s\S]*)$/.exec(part);
    if (m) named.set(m[1]!.toLowerCase(), m[2]!.trim());
  }
  return { name: name.trim(), named };
}

function parseCell(source: string): Cell {
  const parts = splitOutside(source, "|");
  const hasAttrs = parts.length > 1 && !parts[0]!.includes("[[") && !parts[0]!.includes("{{");
  const attrs = hasAttrs ? parts[0]!.trim() : "";
  const text = (hasAttrs ? parts.slice(1).join("|") : source).trim();
  const span = (name: string) =>
    Number(new RegExp(`${name}\\s*=\\s*"?(\\d+)`).exec(attrs)?.[1] ?? 1);
  return { attrs, text, rowspan: span("rowspan"), colspan: span("colspan") };
}

export function parseTables(wikitext: string): Table[] {
  const tables: Table[] = [];
  let table: Table | undefined;
  let row: Cell[] | undefined;
  let last: Cell | undefined;
  let depth = 0;

  for (const line of wikitext.split("\n")) {
    if (line.startsWith("{|")) {
      depth++;
      if (depth > 1) throw new Error("nested wikitext tables are not supported");
      table = { rows: [] };
      row = undefined;
      last = undefined;
    } else if (!table) {
      continue;
    } else if (line.startsWith("|}")) {
      tables.push(table);
      table = undefined;
      depth--;
    } else if (line.startsWith("|-")) {
      row = [];
      table.rows.push(row);
      last = undefined;
    } else if (line.startsWith("|+")) {
      continue;
    } else if (line.startsWith("|") || line.startsWith("!")) {
      if (!row) {
        row = [];
        table.rows.push(row);
      }
      const marker = line[0]!;
      const cells = splitOutside(line.slice(1), marker === "!" ? "!!" : "||");
      for (const source of cells.flatMap((part) => splitOutside(part, "||"))) {
        last = parseCell(source);
        row.push(last);
      }
    } else if (last) {
      last.text = `${last.text}\n${line}`.trim();
    }
  }
  return tables.filter((t) => t.rows.some((r) => r.length > 0));
}

export function expandSpans(rows: Cell[][]): Cell[][] {
  const pending: ({ cell: Cell; left: number } | undefined)[] = [];
  return rows.map((row) => {
    const out: Cell[] = [];
    let col = 0;
    const takePending = () => {
      for (let held = pending[col]; held; held = pending[col]) {
        out[col] = held.cell;
        held.left--;
        if (held.left === 0) pending[col] = undefined;
        col++;
      }
    };
    for (const cell of row) {
      takePending();
      for (let i = 0; i < cell.colspan; i++) {
        out[col] = cell;
        if (cell.rowspan > 1) pending[col] = { cell, left: cell.rowspan - 1 };
        col++;
      }
    }
    takePending();
    return out;
  });
}

function stripMarkup(text: string): string {
  let out = text;
  for (let before = ""; before !== out;) {
    before = out;
    out = out.replace(/\{\{[^{}]*\}\}/g, "");
  }
  return out
    .replace(/\[\[(?:Archivo|File|Imagen|Image):[^\]]*\]\]/gi, "")
    .replace(/<ref\b[^>]*\/>/g, "")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const plain = stripMarkup;

export function link(text: string): { title: string; label: string } | undefined {
  const match = /^\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/.exec(text.replace(/'{2,}/g, "").trim());
  if (!match) return undefined;
  const title = match[1]!.replace(/_/g, " ").trim();
  return { title, label: stripMarkup(match[2] ?? match[1]!) };
}

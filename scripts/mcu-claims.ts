import { writtenAmounts } from "../src/data/dollars.ts";
import { parameters, plain, topTemplates } from "./wikitext.ts";

export interface AmountClaim {
  value: number;
  precision: number;
  lowerBound: boolean;
  text: string;
  quote: string;
}

export interface BudgetClaim {
  low: number;
  high?: number;
  basis?: "gross" | "net";
  precision: number;
  text: string;
  quote: string;
}

export interface ArticleClaims {
  usCanada: AmountClaim[];
  worldwide: AmountClaim[];
  budget: BudgetClaim[];
}

const clean = (text: string) =>
  text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref\b[^>]*\/>/g, "")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{'s\}\}/gi, "'s")
    .replace(/\{\{'{1,3}\}\}/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\{\{nbsp\}\}/gi, " ");

const boxOfficeSection = (wikitext: string): string => {
  const head = /^(={2,})\s*Box office\s*\1\s*$/im.exec(wikitext);
  if (!head) return "";
  const level = head[1]!.length;
  const rest = wikitext.slice(head.index + head[0].length);
  const next = new RegExp(`^={1,${level}}[^=]`, "m").exec(rest);
  return next ? rest.slice(0, next.index) : rest;
};

const SKIP_SENTENCE =
  /weekend|debut|opening|preview|pre-?sale|first day|daily|monday|tuesday|wednesday|thursday|friday|saturday|sunday|theater|theatre|locations|screens|admissions|tickets|project|estimat|expect|forecast|predict|track(?:ed|ing)?|on pace|potential|possible|could|would|\bmark\b|milestone|crossed|crossing|surpass|exceed|to pass|passed|passing|re-?release|reissue|net profit|home media|ticket sales|fastest|threshold|eclipse|break-?even|need(?:ed)? to (?:earn|gross|make)|highest-grossing|had earned|had grossed|as of|by the end of|initially|IMAX|disappoint|underperform|to date/i;

const LOWER_BOUND = /(?:over|more than|in excess of|upwards? of|at least)\s*$/i;
const INCREMENT =
  /(?:added|adds|additional|another|extra|plus|increase[sd]?|boost(?:ed)?|gained)\s*(?:an?|of|by|its|the)?\s*$/i;

const ANCHORS: [RegExp, "usCanada" | "worldwide" | "budget" | "other"][] = [
  [/outside (?:the )?(?:United States and Canada|U\.?S\.? and Canada|North America)/gi, "other"],
  [/United States and Canada|U\.?S\.? and Canada|North America|domestic(?:ally)?/gi, "usCanada"],
  [
    /other territories|other countries|other markets|overseas|international|rest of the world|\d+ markets/gi,
    "other",
  ],
  [/worldwide|globally|global box office/gi, "worldwide"],
  [/\bbudget(?:s)?\b/gi, "budget"],
];

const POSSESSIVE =
  /(?:''([^']+)''|\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|[A-Z][\w:.-]*(?:\s+[A-Z][\w:.-]*)*)'s\s*$/;

const clauseBefore = (sentence: string, index: number) => {
  const before = sentence.slice(0, index);
  return before.slice(Math.max(before.lastIndexOf("."), before.lastIndexOf(";")) + 1);
};

const clauseSpans = (sentence: string, a: number, b: number) =>
  !/[.;]/.test(sentence.slice(Math.min(a, b), Math.max(a, b)));

const inParens = (sentence: string, index: number) =>
  sentence.slice(0, index).split("(").length - 1 > sentence.slice(0, index).split(")").length - 1;

function foreignPossessor(clause: string, names: string[]): boolean {
  const m = POSSESSIVE.exec(clause.trimEnd());
  if (!m) return false;
  const owner = plain(m[1] ?? m[2] ?? m[0]!)
    .replace(/'s$/, "")
    .toLowerCase();
  if (!owner || ["film", "it", "its", "the film"].includes(owner)) return false;
  return !names.some((name) => owner.includes(name) || name.includes(owner));
}

const anchorMatches = (sentence: string) => {
  const out: { kind: string; start: number; end: number }[] = [];
  for (const [re, kind] of ANCHORS) {
    re.lastIndex = 0;
    for (let a = re.exec(sentence); a; a = re.exec(sentence)) {
      out.push({ kind, start: a.index, end: a.index + a[0].length });
    }
  }
  return out.filter(
    (m) => !out.some((o) => o !== m && o.start <= m.start && m.end <= o.end && o.kind !== m.kind),
  );
};

const nearestAnchor = (sentence: string, start: number, end: number) => {
  let best: { kind: string; index: number; distance: number } | undefined;
  for (const m of anchorMatches(sentence)) {
    const distance = Math.max(0, m.start - end, start - m.end);
    if (!best || distance < best.distance) best = { kind: m.kind, index: m.start, distance };
  }
  return best;
};

const ABBREV =
  /\b(U\.S|U\.K|D\.C|St|No|vs|Mr|Mrs|Dr|Prof|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\./g;

function sentenceClaims(sentence: string, names: string[], out: ArticleClaims): void {
  if (SKIP_SENTENCE.test(sentence)) return;
  const quote = plain(sentence);
  for (const group of writtenAmounts(sentence)) {
    if (group.values[0]! < 1e6) continue;
    if (inParens(sentence, group.index)) continue;
    if (!quote.includes(group.text)) continue;
    const clause = clauseBefore(sentence, group.index);
    if (INCREMENT.test(clause) || foreignPossessor(clause, names)) continue;
    const anchor = nearestAnchor(sentence, group.index, group.index + group.text.length);
    if (!anchor || anchor.kind === "other") continue;
    if (anchor.kind === "budget" && !clauseSpans(sentence, group.index, anchor.index)) continue;
    if (anchor.kind !== "budget" && group.values.length > 1) continue;
    if (anchor.kind === "budget") {
      out.budget.push({
        low: group.values[0]!,
        high: group.values[1],
        precision: group.precision[0]!,
        text: group.text,
        quote,
      });
    } else {
      out[anchor.kind === "worldwide" ? "worldwide" : "usCanada"].push({
        value: group.values[0]!,
        precision: group.precision[0]!,
        lowerBound: LOWER_BOUND.test(clause),
        text: group.text,
        quote,
      });
    }
  }
}

export function articleClaims(wikitext: string, names: string[]): ArticleClaims {
  const own = names.map((n) => n.toLowerCase());
  const out: ArticleClaims = { usCanada: [], worldwide: [], budget: [] };
  for (const template of topTemplates(wikitext)) {
    const { name, named: params } = parameters(template);
    if (!/^infobox\b/i.test(name)) continue;
    for (const [key, kind] of [
      ["gross", "worldwide"],
      ["budget", "budget"],
    ] as const) {
      const raw = params.get(key);
      if (!raw) continue;
      const cleaned = clean(raw).trim();
      const items = /^\s*\{\{plainlist/i.test(cleaned)
        ? cleaned
            .replace(/^\s*\{\{plainlist\s*\|?/i, "")
            .replace(/\}\}\s*$/, "")
            .split("*")
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
      for (const item of items ?? [cleaned]) {
        const quote = items ? item : `${key} = ${cleaned}`;
        const basis = /\(gross\)\s*$/i.test(item)
          ? "gross"
          : /\(net\)\s*$/i.test(item)
            ? "net"
            : undefined;
        for (const group of writtenAmounts(item)) {
          if (kind === "worldwide") {
            out.worldwide.push({
              value: group.values[0]!,
              precision: group.precision[0]!,
              lowerBound: false,
              text: group.text,
              quote,
            });
          } else {
            out.budget.push({
              low: group.values[0]!,
              high: group.values[1],
              precision: group.precision[0]!,
              text: group.text,
              quote,
              ...(basis === undefined ? {} : { basis }),
            });
          }
        }
      }
    }
    break;
  }
  const section = clean(boxOfficeSection(wikitext))
    .replace(/^={2,}[^\n=]*={2,}\s*$/gm, " ")
    .replace(/(\d)\.(\d)/g, "$1\uE000$2")
    .replace(ABBREV, "$1\uE000");
  for (const raw of section.split(/(?<=[.!?])\s+/)) {
    sentenceClaims(raw.replace(/(\d)\uE000(\d)/g, "$1.$2").replace(/\uE000/g, "."), own, out);
  }
  const seen = new Set<string>();
  const dedupe = <T extends { text: string; quote: string }>(claims: T[], key: (c: T) => string) =>
    claims.filter((c) => (seen.has(key(c)) ? false : (seen.add(key(c)), true)));
  out.usCanada = dedupe(out.usCanada, (c) => `u${c.value}`);
  out.worldwide = dedupe(out.worldwide, (c) => `w${c.value}`);
  out.budget = dedupe(out.budget, (c) => `b${c.low}-${c.high ?? ""}`);
  return out;
}

const closeAt = (claim: number, table: number, precision: number) =>
  Math.round(table / precision) === Math.round(claim / precision) ||
  Math.floor(table / precision) === Math.floor(claim / precision);

export const agrees = (
  claim: Pick<AmountClaim, "value" | "precision" | "lowerBound">,
  table: number,
  tablePrecision = 1,
) =>
  claim.lowerBound
    ? table >= claim.value
    : closeAt(claim.value, table, Math.max(claim.precision, tablePrecision));

export const budgetAgrees = (
  claim: BudgetClaim,
  table: { low: number; high?: number; precision: number },
) => {
  const close = (a: number, b: number) => closeAt(a, b, Math.max(claim.precision, table.precision));
  if (claim.high === undefined) {
    if (table.high === undefined) return close(claim.low, table.low);
    return (
      close(claim.low, table.low) ||
      close(claim.low, table.high) ||
      (table.low < claim.low && claim.low < table.high)
    );
  }
  if (table.high === undefined) return table.low >= claim.low && table.low <= claim.high;
  return close(claim.low, table.low) && close(claim.high, table.high);
};

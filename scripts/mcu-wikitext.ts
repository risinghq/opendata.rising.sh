import type { MojoCitation } from "../src/data/types.ts";
import { expandSpans, link, parseTables, plain, splitOutside } from "./wikitext.ts";

export interface RawFilm {
  originalTitle: string;
  release: string;
  usCanada?: number;
  worldwide?: number;
  budget?: { low: number; high?: number };
  note?: string;
  boxOfficeMojo?: MojoCitation;
}

const UNITS: Record<string, number> = { million: 1e6, billion: 1e9, millones: 1e6 };

function money(text: string): number[] {
  const clean = text.replace(/&nbsp;/g, " ").replace(/\{\{nbsp\}\}/gi, " ");
  const out: number[] = [];
  const re =
    /\$\s*([\d,]+(?:\.\d+)?)(?:\s*(?:–|to|and)\s*\$?\s*([\d,]+(?:\.\d+)?))?\s*(million|billion)?/g;
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    const unit = m[3] ? UNITS[m[3]]! : m[1]!.includes(",") ? 1 : 1e6;
    out.push(Math.round(Number(m[1]!.replaceAll(",", "")) * unit));
    if (m[2]) out.push(Math.round(Number(m[2].replaceAll(",", "")) * unit));
  }
  return out;
}

function date(text: string, where: string): string {
  const m = /\{\{#invoke:dts\|main\|(\d+)\|(\d+)\|(\d+)/.exec(text);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  const s = /\{\{Start date\|(\d+)\|(\d+)\|(\d+)/.exec(text);
  if (s) return `${s[1]}-${s[2]!.padStart(2, "0")}-${s[3]!.padStart(2, "0")}`;
  throw new Error(`${where}: no release date`);
}

export function budget(text: string): { low: number; high?: number } | undefined {
  const clean = text.replace(/&nbsp;/g, " ").replace(/\{\{nbsp\}\}/gi, " ");
  const m = /\$\s*([\d,.]+)\s*(?:–|to)\s*\$?\s*([\d,.]+)\s*(million|billion)/.exec(clean);
  if (m) {
    const u = UNITS[m[3]!]!;
    return { low: Math.round(Number(m[1]) * u), high: Math.round(Number(m[2]) * u) };
  }
  const amounts = money(text);
  return amounts.length ? { low: amounts[0]! } : undefined;
}

function efns(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\{\{efn\|/gi)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < text.length && depth > 0) {
      if (text.startsWith("{{", i)) {
        depth++;
        i += 2;
      } else if (text.startsWith("}}", i)) {
        depth--;
        i += 2;
      } else {
        i++;
      }
    }
    const body = splitOutside(text.slice(start, i - 2), "|")
      .filter((part) => !/^\s*[A-Za-z-]+\s*=/.test(part))
      .map(plain)
      .join(" ")
      .trim();
    if (body) out.push(body);
  }
  return out;
}

function topTemplates(text: string): string[] {
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

function parameters(template: string): { name: string; named: Map<string, string> } {
  const [name = "", ...rest] = splitOutside(template, "|");
  const named = new Map<string, string>();
  for (const part of rest) {
    const m = /^\s*([\w-]+)\s*=([\s\S]*)$/.exec(part);
    if (m) named.set(m[1]!.toLowerCase(), m[2]!.trim());
  }
  return { name: name.trim(), named };
}

const MOJO_HOST = /^https?:\/\/(www\.)?boxofficemojo\.com\//i;
const MOJO_TEMPLATE = /^cite (box office mojo|bom)$/i;

function isoDate(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const time = Date.parse(`${text} 12:00 UTC`);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString().slice(0, 10);
}

export function boxOfficeMojo(refCell: string): MojoCitation | undefined {
  for (const ref of refCell.matchAll(/<ref(?:\s[^>]*[^/])?>([\s\S]*?)<\/ref>/g)) {
    for (const template of topTemplates(ref[1]!)) {
      const { name, named } = parameters(template);
      const id = named.get("id")?.replace(/^tt/i, "");
      const url =
        named.get("url") ??
        (id && MOJO_TEMPLATE.test(name)
          ? `https://www.boxofficemojo.com/title/tt${id}/`
          : undefined);
      if (!url || !MOJO_HOST.test(url)) continue;
      const accessed = isoDate(named.get("access-date") ?? named.get("accessdate"));
      if (!accessed) continue;
      const archive = named.get("archive-url") ?? named.get("archiveurl");
      return { url, accessed, ...(archive ? { archive } : {}) };
    }
  }
  return undefined;
}

export function parseBoxOfficeRows(section: string): RawFilm[] {
  const films: RawFilm[] = [];
  const clean = section
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<noinclude>[\s\S]*?<\/noinclude>/g, "")
    .replace(/<\/?includeonly>/g, "");
  const body = /^\{\|/m.test(clean) ? clean : "{|\n" + clean + "\n|}";
  for (const table of parseTables(body)) {
    for (const row of expandSpans(table.rows)) {
      const bracket = row[0] && /\[\[[^\]]*\]\]/.exec(row[0].text);
      const film = bracket && link(bracket[0]);
      if (!film) continue;
      if (row.length < 8) throw new Error(`row for ${film.title} has ${row.length} cells`);
      const amounts = row.slice(2, 5).map((cell) => money(plain(cell.text))[0]);
      if (amounts.some((a) => a === undefined)) continue;
      const notes = efns(row[0]!.text);
      films.push({
        originalTitle: film.title.split("#")[0]!.trim(),
        release: date(row[1]!.text, film.title),
        usCanada: amounts[0],
        worldwide: amounts[2],
        budget: budget(row[7]!.text),
        boxOfficeMojo: boxOfficeMojo(row[8]?.text ?? ""),
        note: notes.length ? notes.join(" ") : undefined,
      });
    }
  }
  return films;
}

export function parseFilmList(section: string): { originalTitle: string; release: string }[] {
  const out = new Map<string, string>();
  const titles = [...section.matchAll(/\| *title\d+ *= *''\[\[([^\]|]+)(?:\|([^\]]*))?\]\]''/g)];
  for (const title of titles) {
    const n = /\| *title(\d+) *=/.exec(title[0])![1];
    const d = new RegExp(`\\| *date${n} *= *(.*)`).exec(section);
    if (d) out.set(title[1]!.split("#")[0]!.trim(), date(d[1]!, title[1]!));
  }
  return [...out].map(([originalTitle, release]) => ({ originalTitle, release }));
}

const SECTION_RE = /<section\s+begin=['"]?([A-Za-z]+)['"]?\s*\/>/g;

export function labeledSection(wikitext: string, name: string): string | undefined {
  for (const m of wikitext.matchAll(SECTION_RE)) {
    if (m[1] !== name) continue;
    const endRe = new RegExp(`<section\\s+end=['"]?${name}['"]?\\s*/>`);
    const end = endRe.exec(wikitext.slice(m.index));
    if (!end) throw new Error(`section ${name} is not closed`);
    return wikitext.slice(m.index + m[0].length, m.index + end.index);
  }
  return undefined;
}

const WEEKEND = /(opening[- ]weekend|debut|weekend gross|total weekend|three[- ]day weekend)/i;
const AMOUNT = /\$\s*([\d,]+(?:\.\d+)?)\s*(million|billion)?/g;
const SKIP =
  /project(ed|ing)|estimat(ed|ing)|expect(ed|ing)|predict(ed|ing)|forecast(ed|ing)?|suggest(ed|ing)|track(ed|ing)|on pace|possible|potential|\bcould\b|(second|third|fourth|fifth|next|following|subsequent|sophomore|consecutive)[- ]weekend|re-?release|encore|''[^'\n]*''\s*(\{\{'?s'?\}\})?\s*\$/i;
const SUBJECT_SPECULATION =
  /(projections?|estimates?|expectations?|forecasts?|predictions?|tracking)\s+(had|has|have|was|were|said|called|placed|put|ranged|suggested)\b/i;
const SPECULATION =
  /projections?|estimates?|expectations?|forecast|predictions?|tracking|pre-?sale/i;
const RESULT = /(gross|earn|debut|collect|post|total)(ed|ing|s)\b|\bmade\b|took in\b/i;
const TERRITORIES = /overseas|international|worldwide|global|territories|outside North America/i;
const DOMESTIC = /domestic|United States|U\.S\.|North America/i;
const NEAR = 140;

export function openingWeekend(wikitext: string): number | undefined {
  const box = /^==+\s*Box office\s*==+/im.exec(wikitext);
  let text = box ? wikitext.slice(box.index + box[0].length) : wikitext;
  const us = /^==+\s*United States and Canada\s*==+/im.exec(text);
  if (us) {
    const rest = text.slice(us.index + us[0].length);
    const end = /^={2,}/m.exec(rest);
    text = end ? rest.slice(0, end.index) : rest;
  } else {
    const end = /^==[^=]/m.exec(text);
    if (end) text = text.slice(0, end.index);
  }
  const cleaned = text
    .replace(/<ref\b[^>]*\/>/g, "")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\{\{nbsp\}\}/gi, " ")
    .replace(/(\d)\.(\d)/g, "$1\uE000$2");
  for (const raw of cleaned.split(/(?<=[.!?])\s+/)) {
    const sentence = raw.replace(/(\d)\uE000(\d)/g, "$1.$2");
    const key = WEEKEND.exec(sentence);
    if (!key || SKIP.test(sentence)) continue;
    if (SUBJECT_SPECULATION.test(sentence)) continue;
    if (SPECULATION.test(sentence) && !RESULT.test(sentence)) continue;
    if (TERRITORIES.test(sentence) && !DOMESTIC.test(sentence)) continue;
    const anchor =
      TERRITORIES.test(sentence) && DOMESTIC.test(sentence)
        ? (DOMESTIC.exec(sentence)?.index ?? key.index)
        : key.index;
    const near: { value: number; at: number }[] = [];
    for (const m of sentence.matchAll(AMOUNT)) {
      const unit =
        m[2] === "billion" ? 1e9 : m[2] === "million" ? 1e6 : m[1]!.includes(",") ? 1 : 1e6;
      const value = Math.round(Number(m[1]!.replaceAll(",", "")) * unit);
      if (value >= 1e6 && Math.abs(m.index - anchor) <= NEAR) near.push({ value, at: m.index });
    }
    if (near.length === 0) continue;
    return [...near].sort((a, b) => Math.abs(a.at - anchor) - Math.abs(b.at - anchor))[0]!.value;
  }
  return undefined;
}

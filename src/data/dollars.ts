const UNITS: Record<string, number> = { million: 1e6, billion: 1e9, millones: 1e6 };

const MONEY =
  /\$\s*([\d,]+(?:\.\d+)?)(?:\s*(?:–|to|and)\s*\$?\s*([\d,]+(?:\.\d+)?))?\s*(million|billion|millones)?\b/g;

export interface WrittenAmounts {
  values: number[];
  precision: number[];
  text: string;
  index: number;
}

const valueOf = (digits: string, unit: number) =>
  Math.round(Number(digits.replaceAll(",", "")) * unit);

const precisionOf = (digits: string, unit: number) => {
  const decimals = digits.includes(".") ? digits.split(".")[1]!.length : 0;
  return unit / 10 ** decimals;
};

export function writtenAmounts(text: string): WrittenAmounts[] {
  const out: WrittenAmounts[] = [];
  const re = new RegExp(MONEY);
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const unit = m[3]
      ? UNITS[m[3].toLowerCase()]!
      : m[1]!.includes(",")
        ? 1
        : 1e6;
    const values = [valueOf(m[1]!, unit)];
    const precision = [precisionOf(m[1]!, unit)];
    if (m[2]) {
      values.push(valueOf(m[2], unit));
      precision.push(precisionOf(m[2], unit));
    }
    out.push({ values, precision, text: m[0].trim(), index: m.index });
  }
  return out;
}

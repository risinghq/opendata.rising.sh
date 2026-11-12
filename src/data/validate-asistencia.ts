import {
  insideDates,
  isCount,
  isInstant,
  isObj,
  isText,
  type Obj,
  type Report,
} from "./validate-common.ts";

export function validateAsistencia(data: Obj, { fail, source }: Report) {
  if (!Array.isArray(data.acts) || data.acts.length === 0) {
    fail("acts", "must be a non-empty list");
  } else {
    data.acts.forEach((act: unknown, i) => {
      const path = `acts[${i}]`;
      if (!isObj(act)) return fail(path, "must be an object");
      for (const key of ["country", "city", "venue", "name"] as const) {
        if (!isText(act[key])) fail(`${path}.${key}`, "must be a non-empty string");
      }
      if (!isInstant(act.start)) {
        fail(`${path}.start`, "must be a local time with an offset, YYYY-MM-DDTHH:MM-03:00");
      } else if (!insideDates(data, act.start)) {
        fail(`${path}.start`, "falls outside the event dates");
      }

      if (act.status === "held") {
        const { low, central, high } = act;
        for (const key of ["low", "central", "high"] as const) {
          if (!isCount(act[key])) fail(`${path}.${key}`, "must be a non-negative integer");
        }
        if (
          isCount(low) &&
          isCount(central) &&
          isCount(high) &&
          !(low <= central && central <= high)
        ) {
          fail(path, `low <= central <= high does not hold (${low}, ${central}, ${high})`);
        }
        if (!isText(act.attribution)) fail(`${path}.attribution`, "must say who gave each figure");
        if (!Array.isArray(act.sources) || act.sources.length === 0) {
          fail(`${path}.sources`, "a held act needs at least one source");
        } else {
          act.sources.forEach((s: unknown, j) => source(s, `${path}.sources[${j}]`));
        }
        if ("expected" in act) fail(`${path}.expected`, "a held act has no expected figure");
      } else if (act.status === "planned") {
        for (const key of ["low", "central", "high", "attribution", "sources"]) {
          if (key in act) fail(`${path}.${key}`, "a planned act has no figures");
        }
        if ("expected" in act) {
          const expected = act.expected;
          if (!isObj(expected)) return fail(`${path}.expected`, "must be an object");
          if (!isCount(expected.figure) || expected.figure === 0) {
            fail(`${path}.expected.figure`, "must be a positive integer");
          }
          if (!isText(expected.attribution))
            fail(`${path}.expected.attribution`, "must say who expects it");
          source(expected.source, `${path}.expected.source`);
        }
      } else {
        fail(`${path}.status`, 'must be "planned" or "held"');
      }
    });
  }

  if ("comparison" in data) {
    if (!Array.isArray(data.comparison)) {
      fail("comparison", "must be a list");
    } else {
      data.comparison.forEach((row: unknown, i) => {
        const path = `comparison[${i}]`;
        if (!isObj(row)) return fail(path, "must be an object");
        if (!isText(row.label)) fail(`${path}.label`, "must be a non-empty string");
        if (!isCount(row.figure) || row.figure === 0)
          fail(`${path}.figure`, "must be a positive integer");
        if (!isText(row.attribution)) fail(`${path}.attribution`, "must say who gave the figure");
        source(row.source, `${path}.source`);
      });
    }
  }
}

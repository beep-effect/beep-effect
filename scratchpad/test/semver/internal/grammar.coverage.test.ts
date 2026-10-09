import { assert, describe, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { formatComparator, formatRange, formatVersion, parseComparator, parseRange, parseVersion } from "../../../effected/semver/internal/grammar.ts";

describe("grammar coverage", () => {
  it.effect("reports exact offsets for invalid numeric and suffix identifiers", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [string, number]> = [
      ["", 0], [" \t ", 0], ["v1.2.3", 0], ["V1.2.3", 0], ["=1.2.3", 0],
      ["?", 0], ["1", 1], ["1.2", 3], ["1.", 2], ["1.2.", 4],
      ["01.2.3", 0], ["1.02.3", 2], ["1.2.03", 4], ["9007199254740992.0.0", 0],
      ["1.2.3-", 6], ["1.2.3-?", 6], ["1.2.3-{", 6], ["1.2.3-a.", 8], ["1.2.3-01", 6],
      ["1.2.3-9007199254740992", 6], ["1.2.3+", 6], ["1.2.3+?", 6], ["1.2.3+{", 6], ["1.2.3+b.", 8],
      ["1.2.3?", 5], ["1.2.3-a?", 7], ["1.2.3+b?", 7],
    ];
    for (const [input, position] of cases) assert.deepStrictEqual(parseVersion(input), { ok: false, input, position });
    assert.deepStrictEqual(parseVersion("  01.2.3  "), { ok: false, input: "01.2.3", position: 0 });
    const value = { major: 1, minor: 2, patch: 3, prerelease: ["AZaz-", 0, "01x"], build: ["00", "AZaz-"] };
    assert.deepStrictEqual(parseVersion("1.2.3-AZaz-.0.01x+00.AZaz-"), { ok: true, value });
    assert.strictEqual(formatVersion(value), "1.2.3-AZaz-.0.01x+00.AZaz-");
  }));

  it.effect("requires complete comparator versions and rejects duplicate operators", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [string, number]> = [
      ["", 0], ["  ", 0], [">>1.2.3", 1], ["<>1.2.3", 1], [">= =1.2.3", 2],
      ["==1.2.3", 1], ["><1.2.3", 1], ["1", 1], ["1.2", 3], ["1.2.3?", 5],
      ["1.2.3-", 6], ["1.2.3+", 6], [">=1.2.x", 6],
    ];
    for (const [input, position] of cases) assert.deepStrictEqual(parseComparator(input), { ok: false, input, position });
    for (const operator of ["", "=", ">", ">=", "<", "<="] as const) {
      const value = { operator: operator === "" ? "=" : operator, version: { major: 1, minor: 2, patch: 3, prerelease: ["RC", 0], build: ["007"] } };
      const parsed = parseComparator(` ${operator}1.2.3-RC.0+007 `);
      assert.deepStrictEqual(parsed, { ok: true, value });
      if (parsed.ok) assert.strictEqual(formatComparator(parsed.value), `${operator === "=" ? "" : operator}1.2.3-RC.0+007`);
    }
  }));

  it.effect("expands range sugar, spacing and OR separators into canonical comparators", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ["", ">=0.0.0"], ["  ", ">=0.0.0"], ["x", ">=0.0.0"], ["X", ">=0.0.0"],
      ["1.*", ">=1.0.0 <2.0.0-0"], ["1.2.X", ">=1.2.0 <1.3.0-0"],
      ["~1.2.3", ">=1.2.3 <1.3.0-0"], ["^0.0.3", ">=0.0.3 <0.0.4-0"],
      ["1.2.3 - 2.3.4", ">=1.2.3 <=2.3.4"], ["1 - 2", ">=1.0.0 <3.0.0-0"],
      [">=1.2.3   <2.0.0 || 3.0.0", ">=1.2.3 <2.0.0 || 3.0.0"],
      ["1||2", ">=1.0.0 <2.0.0-0 || >=2.0.0 <3.0.0-0"],
      ["1.2.3-RC.0+007", "1.2.3-RC.0+007"],
    ];
    for (const [input, expected] of cases) {
      const parsed = parseRange(input);
      assert.strictEqual(parsed.ok, true, input);
      if (parsed.ok) assert.strictEqual(formatRange(parsed.value), expected, input);
    }
    assert.strictEqual(formatRange([]), "");
    assert.strictEqual(formatRange([[]]), "");
  }));

  it.effect("rejects unconsumed range text and incomplete alternatives", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [string, number]> = [
      ["~>1", 1], ["~", 1], ["^", 1], ["1|2", 1], ["1 |", 2], ["1 ||", 4],
      ["1 || ?", 5], ["1.2.x-a", 5], ["1.2.x+b", 5], ["1 - ?", 2], ["1 ?", 2],
      ["1- 2", 1], ["1 -2", 2], ["1\t2", 1],
    ];
    for (const [input, position] of cases) assert.deepStrictEqual(parseRange(input), { ok: false, input, position });
  }));

  it.effect("propagates unexpected numeric-validation defects through all entry points", () => Effect.sync(() => {
    const defect = new Error("numeric validator unavailable");
    const spy = vi.spyOn(Number, "isSafeInteger").mockImplementation(() => { throw defect; });
    try {
      for (const parse of [parseVersion, parseComparator, parseRange]) {
        let caught: unknown;
        try { parse("1.2.3"); } catch (error) { caught = error; }
        assert.strictEqual(caught, defect);
      }
    } finally {
      spy.mockRestore();
    }
  }));
});

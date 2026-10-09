import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { formatComparator, formatRange, formatVersion, parseComparator, parseRange, parseVersion } from "../../../effected/semver/internal/grammar.ts";

const runs = { arbitrary: fcRuns(100) };
const Component = S.Int.check(S.isBetween({ minimum: 0, maximum: 1000000 }));
const Version = S.Struct({
  major: Component, minor: Component, patch: Component,
  prerelease: S.Array(S.Union([Component, S.Literals(["alpha", "RC", "01a", "-", "beta-2"])])),
  build: S.Array(S.Literals(["001", "Build", "sha-1", "-"])),
});
const Comparator = S.Struct({ operator: S.Literals(["=", ">", ">=", "<", "<="]), version: Version });
const Comparators = S.NonEmptyArray(Comparator);
const Sets = S.NonEmptyArray(Comparators);

describe("grammar property floor", () => {
  it.effect.prop("version formatting is idempotent through parsing and preserves every identifier", [Arbitrary.schema(Version)], ([version]) => Effect.sync(() => {
    const text = formatVersion(version);
    const parsed = parseVersion(` \t${text}\n`);
    assert.deepStrictEqual(parsed, { ok: true, value: version });
    if (parsed.ok) {
      assert.strictEqual(formatVersion(parsed.value), text);
      assert.deepStrictEqual(parseVersion(formatVersion(parsed.value)), parsed);
    }
  }), runs);

  it.effect.prop("comparator formatting is idempotent and faithful, including implicit equality", [Arbitrary.schema(Comparator)], ([comparator]) => Effect.sync(() => {
    const text = formatComparator(comparator);
    const parsed = parseComparator(` ${text} `);
    assert.deepStrictEqual(parsed, { ok: true, value: comparator });
    if (parsed.ok) {
      assert.strictEqual(formatComparator(parsed.value), text);
      assert.deepStrictEqual(parseComparator(formatComparator(parsed.value)), parsed);
    }
  }), runs);

  it.effect.prop("range formatting is idempotent and preserves OR-of-AND comparator sets", [Arbitrary.schema(Sets)], ([sets]) => Effect.sync(() => {
    const text = formatRange(sets);
    const parsed = parseRange(` ${text} `);
    assert.deepStrictEqual(parsed, { ok: true, value: sets });
    if (parsed.ok) {
      assert.strictEqual(formatRange(parsed.value), text);
      assert.deepStrictEqual(parseRange(formatRange(parsed.value)), parsed);
    }
  }), runs);

  it.effect.prop("README strictness rejects prefixes, numeric leading zeros and trailing junk with positions", [Arbitrary.schema(Version)], ([version]) => Effect.sync(() => {
    const text = formatVersion(version);
    for (const prefix of ["v", "V", "=", "0"]) {
      assert.deepStrictEqual(parseVersion(`${prefix}${text}`), { ok: false, input: `${prefix}${text}`, position: 0 });
    }
    assert.deepStrictEqual(parseVersion(`${text}?`), { ok: false, input: `${text}?`, position: text.length });
  }), runs);
});

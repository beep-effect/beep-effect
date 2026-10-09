import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { desugarCaret, desugarHyphen, desugarTilde, desugarXRange, type PartialParts } from "../../../effected/semver/internal/desugar.ts";
import { formatRange, parseRange } from "../../../effected/semver/internal/grammar.ts";
import type { ComparatorParts } from "../../../effected/semver/internal/order.ts";

const runs = { arbitrary: fcRuns(100) };
const Component = S.Int.check(S.isBetween({ minimum: 0, maximum: 1000000 }));
const Sample = S.Struct({ major: Component, minor: Component, patch: Component, depth: S.Literals([0, 1, 2, 3]) });
const parts = (sample: typeof Sample.Type): PartialParts => ({
  major: sample.depth >= 1 ? sample.major : null,
  minor: sample.depth >= 2 ? sample.minor : null,
  patch: sample.depth >= 3 ? sample.patch : null,
  prerelease: [], build: [],
});
const spelling = (value: PartialParts): string =>
  value.major === null ? "*" : value.minor === null ? `${value.major}` : value.patch === null ? `${value.major}.${value.minor}` : `${value.major}.${value.minor}.${value.patch}`;
const faithful = (input: string, expanded: ReadonlyArray<ComparatorParts>) => {
  const expected = { ok: true as const, value: [expanded] };
  assert.deepStrictEqual(parseRange(input), expected);
  const canonical = formatRange([expanded]);
  const parsed = parseRange(canonical);
  assert.deepStrictEqual(parsed, expected);
  if (parsed.ok) {
    assert.strictEqual(formatRange(parsed.value), canonical);
    assert.deepStrictEqual(parseRange(formatRange(parsed.value)), parsed);
  }
};

describe("desugar property floor", () => {
  it.effect.prop("tilde expansion has faithful and idempotent primitive formatting", [Arbitrary.schema(Sample)], ([sample]) => Effect.sync(() => {
    const value = parts(sample);
    faithful(`~${spelling(value)}`, desugarTilde(value));
  }), runs);
  it.effect.prop("caret expansion has faithful and idempotent primitive formatting", [Arbitrary.schema(Sample)], ([sample]) => Effect.sync(() => {
    const value = parts(sample);
    faithful(`^${spelling(value)}`, desugarCaret(value));
  }), runs);
  it.effect.prop("X-range expansion agrees with the dialect for every operator", [Arbitrary.schema(Sample), S.Literals(["=", ">", ">=", "<", "<="]).pipe(S.NullOr, Arbitrary.schema)], ([sample, operator]) => Effect.sync(() => {
    const value = parts(sample);
    const expanded = desugarXRange(operator, value);
    faithful(`${operator ?? ""}${spelling(value)}`, expanded);
    assert.deepStrictEqual(desugarXRange(value)(operator), expanded);
  }), runs);
  it.effect.prop("hyphen expansion preserves both bounds and canonical primitive fidelity", [Arbitrary.schema(Sample), Arbitrary.schema(Sample)], ([lowerSample, upperSample]) => Effect.sync(() => {
    const lower = parts(lowerSample);
    const upper = parts(upperSample);
    const expanded = desugarHyphen(lower, upper);
    faithful(`${spelling(lower)} - ${spelling(upper)}`, expanded);
    assert.deepStrictEqual(desugarHyphen(upper)(lower), expanded);
  }), runs);
});

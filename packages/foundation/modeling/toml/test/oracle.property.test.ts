import { Toml } from "@beep/toml/Toml";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "@beep/toml/TomlDateTime";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { identity } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parse as oracleParse, stringify as oracleStringify } from "smol-toml";
import { readValid, readValidExpected, validCases } from "./corpus.ts";
import { assertMatchesTagged } from "./e2e/taggedJson.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/i;

const truncateFractionToMilliseconds = (fraction: string | undefined): number =>
  fraction === undefined ? 0 : Number(Str.slice(0, 3)(Str.padEnd(3, "0")(fraction)));

const offsetToMinutes = (offset: string): number => {
  if (Str.toUpperCase(offset) === "Z") {
    return 0;
  }
  const total = Number(Str.slice(1, 3)(offset)) * 60 + Number(Str.slice(4, 6)(offset));
  return Str.startsWith("-")(offset) && total !== 0 ? -total : total;
};

const canonOracleDate = (value: Date): unknown => {
  const iso = value.toISOString();
  const dateTime = DATETIME_RE.exec(iso);
  if (dateTime !== null) {
    const base = {
      year: Number(dateTime[1]),
      month: Number(dateTime[2]),
      day: Number(dateTime[3]),
      hour: Number(dateTime[4]),
      minute: Number(dateTime[5]),
      second: Number(dateTime[6]),
      ms: truncateFractionToMilliseconds(dateTime[7]),
    };
    const offset = dateTime[8];
    return offset === undefined
      ? { $dt: "datetime-local", ...base }
      : { $dt: "datetime", ...base, offset: offsetToMinutes(offset) };
  }
  const date = DATE_RE.exec(iso);
  if (date !== null) {
    return { $dt: "date-local", year: Number(date[1]), month: Number(date[2]), day: Number(date[3]) };
  }
  const time = TIME_RE.exec(iso);
  if (time !== null) {
    return {
      $dt: "time-local",
      hour: Number(time[1]),
      minute: Number(time[2]),
      second: Number(time[3]),
      ms: truncateFractionToMilliseconds(time[4]),
    };
  }
  return { $dt: "unrecognized", iso };
};

const truncateNanosecondsToMilliseconds = (nanosecond: number): number => Math.floor(nanosecond / 1_000_000);

const canonEngineDateTime = (value: unknown): unknown => {
  if (S.is(TomlOffsetDateTime)(value)) {
    return {
      $dt: "datetime",
      year: value.year,
      month: value.month,
      day: value.day,
      hour: value.hour,
      minute: value.minute,
      second: value.second,
      ms: truncateNanosecondsToMilliseconds(value.nanosecond),
      offset: value.offsetMinutes === 0 ? 0 : value.offsetMinutes,
    };
  }
  if (S.is(TomlLocalDateTime)(value)) {
    return {
      $dt: "datetime-local",
      year: value.year,
      month: value.month,
      day: value.day,
      hour: value.hour,
      minute: value.minute,
      second: value.second,
      ms: truncateNanosecondsToMilliseconds(value.nanosecond),
    };
  }
  if (S.is(TomlLocalDate)(value)) {
    return { $dt: "date-local", year: value.year, month: value.month, day: value.day };
  }
  if (S.is(TomlLocalTime)(value)) {
    return {
      $dt: "time-local",
      hour: value.hour,
      minute: value.minute,
      second: value.second,
      ms: truncateNanosecondsToMilliseconds(value.nanosecond),
    };
  }
  return undefined;
};

const canonContainer = (value: unknown): unknown => {
  if (value instanceof Date) {
    return canonOracleDate(value);
  }
  if (A.isArray(value)) {
    return A.map(value, canon);
  }
  if (P.isObject(value)) {
    const record = value;
    return R.fromEntries(A.map(R.keys(record), (key): [string, unknown] => [key, canon(record[key])]));
  }
  return value;
};

const canonNonPrimitive = (value: unknown): unknown => {
  const dateTime = canonEngineDateTime(value);
  return dateTime === undefined ? canonContainer(value) : dateTime;
};

const canonBigInt = (value: bigint): unknown =>
  value >= -MAX_SAFE_BIG && value <= MAX_SAFE_BIG ? Number(value) : value;

const canonicalizeNaNAndNegativeZero = (value: number): unknown => {
  if (Number.isNaN(value)) {
    return { $nan: true };
  }
  return Object.is(value, -0) ? { $negativeZero: true } : value;
};

// decision: oracle-comparison-domain
const canon = (value: unknown): unknown => {
  switch (typeof value) {
    case "bigint":
      return canonBigInt(value);
    case "number":
      return canonicalizeNaNAndNegativeZero(value);
    case "string":
    case "boolean":
      return value;
    default:
      return canonNonPrimitive(value);
  }
};

const oracle = (text: string): unknown => oracleParse(text, { integersAsBigInt: true });

// decision: oracle-arbitrary-combinators
function weighted<A>(
  first: readonly [weight: number, arbitrary: Arbitrary.Arbitrary<A>],
  ...rest: ReadonlyArray<readonly [weight: number, arbitrary: Arbitrary.Arbitrary<A>]>
): Arbitrary.Arbitrary<A> {
  const total = A.reduce(rest, first[0], (sum, [weight]) => sum + weight);
  return Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: total - 1 }))).pipe(
    Arbitrary.flatMap((ticket) => {
      let remaining = ticket - first[0];
      for (const [weight, arbitrary] of rest) {
        if (remaining < 0) break;
        if (remaining < weight) return arbitrary;
        remaining -= weight;
      }
      return first[1];
    })
  );
}

function arrayOf<A>(
  item: Arbitrary.Arbitrary<A>,
  { minLength = 0, maxLength }: { readonly minLength?: number; readonly maxLength: number }
): Arbitrary.Arbitrary<Array<A>> {
  return Arbitrary.schema(S.Int.check(S.isBetween({ minimum: minLength, maximum: maxLength }))).pipe(
    Arbitrary.flatMap((length) => Arbitrary.all(Array.from({ length }, () => item)))
  );
}

const scalarCharArb = Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0x20, maximum: 0x10ffff }))).pipe(
  Arbitrary.filter((codePoint) => codePoint < 0xd800 || codePoint > 0xdfff),
  Arbitrary.map((codePoint) => String.fromCodePoint(codePoint))
);

const nastyCharArb = Arbitrary.schema(
  S.Literals(['"', "\\", "\n", "\r", "\t", "\b", "\f", "\u0000", "\u001f", "\u007f", "'", " "])
);

const stringArb = arrayOf(weighted([5, scalarCharArb], [3, nastyCharArb]), { maxLength: 12 }).pipe(
  Arbitrary.map((chars) => A.join(chars, ""))
);

const bareKeyArb = Arbitrary.schema(S.String.check(S.isPattern(/^[abzAZ_\-019]{1,8}$/)));

const quotedKeyArb = weighted<string>(
  [1, Arbitrary.schema(S.Literals(["", "a.b", "a b", 'quo"te', "back\\slash", "uni é中", "\ttab", "new\nline"]))],
  [1, stringArb]
);

const keyArb = weighted([3, bareKeyArb], [2, quotedKeyArb]);

const integerArb = Arbitrary.schema(
  S.Union([
    S.Int.check(S.isBetween({ minimum: -(2 ** 31), maximum: 2 ** 31 - 1 })),
    S.Int.check(S.isBetween({ minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER })),
  ])
);

const INT64_MAX = 2n ** 63n - 1n;

const bigintArb = Arbitrary.schema(S.BigInt.check(S.isBetweenBigInt({ minimum: -INT64_MAX, maximum: INT64_MAX })));

const infinityArb = Arbitrary.schema(S.Boolean).pipe(
  Arbitrary.map((positive) => (positive ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY))
);

const floatArb = weighted<number>([9, Arbitrary.schema(S.Finite)], [1, infinityArb]);

const leafArb: Arbitrary.Arbitrary<unknown> = weighted<unknown>(
  [3, stringArb],
  [2, integerArb],
  [2, floatArb],
  [1, bigintArb],
  [1, Arbitrary.schema(S.Boolean)]
);

function valueArb(depth: number): Arbitrary.Arbitrary<unknown> {
  if (depth <= 0) {
    return leafArb;
  }
  return weighted<unknown>([4, leafArb], [2, arrayOf(valueArb(depth - 1), { maxLength: 5 })], [2, tableArb(depth - 1)]);
}

function tableArb(depth: number): Arbitrary.Arbitrary<Record<string, unknown>> {
  return arrayOf(Arbitrary.all([keyArb, valueArb(depth)]), { maxLength: 5 }).pipe(
    Arbitrary.map((entries) => R.fromEntries(entries))
  );
}

// decision: tests-prop-array-form
const documentArb = tableArb(3);

const REPRODUCIBLE_ORACLE_CHECK_OPTIONS: Arbitrary.CheckOptions = { runs: 250, seed: 20260710 };

describe("smol-toml differential oracle", () => {
  it.effect.prop(
    "our stringify parses identically under both parsers",
    [documentArb],
    ([document]) =>
      Effect.gen(function* () {
        const text = yield* Toml.stringify(document);
        const ours = yield* Toml.parse(text);
        assert.deepStrictEqual(canon(ours), canon(oracle(text)), text);
      }),
    { arbitrary: REPRODUCIBLE_ORACLE_CHECK_OPTIONS }
  );

  it.effect.prop(
    "the oracle's stringify parses identically under both parsers",
    [documentArb],
    ([document]) =>
      Effect.gen(function* () {
        const text = oracleStringify(document);
        const ours = yield* Toml.parse(text);
        assert.deepStrictEqual(canon(ours), canon(oracle(text)), text);
      }),
    { arbitrary: REPRODUCIBLE_ORACLE_CHECK_OPTIONS }
  );

  it.effect("NaN round-trips through our stringify into NaN under both parsers", () =>
    Effect.gen(function* () {
      const text = yield* Toml.stringify({ x: Number.NaN });
      const ours = yield* Toml.parse(text);
      const theirs = oracle(text);
      if (!P.isObject(ours) || !P.isObject(theirs)) {
        assert.fail("expected both parsers to yield tables");
      }
      assert.isTrue(Number.isNaN(ours.x), "our parse must yield NaN");
      assert.isTrue(Number.isNaN(theirs.x), "the oracle's parse must yield NaN");
    })
  );
});

const README_VALID_COUNT = 214;

const EXPECTED_ORACLE_DIVERGENCES: ReadonlyArray<string> = [];

interface Divergence {
  readonly detail: string;
  readonly file: string;
}

describe("corpus differential", () => {
  const divergences: Array<Divergence> = [];

  it("discovers the full valid corpus", () => {
    assert.isAtLeast(validCases.length, README_VALID_COUNT, "valid corpus walk came up short");
  });

  for (const relPath of validCases) {
    it.effect(relPath, () =>
      Effect.gen(function* () {
        const source = readValid(relPath);
        const ours = yield* Toml.parse(source);
        const oracleResult = Result.try(() => oracle(source));
        if (Result.isFailure(oracleResult)) {
          divergences.push({
            file: relPath,
            detail: `oracle rejected: ${Str.split("\n")(String(oracleResult.failure))[0]}`,
          });
          assertOursAgainstCorpus(ours, relPath);
          return;
        }
        const theirs = oracleResult.success;
        if (Equal.equals(canon(ours), canon(theirs))) {
          return;
        }
        divergences.push({ file: relPath, detail: "oracle parse disagrees with ours" });
        assertOursAgainstCorpus(ours, relPath);
      })
    );
  }

  it("pins the oracle divergence log after all per-file cases have accumulated", () => {
    assert.deepStrictEqual(A.map(divergences, (divergence) => `${divergence.file}: ${divergence.detail}`).sort(), [
      ...EXPECTED_ORACLE_DIVERGENCES,
    ]);
  });
});

function assertOursAgainstCorpus(ours: unknown, relPath: string): void {
  const expected: unknown = Result.getOrThrowWith(S.decodeResult(UnknownJson)(readValidExpected(relPath)), identity);
  assertMatchesTagged(ours, expected, "$");
}

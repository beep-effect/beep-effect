// Goal canonical-digest-owner: the encoder differential as a tracked test.
//
// Slice A held the hand-rolled canonical-JSON encoders byte-equal to the
// owner, `JsoncFingerprint.canonicalizeResult` (RFC 8785), on generated plain
// JSON: the epistemics encoder behind `canonicalDetectionJson`, PacketCore's
// `canonicalJsonText`, and the JSON frontmatter encoder inside `@beep/md`,
// which the census found and which is reachable only through a rendered
// document. The semantica lab encoder has the same two tests in
// `apps/labs/semantica/test/CanonicalDifferential.test.ts`, because a package
// cannot import an app.
//
// Slice C replaces each body with the owner, one encoder per commit. A swapped
// export is the owner by construction, so its byte-equality property would
// compare the owner with itself and is dropped. What still carries
// information is the table below: for each value outside plain JSON, what the
// legacy encoder did (recorded from slice A, since that code is gone) and what
// the export does now, which is each behaviour change of the swap.
//
// This file lives in `@beep/repo-cli` because that package already depends on
// `@beep/epistemics`, `@beep/jsonc` and the test kits, so it adds no
// dependency edge (decision `2026-11-12-differential-test-placement`).
import { canonicalDetectionJson } from "@beep/epistemics/ContradictionDetection";
import { JsoncCanonicalizeError, JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { Md } from "@beep/md";
import { Document } from "@beep/md/Md.model";
import { canonicalJsonText } from "@beep/repo-cli/test/Goals";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { JsoncCanonicalizeErrorCode } from "@beep/jsonc/JsoncFingerprint";

type Encoder = (value: unknown) => string;

// Exports whose body is the owner since slice C.
const swapped: ReadonlyArray<readonly [name: string, encode: Encoder]> = [
  ["epistemics canonicalDetectionJson", canonicalDetectionJson],
  ["PacketCore canonicalJsonText", canonicalJsonText],
];

// ── Generator ───────────────────────────────────────────────────────────────

// Numbers whose ECMAScript serialization is easy to get wrong: negative zero,
// both ends of the exponent switch (1e21, 1e-7), the smallest and largest
// doubles, and integers on either side of 2 ** 53.
const edgeNumbers = [
  0,
  -0,
  1,
  -1,
  0.1 + 0.2,
  1.5,
  4.35,
  1e-6,
  1e-7,
  1e20,
  1e21,
  123456789012345680000,
  333333333.3333333,
  5e-324,
  2 ** 53,
  2 ** 53 + 2,
  Number.MAX_SAFE_INTEGER,
  Number.MIN_SAFE_INTEGER,
  Number.MAX_VALUE,
  -Number.MAX_VALUE,
] as const;

// Strings that separate the escaping and ordering rules: every two-character
// escape, C0 controls, the two line separators JSON leaves unescaped, a
// precomposed and a decomposed accent, and three keys whose UTF-16 code-unit
// order (RFC 8785) differs from their code-point order: U+10000 is the unit
// pair D800 DC00, so it sorts before U+E000 and U+FB00.
const edgeStrings = [
  "",
  '"',
  "\\",
  "/",
  "\u0000",
  "\u001f",
  "\u007f",
  "\b\f\n\r\t",
  "\u2028",
  "\u2029",
  "\u00e9",
  "e\u0301",
  "\ue000",
  "\ufb00",
  "\uffff",
  "\u{10000}",
  "\u{1f600}",
  "__proto__",
  "constructor",
  "toString",
  "0",
  "9",
  "10",
  "a",
  "A",
  "aa",
] as const;

const pick = <T>(pool: A.NonEmptyReadonlyArray<T>): Arbitrary.Arbitrary<T> =>
  Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: pool.length - 1 }))).pipe(
    Arbitrary.map((index) => A.getUnsafe(pool, index))
  );

// `Arbitrary.schema(S.Json)` also generates strings with unpaired surrogates,
// which are not I-JSON. Those belong to the off-domain table below, so the
// plain-JSON generator replaces them with U+FFFD and keeps every run on the
// domain instead of discarding it.
const isJsonArray = (value: S.Json): value is S.JsonArray => A.isArray(value);
const isJsonObject = (value: S.Json): value is S.JsonObject =>
  P.isObject(value) && !P.isNull(value) && !A.isArray(value);

const wellFormed = (value: S.Json): S.Json => {
  if (P.isString(value)) {
    return value.toWellFormed();
  }
  if (isJsonArray(value)) {
    return A.map(value, wellFormed);
  }
  if (isJsonObject(value)) {
    return pipe(
      R.toEntries(value),
      A.map(([key, entry]) => [key.toWellFormed(), wellFormed(entry)] as const),
      R.fromEntries
    );
  }
  return value;
};

// A schema-derived JSON tree, widened with the edge pools: the pools appear as
// array elements, as member values and as member keys, at the top level and
// one level down, so key ordering is exercised on exactly the keys where the
// two orders disagree.
const plainJsonObject: Arbitrary.Arbitrary<S.JsonObject> = Arbitrary.all({
  tree: Arbitrary.schema(S.Json).pipe(Arbitrary.map(wellFormed)),
  numbers: Arbitrary.array(pick(edgeNumbers), { maxLength: 8 }),
  strings: Arbitrary.array(pick(edgeStrings), { maxLength: 8 }),
}).pipe(
  Arbitrary.map(({ tree, numbers, strings }): S.JsonObject => {
    const keyed = R.fromEntries(
      A.map(strings, (key, index) => [key, O.getOrElse(A.get(numbers, index), (): S.Json => tree)] as const)
    );
    return {
      tree,
      numbers,
      strings,
      keyed,
      nested: [[tree, keyed], { "": strings, [Str.repeat(2)("\u{10000}")]: numbers }],
    };
  })
);

// The md encoder has no entry point of its own: it renders a document's JSON
// frontmatter between two fence lines.
const mdFrontmatter = (frontmatter: S.JsonObject): string =>
  Md.renderUnsafe(Document.make({ children: [], frontmatter: O.some(frontmatter) }));

const fenced = (canonical: string): string => `---json\n${canonical}\n---`;

// ── Plain JSON: byte equality of the encoders not yet swapped ───────────────

describe("canonical digest owner: md frontmatter differential", () => {
  it.prop(
    "@beep/md frontmatter emits the owner's RFC 8785 bytes for every plain JSON object",
    { value: plainJsonObject },
    ({ value }) => {
      assertSuccess(Result.map(JsoncFingerprint.canonicalizeResult(value), fenced), mdFrontmatter(value));
    },
    { arbitrary: fcRuns(200) }
  );

  // Unlike the other encoders, this one writes its own string escapes and
  // leaves an unpaired surrogate unescaped.
  it("fixes what @beep/md frontmatter does with an unpaired surrogate", () => {
    expect(mdFrontmatter({ s: "\ud800" })).toBe(fenced('{"s":"\ud800"}'));
    expect(observeOwner({ s: "\ud800" })).toStrictEqual({ refused: "LoneSurrogate" });
  });
});

// ── Off the JSON domain: what each side does today ──────────────────────────

type Observed =
  | { readonly text: string }
  | { readonly threw: string }
  | { readonly refused: JsoncCanonicalizeErrorCode };

// A swapped export throws the owner's typed error; it reads back as the same
// `refused` code the owner returns.
const observeEncoder = (encode: Encoder, value: unknown): Observed =>
  pipe(
    Result.try({ try: () => encode(value), catch: identity }),
    Result.match({
      onSuccess: (text): Observed => ({ text }),
      onFailure: (thrown): Observed =>
        S.is(JsoncCanonicalizeError)(thrown)
          ? { refused: thrown.code }
          : { threw: P.isError(thrown) ? thrown.name : "non-error" },
    })
  );

const observeOwner = (value: unknown): Observed =>
  Result.match(JsoncFingerprint.canonicalizeResult(value), {
    onSuccess: (text): Observed => ({ text }),
    onFailure: (failure): Observed => ({ refused: failure.code }),
  });

type OffDomainRow = {
  readonly input: string;
  readonly value: () => unknown;
  // What a swapped encoder emitted before slice C, as slice A observed it. The
  // code is gone, so this is the record of the change, not an assertion.
  readonly legacy: { readonly epistemics: Observed; readonly packetCore: Observed };
  readonly epistemics: Observed;
  readonly packetCore: Observed;
  readonly owner: Observed;
};

const nestedArrays = (depth: number): unknown => A.reduce(A.range(1, depth), null as unknown, (inner) => [inner]);

const offDomainRows: ReadonlyArray<OffDomainRow> = [
  {
    input: "an object member whose value is undefined",
    // PacketCore passes `omitUndefinedMembers`: goal completion relies on it.
    value: () => ({ a: undefined, b: 1 }),
    legacy: { epistemics: { text: '{"b":1}' }, packetCore: { text: '{"b":1}' } },
    epistemics: { refused: "UnrepresentableValue" },
    packetCore: { text: '{"b":1}' },
    owner: { refused: "UnrepresentableValue" },
  },
  {
    input: "an undefined array element",
    value: () => [1, undefined, 2],
    legacy: { epistemics: { threw: "TypeError" }, packetCore: { text: "[1,null,2]" } },
    epistemics: { refused: "UnrepresentableValue" },
    packetCore: { refused: "UnrepresentableValue" },
    owner: { refused: "UnrepresentableValue" },
  },
  {
    input: "undefined at the root",
    value: () => undefined,
    legacy: { epistemics: { threw: "TypeError" }, packetCore: { text: "null" } },
    epistemics: { refused: "UnrepresentableValue" },
    packetCore: { refused: "UnrepresentableValue" },
    owner: { refused: "UnrepresentableValue" },
  },
  {
    input: "NaN",
    value: () => ({ n: Number.NaN }),
    legacy: { epistemics: { text: '{"n":null}' }, packetCore: { text: '{"n":null}' } },
    epistemics: { refused: "NonFiniteNumber" },
    packetCore: { refused: "NonFiniteNumber" },
    owner: { refused: "NonFiniteNumber" },
  },
  {
    input: "Infinity",
    value: () => [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
    legacy: { epistemics: { text: "[null,null]" }, packetCore: { text: "[null,null]" } },
    epistemics: { refused: "NonFiniteNumber" },
    packetCore: { refused: "NonFiniteNumber" },
    owner: { refused: "NonFiniteNumber" },
  },
  {
    input: "a Date",
    value: () => ({ d: DateTime.toDate(DateTime.makeUnsafe(0)) }),
    legacy: { epistemics: { text: '{"d":{}}' }, packetCore: { text: '{"d":{}}' } },
    epistemics: { refused: "NonPlainObject" },
    packetCore: { refused: "NonPlainObject" },
    owner: { refused: "NonPlainObject" },
  },
  {
    input: "a bigint",
    value: () => ({ b: 1n }),
    legacy: { epistemics: { text: '{"b":{}}' }, packetCore: { text: '{"b":null}' } },
    epistemics: { refused: "BigIntValue" },
    packetCore: { refused: "BigIntValue" },
    owner: { refused: "BigIntValue" },
  },
  {
    input: "a lone surrogate in a string value",
    value: () => ["\ud800"],
    legacy: { epistemics: { text: '["\\ud800"]' }, packetCore: { text: '["\\ud800"]' } },
    epistemics: { refused: "LoneSurrogate" },
    packetCore: { refused: "LoneSurrogate" },
    owner: { refused: "LoneSurrogate" },
  },
  {
    input: "a lone surrogate in a member key",
    value: () => ({ "\udc00": 1 }),
    legacy: { epistemics: { text: '{"\\udc00":1}' }, packetCore: { text: '{"\\udc00":1}' } },
    epistemics: { refused: "LoneSurrogate" },
    packetCore: { refused: "LoneSurrogate" },
    owner: { refused: "LoneSurrogate" },
  },
];

describe("canonical digest owner: behaviour off the JSON domain", () => {
  for (const row of offDomainRows) {
    it(`fixes each side's output for ${row.input}`, () => {
      expect(observeEncoder(canonicalDetectionJson, row.value())).toStrictEqual(row.epistemics);
      expect(observeEncoder(canonicalJsonText, row.value())).toStrictEqual(row.packetCore);
      expect(observeOwner(row.value())).toStrictEqual(row.owner);
    });
  }

  // Both legacy encoders wrote `{"n":null}` for NaN and for null alike.
  it("no longer gives two different values one encoding: NaN is refused", () => {
    for (const [, encode] of swapped) {
      expect(observeEncoder(encode, { n: Number.NaN })).toStrictEqual({ refused: "NonFiniteNumber" });
      expect(observeEncoder(encode, { n: null })).toStrictEqual({ text: '{"n":null}' });
    }
    expect(observeOwner({ n: Number.NaN })).toStrictEqual({ refused: "NonFiniteNumber" });
    expect(observeOwner({ n: null })).toStrictEqual({ text: '{"n":null}' });
  });

  // Plain JSON, but past the owner's hardening cap. No stored value nests this
  // deep (the replay proves that for events and seals). The legacy encoders
  // emitted it; a swapped export refuses it, a behaviour change of slice C.
  it("fixes the one plain-JSON difference: nesting past the owner's depth cap", () => {
    const atCap = nestedArrays(256);
    const pastCap = nestedArrays(257);
    for (const [, encode] of swapped) {
      assertSuccess(JsoncFingerprint.canonicalizeResult(atCap), encode(atCap));
      expect(observeEncoder(encode, pastCap)).toStrictEqual({ refused: "NestingDepthExceeded" });
    }
    expect(observeOwner(pastCap)).toStrictEqual({ refused: "NestingDepthExceeded" });
  });
});

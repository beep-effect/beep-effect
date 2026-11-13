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
import { describe, expect, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { JsoncCanonicalizeErrorCode } from "@beep/jsonc/JsoncFingerprint";

type Encoder = (value: unknown) => string;

// Exports whose body is the owner since slice C.
const swapped: ReadonlyArray<readonly [name: string, encode: Encoder]> = [
  ["epistemics canonicalDetectionJson", canonicalDetectionJson],
  ["PacketCore canonicalJsonText", canonicalJsonText],
];

// ── Off the JSON domain: what each export did and does ──────────────────────

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

// ── @beep/md frontmatter ────────────────────────────────────────────────────

const frontmatterDocument = (frontmatter: S.JsonObject): Document =>
  Document.make({ children: [], frontmatter: O.some(frontmatter) });

const fenced = (canonical: string): string => `---json\n${canonical}\n---`;

describe("canonical digest owner: @beep/md frontmatter", () => {
  // The fences and the empty-object rule are md's own; the JSON between the
  // fences is the owner's, keys in UTF-16 code-unit order.
  it("renders JSON frontmatter as the owner's RFC 8785 text between fences", () => {
    assertSuccess(
      Result.map(
        Md.render(frontmatterDocument({ b: 1, "\ue000": 3, a: [true, null], "\u{10000}": 2 })),
        (markdown): string => markdown
      ),
      fenced('{"a":[true,null],"b":1,"\u{10000}":2,"\ue000":3}')
    );
  });

  // Behaviour change from slice C. The legacy encoder wrote its own escapes
  // and left an unpaired surrogate raw, `{"s":"\ud800"}` between the fences
  // (recorded from slice A). The render entry points now refuse it: `render`
  // fails typed with a `RenderError` carrying the owner's refusal as its
  // cause, and `renderUnsafe` throws the owner's error.
  it("refuses an unpaired surrogate: render fails typed, renderUnsafe throws", () => {
    const illFormed = frontmatterDocument({ s: "\ud800" });

    assertFailure(
      Result.mapError(Md.render(illFormed), (error) =>
        S.is(JsoncCanonicalizeError)(error.cause) ? error.cause.code : "not refused"
      ),
      "LoneSurrogate"
    );
    expect(observeEncoder(() => Md.renderUnsafe(illFormed), undefined)).toStrictEqual({ refused: "LoneSurrogate" });
  });
});

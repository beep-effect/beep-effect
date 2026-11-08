import { Sha256HexFromBytes } from "@beep/schema";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import material from "../fixtures/claim-element/finite-clause-material-correction.json" with { type: "json" };
import original from "../fixtures/claim-element/recurrence-source-plans.json" with { type: "json" };
import { assertFiniteSourceConformance } from "./ClaimElementFiniteConformance.ts";

const materialEntry = S.Struct({
  historicalCase: S.NonEmptyString,
  acceptedConformanceCase: S.NonEmptyString,
  source: S.NonEmptyString,
  sourceSha256: S.NonEmptyString,
  originalCaseSha256: S.NonEmptyString,
  originalCaseCanonicalJson: S.NonEmptyString,
  originalExpectedSha256: S.NonEmptyString,
  originalExpectedCanonicalJson: S.NonEmptyString,
  acceptedCompleteExpectedSha256: S.NonEmptyString,
  acceptedCompleteExpectedCanonicalJson: S.NonEmptyString,
  acceptedCompleteExpected: S.Json,
  correctedCaseSha256: S.NonEmptyString,
  correctedCaseCanonicalJson: S.NonEmptyString,
});
const materialOverlay = S.Struct({
  activationSha256: S.NonEmptyString,
  historicalFixtureSha256: S.NonEmptyString,
  historicalRows: S.Int,
  unchangedNormativeCarry: S.Int,
  explicitMaterialOverlays: S.Int,
  entries: S.Array(materialEntry),
});
const originalRow = S.Struct({
  qualifiedText: S.NonEmptyString,
  qualifiedParts: S.Struct({ preamble: S.NonEmptyString, transition: S.NonEmptyString, body: S.NonEmptyString }),
  lexicalEvidence: S.Struct({
    tokens: S.Array(S.Struct({ anchor: S.Json, pos: S.NonEmptyString, lemma: S.NullOr(S.NonEmptyString) })),
  }),
});
const decodeJson = S.decodeEffect(S.fromJsonString(S.Record(S.String, S.Json)));
const hashText = S.decodeEffect(Sha256HexFromBytes);
const assertPinnedJson = Effect.fn("MaterialConformance.assertPinnedJson")(function* (text: string, expected: string) {
  const hash = yield* hashText(new TextEncoder().encode(text));
  assert.strictEqual(hash, expected);
  return yield* decodeJson(text);
});

/**
 * Apply only the two already accepted versioned material expectations, with
 * complete original/corrected object and inverse guards. Historical54 remain
 * immutable and their raw two failures are reported separately.
 * **Example** (Use the source control)
 * ```ts
 * import { assertVersionedMaterialConformance } from "./helpers/ClaimElementMaterialConformance.ts"
 * console.log(typeof assertVersionedMaterialConformance) // "function"
 * ```
 * @category testing
 * @since 0.0.0
 */
export const assertVersionedMaterialConformance = Effect.fn("MaterialConformance.versioned")(function* (name: string) {
  const overlay = yield* S.decodeEffect(materialOverlay)(material);
  assert.strictEqual(overlay.activationSha256, "1fac3bf660a4e1609a5c7753aaf6ca2c37e224315e3f8f3be232214ecc818d1a");
  assert.strictEqual(
    overlay.historicalFixtureSha256,
    "30c157e028651b63ac6074be1d8bfbca01887a6c215b6a077e79446f57648e07"
  );
  assert.deepStrictEqual(
    [overlay.historicalRows, overlay.unchangedNormativeCarry, overlay.explicitMaterialOverlays],
    [54, 52, 2]
  );
  const entry = O.getOrThrow(A.findFirst(overlay.entries, (entry) => entry.historicalCase === name));
  const old = yield* assertPinnedJson(entry.originalCaseCanonicalJson, entry.originalCaseSha256);
  const oldExpected = yield* assertPinnedJson(entry.originalExpectedCanonicalJson, entry.originalExpectedSha256);
  const accepted = yield* assertPinnedJson(
    entry.acceptedCompleteExpectedCanonicalJson,
    entry.acceptedCompleteExpectedSha256
  );
  const corrected = yield* assertPinnedJson(entry.correctedCaseCanonicalJson, entry.correctedCaseSha256);
  assert.deepStrictEqual<unknown>(old, O.getOrThrow(A.findFirst(original.fixtures, (row) => row.case === name)));
  assert.deepStrictEqual(old.expected, oldExpected);
  assert.deepStrictEqual(accepted, entry.acceptedCompleteExpected);
  assert.deepStrictEqual({ ...old, expected: accepted }, corrected);
  assert.deepStrictEqual({ ...corrected, expected: oldExpected }, old);
  const sourceHash = yield* hashText(new TextEncoder().encode(entry.source));
  assert.strictEqual(sourceHash, entry.sourceSha256);
  const source = yield* S.decodeUnknownEffect(originalRow)(old);
  assert.strictEqual(source.qualifiedText, entry.source);
  yield* assertFiniteSourceConformance({
    case: entry.acceptedConformanceCase,
    source: source.qualifiedText,
    qualifiedParts: source.qualifiedParts,
    tokens: source.lexicalEvidence.tokens,
    outcome: "admitted",
    expected: accepted,
  });
});

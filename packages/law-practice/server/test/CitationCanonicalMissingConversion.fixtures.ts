/** Original missing-page constructor/parser assertions, eyecite 2.7.6 BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import { readCitationCanonicalAssertionPayloads } from "./CitationCanonicalCriteria.fixtures.ts";
import { installCitationCanonicalFactory } from "./CitationCanonicalDefaultFactory.fixtures.ts";
import { makeCitationCanonicalExtractionReplay } from "./CitationCanonicalExtractionRuntime.fixtures.ts";
import { compareCitationCanonicalModel } from "./CitationCanonicalModel.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const Criterion = S.Struct({
  context: S.Struct({ values: S.JsonObject }),
  operands: S.Tuple([S.Struct({ kind: S.tag("value"), value: S.Null })]),
  relation: S.Struct({ kind: S.tag("none"), isNone: S.tag(true) }),
  passed: S.tag(true),
}).pipe(S.fromJsonString);

/** Recompute the constructor's page dependency and the complete original parser call.
 * General retained factory/token state is separate from this group-value proof.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalMissingConversion = Effect.fn("CanonicalMissingConversionTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const { operations, assertions } = yield* readCitationCanonicalCaptures();
  const prefix = "tests.test_ModelsTest.ModelsTest.test_missing_page_cite_conversion::tests/test_ModelsTest.py:";
  const payloads = yield* readCitationCanonicalAssertionPayloads(
    assertions,
    A.map([168, 169], (line) => `${prefix}${line}:8:caseDeclaration::1`)
  );
  const criteria = yield* Effect.forEach(payloads, (payload) => S.decodeEffect(Criterion)(payload));
  const factory = yield* installCitationCanonicalFactory();
  const profile = { family: "case", reporter: "U.S.", factory: "case_citation", line: 48 } as const;
  const defaultModel = yield* factory.create(profile);
  const reference = yield* Effect.fromOption(defaultModel.publication.selectedEdition);
  const constructed = yield* factory.create(profile, { reporter: "U.S.", volume: "2", page: "__", reference });
  yield* compareCitationCanonicalModel(
    constructed,
    A.getUnsafe(criteria, 0).context.values.citation1,
    "constructor missing page"
  );
  expect(constructed.components.page).toEqual(O.none());
  const call = yield* Effect.fromOption(
    A.findFirst(operations.cases, (row) => row.id === `${prefix}166:20:get_citations::1`)
  );
  if (call.operation !== "get_citations")
    return yield* Effect.die("Expected original successful missing-page parser call");
  const body = call.payload.value;
  if (body.outcome.kind !== "success") return yield* Effect.die("Expected original successful missing-page outcome");
  expect({
    raw: body.input.plain_text,
    markup: body.input.markup_text,
    steps: body.input.clean_steps,
    ambiguous: body.input.remove_ambiguous,
    tokenizer: body.input.tokenizer.tokenizer,
  }).toEqual({
    raw: "2 U.S. __",
    markup: "",
    steps: null,
    ambiguous: false,
    tokenizer: "AhocorasickTokenizer",
  });
  const original = yield* S.decodeEffect(S.Array(S.JsonObject))(body.outcome.value);
  expect(original).toHaveLength(1);
  expect(A.getUnsafe(original, 0)).toEqual(A.getUnsafe(criteria, 1).context.values.citation2);
  const replay = yield* makeCitationCanonicalExtractionReplay(kind);
  const result = yield* replay.extract(body.input.plain_text, "plain", original, call.id);
  expect(A.getUnsafe(result.citations, 0).components.page).toEqual(O.none());
  yield* replay.assertRetired;
});

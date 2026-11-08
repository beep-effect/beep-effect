/** Original missing-page constructor/parser assertions, eyecite 2.7.6 BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import {
  readCitationCanonicalAssertionPayloads,
  readCitationCanonicalPlainExtraction,
} from "./CitationCanonicalCriteria.fixtures.ts";
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
  const call = yield* readCitationCanonicalPlainExtraction(operations, `${prefix}166:20:get_citations::1`, "2 U.S. __");
  const original = yield* S.decodeEffect(OriginalModels)(call.models);
  expect(original).toHaveLength(1);
  expect(A.getUnsafe(original, 0)).toEqual(A.getUnsafe(criteria, 1).context.values.citation2);
  const replay = yield* makeCitationCanonicalExtractionReplay(kind);
  const result = yield* replay.extract(call.input.plain_text, "plain", original, call.id);
  expect(A.getUnsafe(result.citations, 0).components.page).toEqual(O.none());
  yield* replay.assertRetired;
});

const OriginalModels = S.Array(S.JsonObject);

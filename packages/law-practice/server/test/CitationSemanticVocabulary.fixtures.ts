/** Independent public-vocabulary expectations from sealed source mapping evidence.
 * @internal @packageDocumentation @since 0.0.0
 */
import { Citation } from "@beep/law-practice-domain/values";
import { CitationOracleVocabularyMapping } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import type { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import type { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";

type Unicode = Effect.Success<ReturnType<typeof makeCitationPythonUnicode>>;
type Original = Pick<
  Effect.Success<
    ReturnType<typeof installCitationDefaultConfigurationFixture>
  >["corpus"]["cases"][number]["expected"][number],
  "kind" | "metadata"
>;
/** Capture the separately sealed mapping, not the production derived asset or
 * its lookup helper. The ordinary semantic comparison establishes family and
 * candidate-reference equality; this adds public reporter ids, artifact versions
 * and exact known/unmapped court representation for those same original values.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationVocabularyAssertion = Effect.fn("SemanticVocabularyTest.install")(function* () {
  const raw = yield* readCitationOracleFixture(
    "vocabulary-mapping",
    "b5aca44dc69f05b82c41decf327863a52c151eeb231bdb4df96e5cf7e85351c5"
  );
  const mapping = yield* S.decodeEffect(S.fromJsonString(CitationOracleVocabularyMapping))(raw);
  const editions = HashMap.fromIterable<string, (typeof mapping.editions)[number]>(
    A.map(mapping.editions, (row) => Tuple.make(row.artifactSha256, row))
  );
  const courts = HashSet.fromIterable<string>(
    A.appendAll(
      A.map(mapping.courts, (row) => row.id),
      mapping.publicOnlyCourtIds
    )
  );
  expect(HashMap.size(editions)).toBe(2533);
  const expectedCourt = Effect.fn("SemanticVocabularyTest.expectedCourt")(function* (
    unicode: Unicode,
    original: Original
  ) {
    const native = yield* Effect.fromOption(R.get(original.metadata, "court"));
    if (typeof native === "number") return yield* Effect.die("court observation must be native text or null");
    const label = native === null ? null : (yield* unicode.fromStorage(native)).text;
    let expected: S.Json = null;
    if (label !== null)
      expected = HashSet.has(courts, label)
        ? { status: "known", id: label, vocabularyVersion: mapping.publicArtifactVersion }
        : { status: "unmapped", value: label };
    return expected;
  });
  const assertCase = Effect.fn("SemanticVocabularyTest.case")(function* (
    unicode: Unicode,
    citation: Citation,
    original: Original
  ) {
    const actual = yield* S.encodeEffect(Citation)(citation);
    if (actual.type !== "case" && actual.type !== "shortFormCase") return;
    expect(actual.publication.vocabularyVersion).toBe(mapping.publicArtifactVersion);
    for (const edition of actual.publication.editions) {
      const expected = yield* Effect.fromOption(HashMap.get(editions, edition.edition));
      if (expected.kind !== "case-reporter")
        return yield* Effect.die("original case edition requires reporter mapping");
      expect(edition.reporterId, `original edition ${edition.edition}`).toBe(expected.reporterId);
    }
    const court = yield* expectedCourt(unicode, original);
    expect(actual.metadata.court, `${original.kind} original court identity`).toEqual(court);
  });
  return Effect.fn("SemanticVocabularyTest.document")(function* (
    unicode: Unicode,
    citations: ReadonlyArray<Citation>,
    originals: ReadonlyArray<Original>
  ) {
    expect(citations).toHaveLength(originals.length);
    yield* Effect.forEach(
      A.zip(citations, originals),
      ([citation, original]) => assertCase(unicode, citation, original),
      { concurrency: 1, discard: true }
    );
  });
});

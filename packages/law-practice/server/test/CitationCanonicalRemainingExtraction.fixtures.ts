/** Remaining original get_citations inputs from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationBuiltinCleanerName } from "@beep/law-practice-use-cases/server";
import { CitationOracleOperations } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { makeCitationCanonicalExtractionReplay } from "./CitationCanonicalExtractionRuntime.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const coveredSites = HashSet.fromIterable<string>([
  "tests/test_FindTest.py:75:34:get_citations",
  "tests/test_ResolveTest.py:130:20:get_citations",
  "tests/test_CourtsTest.py:41:29:get_citations",
  "tests/test_FindTest.py:1255:20:get_citations",
  "tests/test_FindTest.py:1296:24:get_citations",
]);
const customId =
  "tests.test_AnnotateTest.AnnotateTest.test_annotate::tests/test_AnnotateTest.py:241:24:get_citations::16";
const Steps = CitationBuiltinCleanerName.pipe(S.Array, S.NullOr);
const Input = S.Struct({
  plain_text: S.String,
  markup_text: S.String,
  clean_steps: Steps,
  remove_ambiguous: S.tag(false),
  tokenizer: S.Struct({ tokenizer: S.tag("AhocorasickTokenizer") }),
});
const Profile = S.fromJsonString(S.Tuple([S.Literals(["plain", "html"]), Steps]));
const Models = S.Array(S.JsonObject);
const readRows = Effect.fn("CanonicalRemainingTest.read")(function* () {
  const operations = yield* readCitationOracleFixture(
    "operation-cases",
    "ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1"
  ).pipe(Effect.flatMap(S.decodeEffect(OriginalOperations)));
  const remaining = A.filter(
    operations.cases,
    (row) => row.operation === "get_citations" && !HashSet.has(coveredSites, row.sourceSiteId) && row.id !== customId
  );
  expect(remaining).toHaveLength(69);
  return yield* Effect.forEach(
    remaining,
    Effect.fnUntraced(function* (row) {
      if (row.operation !== "get_citations") return yield* Effect.die("Expected original extraction call");
      const body = row.payload.value;
      if (body.outcome.kind !== "success") return yield* Effect.die("Expected original successful extraction");
      const input = yield* S.decodeUnknownEffect(Input)(body.input);
      const mode: "html" | "plain" = Str.isNonEmpty(input.markup_text) ? "html" : "plain";
      if (mode === "html") expect(input.plain_text, row.id).toBe("");
      const profile = yield* S.encodeEffect(Profile)(Tuple.make(mode, input.clean_steps));
      const models = yield* S.decodeEffect(Models)(body.outcome.value);
      return { id: row.id, input, mode, profile, models, plainText: body.stages.document.plainText };
    })
  );
});
/** Execute exact original cleaner choices through real default owners. The
 * separate custom-plan test retains the excluded callable operation. Full
 * integration never deduplicates source invocations; the focused entries cover
 * each of the five observed cleaner/argument profiles.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalRemainingExtraction = Effect.fn("CanonicalRemainingTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  shard: number,
  size: number,
  entriesOnly?: boolean
) {
  const rows = yield* readRows();
  const profiles = A.dedupeWith(rows, (left, right) => left.profile === right.profile);
  expect(profiles).toHaveLength(5);
  const selected = entriesOnly === true ? profiles : A.take(A.drop(rows, shard * size), size);
  expect(selected).toHaveLength(entriesOnly === true ? 5 : Math.min(size, rows.length - shard * size));
  const replay = yield* makeCitationCanonicalExtractionReplay(kind);
  for (const row of selected) {
    const text = row.mode === "html" ? row.input.markup_text : row.input.plain_text;
    const result = yield* replay.extract(text, row.mode, row.models, row.id, row.input.clean_steps);
    expect(result.source.source.sourceText, row.id).toBe(row.plainText);
  }
  yield* replay.assertRetired;
});

const OriginalOperations = S.fromJsonString(CitationOracleOperations);

/**
 * Rows per replay group; the integration range files pass it as `size`.
 * @internal @category testing @since 0.0.0
 */
export const CITATION_CANONICAL_REMAINING_EXTRACTION_GROUP_SIZE = 10;

/**
 * Number of replay groups of `CITATION_CANONICAL_REMAINING_EXTRACTION_GROUP_SIZE` rows that cover the table.
 * @internal @category testing @since 0.0.0
 */
export const CITATION_CANONICAL_REMAINING_EXTRACTION_GROUP_COUNT = 7;

/**
 * Number of integration range files the groups are split across.
 * @internal @category testing @since 0.0.0
 */
export const CITATION_CANONICAL_REMAINING_EXTRACTION_RANGE_COUNT = 2;

/**
 * Contiguous, disjoint group-index ranges whose concatenation is every group.
 * One integration file replays one range
 * (`test/integration/CitationCanonicalRemainingExtraction*.test.ts`);
 * `test/CitationCanonicalExtractionRanges.test.ts` guards the union and the
 * file census, so a group is never dropped when a range file is added.
 * @internal @category testing @since 0.0.0
 */
export const citationCanonicalRemainingExtractionGroupRanges = A.chunksOf(
  A.range(0, CITATION_CANONICAL_REMAINING_EXTRACTION_GROUP_COUNT - 1),
  Math.ceil(CITATION_CANONICAL_REMAINING_EXTRACTION_GROUP_COUNT / CITATION_CANONICAL_REMAINING_EXTRACTION_RANGE_COUNT)
);

/**
 * One group range by zero-based index; throws when no such range exists so a
 * stale range file fails at collection instead of replaying nothing.
 * @internal @category testing @since 0.0.0
 */
export const citationCanonicalRemainingExtractionGroupRange = (index: number) =>
  O.getOrThrowWith(
    A.get(citationCanonicalRemainingExtractionGroupRanges, index),
    () =>
      new Error(
        `CitationCanonicalRemainingExtraction group range ${index} does not exist; the table has ${A.length(citationCanonicalRemainingExtractionGroupRanges)} ranges.`
      )
  );

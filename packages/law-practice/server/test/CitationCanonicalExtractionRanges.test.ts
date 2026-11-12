import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";
import {
  CITATION_CANONICAL_EXTRACTION_RANGE_COUNT,
  citationCanonicalExtractionShardRanges,
  citationCanonicalExtractionShards,
} from "./CitationCanonicalExtraction.fixtures.ts";
import {
  CITATION_CANONICAL_PARSER_OPERATION_GROUP_COUNT,
  CITATION_CANONICAL_PARSER_OPERATION_RANGE_COUNT,
  citationCanonicalParserOperationGroupRanges,
} from "./CitationCanonicalParserOperations.fixtures.ts";
import {
  CITATION_CANONICAL_REMAINING_EXTRACTION_GROUP_COUNT,
  CITATION_CANONICAL_REMAINING_EXTRACTION_RANGE_COUNT,
  citationCanonicalRemainingExtractionGroupRanges,
} from "./CitationCanonicalRemainingExtraction.fixtures.ts";

// The integration replays of the canonical corpora are split into range files
// so no single file exceeds a hosted partition's budget. This guard keeps each
// split total: the ranges are disjoint, their union is the whole table, and
// exactly one integration file replays each range. Vite inlines the checked-in
// integration sources at transform time (test/support/vite-env.d.ts).
const integrationSources = import.meta.glob<string>("./integration/CitationCanonical*.test.ts", {
  eager: true,
  import: "default",
  query: "?raw",
});
const integrationPrefix = "./integration/";
const rangeReference = /^const RANGE = (\d+);$/gm;

const split = (input: {
  readonly corpus: string;
  readonly filePattern: RegExp;
  readonly rangeCount: number;
  readonly ranges: ReadonlyArray<ReadonlyArray<unknown>>;
  readonly table: ReadonlyArray<unknown>;
  // A runtime twin may replay the whole table instead of one range.
  readonly fullTableReference: O.Option<RegExp>;
}) => ({ ...input, union: A.flatten(input.ranges) });

const splits = [
  split({
    corpus: "canonical extraction",
    filePattern: /^CitationCanonicalExtraction.*\.test\.ts$/,
    rangeCount: CITATION_CANONICAL_EXTRACTION_RANGE_COUNT,
    ranges: citationCanonicalExtractionShardRanges,
    table: citationCanonicalExtractionShards,
    fullTableReference: O.some(/\bcitationCanonicalExtractionShards\b/),
  }),
  split({
    corpus: "parser operation",
    filePattern: /^CitationCanonicalParserOperations.*\.test\.ts$/,
    rangeCount: CITATION_CANONICAL_PARSER_OPERATION_RANGE_COUNT,
    ranges: citationCanonicalParserOperationGroupRanges,
    table: A.range(0, CITATION_CANONICAL_PARSER_OPERATION_GROUP_COUNT - 1),
    fullTableReference: O.none(),
  }),
  split({
    corpus: "remaining extraction",
    filePattern: /^CitationCanonicalRemainingExtraction.*\.test\.ts$/,
    rangeCount: CITATION_CANONICAL_REMAINING_EXTRACTION_RANGE_COUNT,
    ranges: citationCanonicalRemainingExtractionGroupRanges,
    table: A.range(0, CITATION_CANONICAL_REMAINING_EXTRACTION_GROUP_COUNT - 1),
    fullTableReference: O.none(),
  }),
];

for (const corpus of splits) {
  it(`splits the ${corpus.corpus} table into contiguous, disjoint ranges whose union is the table`, () => {
    expect(A.length(corpus.ranges)).toBe(corpus.rangeCount);
    for (const range of corpus.ranges) {
      expect(A.isReadonlyArrayNonEmpty(range)).toBe(true);
    }
    // The same entries in table order: nothing duplicated, nothing dropped.
    expect(A.length(corpus.union)).toBe(A.length(corpus.table));
    expect(A.every(A.zip(corpus.union, corpus.table), ([ranged, original]) => ranged === original)).toBe(true);
  });
}

for (const corpus of splits) {
  it(`replays every ${corpus.corpus} range in exactly one integration file`, () => {
    const references = pipe(
      R.toEntries(integrationSources),
      A.map(([key, source]) => ({ file: Str.slice(Str.length(integrationPrefix))(key), source })),
      A.filter(({ file }) => corpus.filePattern.test(file)),
      A.sort(Order.mapInput(Str.Order, ({ file }: { readonly file: string }) => file)),
      A.map(({ file, source }) => ({
        file,
        ranges: A.map(A.fromIterable(Str.matchAll(rangeReference)(source)), (match) => Number(match[1])),
        fullTable: O.exists(corpus.fullTableReference, (reference) => reference.test(source)),
      }))
    );
    // A file replays one range, or (a runtime twin) the whole table; never both, never neither.
    for (const reference of references) {
      expect(A.length(reference.ranges) + (reference.fullTable ? 1 : 0), reference.file).toBe(1);
    }
    expect(
      A.sort(
        A.flatMap(references, (reference) => reference.ranges),
        Order.Number
      )
    ).toEqual(A.range(0, corpus.rangeCount - 1));
  });
}

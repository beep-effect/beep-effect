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

// decision: citation-integration-replay-files
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
  readonly runtimeTwinFullTableReference: O.Option<RegExp>;
}) => ({ ...input, union: A.flatten(input.ranges) });

const splits = [
  split({
    corpus: "canonical extraction",
    filePattern: /^CitationCanonicalExtraction.*\.test\.ts$/,
    rangeCount: CITATION_CANONICAL_EXTRACTION_RANGE_COUNT,
    ranges: citationCanonicalExtractionShardRanges,
    table: citationCanonicalExtractionShards,
    runtimeTwinFullTableReference: O.some(/\bcitationCanonicalExtractionShards\b/),
  }),
  split({
    corpus: "parser operation",
    filePattern: /^CitationCanonicalParserOperations.*\.test\.ts$/,
    rangeCount: CITATION_CANONICAL_PARSER_OPERATION_RANGE_COUNT,
    ranges: citationCanonicalParserOperationGroupRanges,
    table: A.range(0, CITATION_CANONICAL_PARSER_OPERATION_GROUP_COUNT - 1),
    runtimeTwinFullTableReference: O.none(),
  }),
  split({
    corpus: "remaining extraction",
    filePattern: /^CitationCanonicalRemainingExtraction.*\.test\.ts$/,
    rangeCount: CITATION_CANONICAL_REMAINING_EXTRACTION_RANGE_COUNT,
    ranges: citationCanonicalRemainingExtractionGroupRanges,
    table: A.range(0, CITATION_CANONICAL_REMAINING_EXTRACTION_GROUP_COUNT - 1),
    runtimeTwinFullTableReference: O.none(),
  }),
];

for (const corpus of splits) {
  it(`splits the ${corpus.corpus} table into contiguous, disjoint ranges whose union is the table`, () => {
    expect(A.length(corpus.ranges)).toBe(corpus.rangeCount);
    for (const range of corpus.ranges) {
      expect(A.isReadonlyArrayNonEmpty(range)).toBe(true);
    }
    expect(A.length(corpus.union)).toBe(A.length(corpus.table));
    expect(
      A.every(A.zip(corpus.union, corpus.table), ([ranged, original]) => ranged === original),
      "the same entries in table order: nothing duplicated, nothing dropped"
    ).toBe(true);
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
        fullTable: O.exists(corpus.runtimeTwinFullTableReference, (reference) => reference.test(source)),
      }))
    );
    for (const reference of references) {
      expect(
        A.length(reference.ranges) + (reference.fullTable ? 1 : 0),
        `${reference.file} replays one range, or as a runtime twin the whole table; never both, never neither`
      ).toBe(1);
    }
    expect(
      A.sort(
        A.flatMap(references, (reference) => reference.ranges),
        Order.Number
      )
    ).toEqual(A.range(0, corpus.rangeCount - 1));
  });
}

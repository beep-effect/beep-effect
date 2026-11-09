import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import {
  CITATION_CANONICAL_EXTRACTION_RANGE_COUNT,
  citationCanonicalExtractionShardRanges,
  citationCanonicalExtractionShards,
} from "./CitationCanonicalExtraction.fixtures.ts";

// The integration replay of the canonical corpus is split into range files so
// no single file exceeds a hosted partition's budget. This guard keeps the
// split total: the ranges are disjoint, their union is the whole shard table,
// and exactly one integration file replays each range.
const integrationDirectory = new URL("./integration/", import.meta.url);
const rangeFilePattern = /^CitationCanonicalExtraction.*\.test\.ts$/;
const rangeReference = /citationCanonicalExtractionShardRange\((\d+)\)/g;
const fullTableReference = /\bcitationCanonicalExtractionShards\b/;

it("splits the canonical shard table into contiguous, disjoint ranges whose union is the table", () => {
  expect(A.length(citationCanonicalExtractionShardRanges)).toBe(CITATION_CANONICAL_EXTRACTION_RANGE_COUNT);
  for (const range of citationCanonicalExtractionShardRanges) {
    expect(A.isReadonlyArrayNonEmpty(range)).toBe(true);
  }
  const union = A.flatten(citationCanonicalExtractionShardRanges);
  expect(A.map(union, (shard) => shard.title)).toEqual(
    A.map(citationCanonicalExtractionShards, (shard) => shard.title)
  );
  // The same shard objects in table order: nothing duplicated, nothing dropped.
  expect(A.every(A.zip(union, citationCanonicalExtractionShards), ([ranged, original]) => ranged === original)).toBe(
    true
  );
});

it.layer(NodeServices.layer)("canonical extraction range files", (it) => {
  it.effect("replays every range in exactly one integration file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* path.fromFileUrl(integrationDirectory);
      const entries = yield* fs.readDirectory(directory);
      const files = A.sort(
        A.filter(entries, (entry) => rangeFilePattern.test(entry)),
        Str.Order
      );
      const references = yield* Effect.forEach(files, (file) =>
        Effect.map(fs.readFileString(path.join(directory, file)), (source) => ({
          file,
          ranges: A.map(A.fromIterable(Str.matchAll(rangeReference)(source)), (match) => Number(match[1])),
          fullTable: fullTableReference.test(source),
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
      ).toEqual(A.range(0, CITATION_CANONICAL_EXTRACTION_RANGE_COUNT - 1));
    })
  );
});

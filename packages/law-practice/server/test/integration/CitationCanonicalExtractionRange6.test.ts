import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import {
  CITATION_CANONICAL_EXTRACTION_RANGE_COUNT,
  citationCanonicalExtractionShardRange,
} from "../CitationCanonicalExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun runtime only. The canonical shard table is split into contiguous ranges,
// one integration file per range, so no file exceeds a hosted integration
// partition's budget (goals/citation-extraction-engine, 2026-11-09). Every row
// still replays with full=true; test/CitationCanonicalExtractionRanges.test.ts
// asserts the ranges are disjoint and their union is the whole table.
const RANGE = 5;

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  `canonical builtin extraction inputs, range ${RANGE + 1} of ${CITATION_CANONICAL_EXTRACTION_RANGE_COUNT}`,
  (it) => {
    for (const shard of citationCanonicalExtractionShardRange(RANGE)) {
      it.effect(`${shard.title} on bun`, () => shard.replay("bun"), { timeout: 600000 });
    }
  }
);

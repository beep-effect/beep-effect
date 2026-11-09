import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { citationCanonicalExtractionShardRange } from "../CitationCanonicalExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun runtime only. The canonical shard table is split into contiguous ranges,
// one integration file per range, so no file exceeds a hosted integration
// partition's budget (goals/citation-extraction-engine, 2026-11-09). Every row
// still replays with full=true; test/CitationCanonicalExtractionRanges.test.ts
// asserts the ranges are disjoint and their union is the whole table.
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "canonical builtin extraction inputs, range 3 of 3",
  (it) => {
    for (const shard of citationCanonicalExtractionShardRange(2)) {
      it.effect(`${shard.title} on bun`, () => shard.replay("bun"), { timeout: 600000 });
    }
  }
);

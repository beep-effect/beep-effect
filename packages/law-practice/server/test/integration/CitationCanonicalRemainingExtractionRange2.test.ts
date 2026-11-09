import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import {
  CITATION_CANONICAL_REMAINING_EXTRACTION_GROUP_SIZE,
  CITATION_CANONICAL_REMAINING_EXTRACTION_RANGE_COUNT,
  citationCanonicalRemainingExtractionGroupRange,
  replayCitationCanonicalRemainingExtraction,
} from "../CitationCanonicalRemainingExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun only since 2026-11-09 (deletion addendum G7); integration/CitationEngineCorpus.test.ts and
// integration/CitationCanonicalTokenizer.test.ts carry the node coverage of the engine. The replay
// groups are split into contiguous ranges, one integration file per range, so no file exceeds a
// hosted integration partition's budget (goals/citation-extraction-engine, 2026-11-09);
// test/CitationCanonicalExtractionRanges.test.ts asserts the ranges are disjoint and their union
// is every group.
const RANGE = 1;

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  `all remaining original extraction calls, range ${RANGE + 1} of ${CITATION_CANONICAL_REMAINING_EXTRACTION_RANGE_COUNT}`,
  (it) => {
    for (const shard of citationCanonicalRemainingExtractionGroupRange(RANGE)) {
      it.effect(
        `replays remaining original extraction group ${shard} on bun`,
        () =>
          replayCitationCanonicalRemainingExtraction("bun", shard, CITATION_CANONICAL_REMAINING_EXTRACTION_GROUP_SIZE),
        { timeout: 600000 }
      );
    }
  }
);

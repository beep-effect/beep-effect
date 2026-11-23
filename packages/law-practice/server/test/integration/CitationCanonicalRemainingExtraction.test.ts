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

// decision: citation-integration-replay-files
const RANGE = 0;

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

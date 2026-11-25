import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import {
  CITATION_CANONICAL_EXTRACTION_RANGE_COUNT,
  citationCanonicalExtractionShardRange,
} from "../CitationCanonicalExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// decision: citation-integration-replay-files
const RANGE = 3;

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  `canonical builtin extraction inputs, range ${RANGE + 1} of ${CITATION_CANONICAL_EXTRACTION_RANGE_COUNT}`,
  (it) => {
    for (const shard of citationCanonicalExtractionShardRange(RANGE)) {
      it.effect(`${shard.title} on bun`, () => shard.replay("bun"), { timeout: 600000 });
    }
  }
);

import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import {
  CITATION_CANONICAL_PARSER_OPERATION_GROUP_SIZE,
  CITATION_CANONICAL_PARSER_OPERATION_RANGE_COUNT,
  citationCanonicalParserOperationGroupRange,
  replayCitationCanonicalParserOperations,
} from "../CitationCanonicalParserOperations.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun only since 2026-11-09 (deletion addendum G7); integration/CitationEngineCorpus.test.ts and
// integration/CitationCanonicalTokenizer.test.ts carry the node coverage of the engine. The replay
// groups are split into contiguous ranges, one integration file per range, so no file exceeds a
// hosted integration partition's budget (goals/citation-extraction-engine, 2026-11-09);
// test/CitationCanonicalExtractionRanges.test.ts asserts the ranges are disjoint and their union
// is every group.
const RANGE = 1;

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  `all original resolver parser fragments, range ${RANGE + 1} of ${CITATION_CANONICAL_PARSER_OPERATION_RANGE_COUNT}`,
  (it) => {
    for (const shard of citationCanonicalParserOperationGroupRange(RANGE)) {
      it.effect(
        `replays original parser fragment group ${shard} on bun`,
        () => replayCitationCanonicalParserOperations("bun", shard, CITATION_CANONICAL_PARSER_OPERATION_GROUP_SIZE),
        { timeout: 600000 }
      );
    }
  }
);

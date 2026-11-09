import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { citationCanonicalExtractionShards } from "../CitationCanonicalExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun runtime only. The node replay of these shards (CitationCanonicalExtractionNode.test.ts) was
// deleted on 2026-11-09 (deletion addendum G1); integration/CitationEngineCorpus.test.ts is the node
// full-corpus scene.
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "all canonical builtin extraction inputs",
  (it) => {
    for (const shard of citationCanonicalExtractionShards) {
      it.effect(`${shard.title} on bun`, () => shard.replay("bun"), { timeout: 600000 });
    }
  }
);

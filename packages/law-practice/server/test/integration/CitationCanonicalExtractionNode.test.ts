import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { citationCanonicalExtractionShards } from "../CitationCanonicalExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Node runtime only; CitationCanonicalExtraction.test.ts replays the same
// shards on bun so the two files run on separate vitest workers.
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "all canonical builtin extraction inputs",
  (it) => {
    for (const shard of citationCanonicalExtractionShards) {
      it.effect(`${shard.title} on node`, () => shard.replay("node"), { timeout: 600000 });
    }
  }
);

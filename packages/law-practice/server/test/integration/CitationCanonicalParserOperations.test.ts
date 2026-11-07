import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalParserOperations } from "../CitationCanonicalParserOperations.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "all original resolver parser fragments",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      for (let shard = 0; shard < 8; shard++) {
        it.effect(
          `replays original parser fragment group ${shard} on ${kind}`,
          () => replayCitationCanonicalParserOperations(kind, shard, 10),
          { timeout: 600000 }
        );
      }
    }
  }
);

import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalRemainingExtraction } from "../CitationCanonicalRemainingExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "all remaining original extraction calls",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      for (let shard = 0; shard < 7; shard++) {
        it.effect(
          `replays remaining original extraction group ${shard} on ${kind}`,
          () => replayCitationCanonicalRemainingExtraction(kind, shard, 10),
          { timeout: 600000 }
        );
      }
    }
  }
);

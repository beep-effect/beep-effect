import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalExtraction } from "../CitationCanonicalExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "all canonical builtin extraction inputs",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      for (let shard = 0; shard < 13; shard++) {
        it.effect(
          `replays original documents ${shard * 10 + 1}-${shard * 10 + 10} on ${kind}`,
          () => replayCitationCanonicalExtraction(kind, shard, 10),
          { timeout: 600000 }
        );
      }
      for (const family of ["law", "journal", "tax"] as const) {
        it.effect(
          `replays every original ${family} input on ${kind}`,
          () => replayCitationCanonicalExtraction(kind, 0, 10, family),
          { timeout: 600000 }
        );
      }
    }
  }
);

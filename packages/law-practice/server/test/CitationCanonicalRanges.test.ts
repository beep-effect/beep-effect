import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalExtraction } from "./CitationCanonicalExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original distinct citation ranges",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      // Original builtin input 11 has primary [20,29], full [4,54], and
      // pin-inclusive [20,38]. The replay reads these from the sealed capture.
      it.effect(
        `retains different primary full and pin-cite ranges on ${kind}`,
        () => replayCitationCanonicalExtraction(kind, 10, 1),
        { timeout: 180000 }
      );
    }
  }
);

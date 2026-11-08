import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalExtraction } from "./CitationCanonicalExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original missing-page citation models",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      for (const index of [26, 27, 117]) {
        it.effect(
          `normalizes original missing-page input ${index} on ${kind}`,
          () => replayCitationCanonicalExtraction(kind, index, 1),
          { timeout: 180000 }
        );
      }
    }
  }
);

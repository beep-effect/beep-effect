import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalFullRendering } from "./CitationCanonicalFullRendering.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "original corrected-full-citation assertions",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `recomputes both original corrected-full-citation equalities on ${kind}`,
        () => replayCitationCanonicalFullRendering(kind),
        { timeout: 180000 }
      );
    }
  }
);

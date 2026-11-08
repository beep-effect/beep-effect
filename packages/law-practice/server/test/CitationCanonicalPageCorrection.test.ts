import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalPageCorrection } from "./CitationCanonicalPageCorrection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original parsed page correction",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `recomputes all twelve original page-correction equalities on ${kind}`,
        () => replayCitationCanonicalPageCorrection(kind),
        { timeout: 180000 }
      );
    }
  }
);

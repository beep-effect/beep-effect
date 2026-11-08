import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalMissingConversion } from "./CitationCanonicalMissingConversion.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original missing-page conversion assertions",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `recomputes both original missing-page conversion assertions on ${kind}`,
        () => replayCitationCanonicalMissingConversion(kind),
        { timeout: 180000 }
      );
    }
  }
);

import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalFullSpan } from "./CitationCanonicalFullSpan.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "original full-span assertions",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `recomputes all thirteen original full-span equalities on ${kind}`,
        () => replayCitationCanonicalFullSpan(kind),
        {
          timeout: 180000,
        }
      );
    }
  }
);

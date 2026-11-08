import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalPinSpan } from "./CitationCanonicalPinSpan.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "original pin-cite-span assertions",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `recomputes all nine original pin-cite-span equalities on ${kind}`,
        () => replayCitationCanonicalPinSpan(kind),
        {
          timeout: 180000,
        }
      );
    }
  }
);

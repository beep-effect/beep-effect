import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalExtraction } from "./CitationCanonicalExtraction.fixtures.ts";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original distinct citation ranges",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `retains builtin input 11 primary [20,29], full [4,54], pin-inclusive [20,38] ranges from the sealed capture on ${kind}`,
        () => withCitationTestInvocation(replayCitationCanonicalExtraction(kind, 10, 1)),
        { timeout: 180000 }
      );
    }
  }
);

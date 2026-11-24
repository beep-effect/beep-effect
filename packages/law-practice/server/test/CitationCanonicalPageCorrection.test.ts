import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import {
  citationCanonicalPageCorrectionCalls,
  replayCitationCanonicalPageCorrection,
} from "./CitationCanonicalPageCorrection.fixtures.ts";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original parsed page correction",
  (it) => {
    it.effect(
      "recomputes all twelve original page-correction equalities on bun",
      () =>
        withCitationTestInvocation(
          replayCitationCanonicalPageCorrection("bun", 0, citationCanonicalPageCorrectionCalls)
        ),
      { timeout: 180000 }
    );
    it.effect(
      "recomputes the first original page-correction call on node, the one node parity scene of this family",
      () => withCitationTestInvocation(replayCitationCanonicalPageCorrection("node", 0, 1)),
      { timeout: 180000 }
    );
  }
);

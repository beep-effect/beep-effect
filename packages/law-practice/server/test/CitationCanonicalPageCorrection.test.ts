import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import {
  citationCanonicalPageCorrectionCalls,
  replayCitationCanonicalPageCorrection,
} from "./CitationCanonicalPageCorrection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

// Bun replays the whole cohort; node replays the first call so the node parity
// scene stays while the full family runs once (deletion addendum U2, 2026-11-09).
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original parsed page correction",
  (it) => {
    it.effect(
      "recomputes all twelve original page-correction equalities on bun",
      () => replayCitationCanonicalPageCorrection("bun", 0, citationCanonicalPageCorrectionCalls),
      { timeout: 180000 }
    );
    it.effect(
      "recomputes the first original page-correction call on node",
      () => replayCitationCanonicalPageCorrection("node", 0, 1),
      { timeout: 180000 }
    );
  }
);

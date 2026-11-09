import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import {
  citationCanonicalFullSpanCalls,
  replayCitationCanonicalFullSpan,
} from "./CitationCanonicalFullSpan.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

// Bun replays the whole cohort; node replays the first call so the node parity
// scene stays while the full family runs once (deletion addendum U2, 2026-11-09).
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original full-span assertions",
  (it) => {
    it.effect(
      "recomputes all thirteen original full-span equalities on bun",
      () => replayCitationCanonicalFullSpan("bun", 0, citationCanonicalFullSpanCalls),
      { timeout: 180000 }
    );
    it.effect(
      "recomputes the first original full-span call on node",
      () => replayCitationCanonicalFullSpan("node", 0, 1),
      { timeout: 180000 }
    );
  }
);

import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { citationCanonicalPinSpanCalls, replayCitationCanonicalPinSpan } from "./CitationCanonicalPinSpan.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

// Bun replays the whole cohort; node replays the first call so the node parity
// scene stays while the full family runs once (deletion addendum U2, 2026-11-09).
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original pin-cite-span assertions",
  (it) => {
    it.effect(
      "recomputes all nine original pin-cite-span equalities on bun",
      () => replayCitationCanonicalPinSpan("bun", 0, citationCanonicalPinSpanCalls),
      { timeout: 180000 }
    );
    it.effect(
      "recomputes the first original pin-cite-span call on node",
      () => replayCitationCanonicalPinSpan("node", 0, 1),
      { timeout: 180000 }
    );
  }
);

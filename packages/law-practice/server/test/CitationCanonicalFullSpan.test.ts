import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  CitationCanonicalFullSpanReplay,
  checkCitationCanonicalFullSpanConstruction,
  citationCanonicalFullSpanCalls,
  citationCanonicalFullSpanReplayLayer,
  prepareCitationCanonicalFullSpanReplay,
  replayCitationCanonicalFullSpanCall,
} from "./CitationCanonicalFullSpan.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

// Bun replays the whole cohort; node replays the first call so the node parity
// scene stays while the full family runs once (deletion addendum U2, 2026-11-09).
// Each original call is its own test over one shared Bun installation: a call is a
// full production extraction, so ten of them under one watchdog sat near its limit
// on contended runners (ep66, ep81).
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original full-span assertions",
  (it) => {
    it.layer(citationCanonicalFullSpanReplayLayer("bun"), { concurrent: false, timeout: "120 seconds" })(
      "recomputes all thirteen original full-span equalities on bun",
      (it) => {
        it.effect("installs the stage tree once at engine construction", () =>
          CitationCanonicalFullSpanReplay.use(checkCitationCanonicalFullSpanConstruction)
        );
        for (const index of A.range(0, citationCanonicalFullSpanCalls - 1)) {
          it.effect(
            `recomputes original call ${index + 1} of ${citationCanonicalFullSpanCalls}`,
            () =>
              CitationCanonicalFullSpanReplay.use((prepared) => replayCitationCanonicalFullSpanCall(prepared, index)),
            { timeout: 180000 }
          );
        }
      }
    );
    it.effect(
      "recomputes the first original full-span call on node",
      () =>
        prepareCitationCanonicalFullSpanReplay("node").pipe(
          Effect.flatMap((prepared) => replayCitationCanonicalFullSpanCall(prepared, 0))
        ),
      { timeout: 180000 }
    );
  }
);

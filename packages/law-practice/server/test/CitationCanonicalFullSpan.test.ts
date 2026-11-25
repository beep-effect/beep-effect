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

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original full-span assertions",
  (it) => {
    it.layer(citationCanonicalFullSpanReplayLayer("bun"), { concurrent: false, timeout: "120 seconds" })(
      "recomputes all thirteen original full-span equalities on bun, one test per call so each full extraction gets its own watchdog",
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
      "recomputes the first original full-span call on node, the one node parity scene of this family",
      () =>
        prepareCitationCanonicalFullSpanReplay("node").pipe(
          Effect.flatMap((prepared) => replayCitationCanonicalFullSpanCall(prepared, 0))
        ),
      { timeout: 180000 }
    );
  }
);

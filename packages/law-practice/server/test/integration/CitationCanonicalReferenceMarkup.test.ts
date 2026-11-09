import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalReferenceMarkup } from "../CitationCanonicalReferenceMarkup.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun only since 2026-11-09 (deletion addendum G7): node parity for this corpus is the unit twin's smoke
// loop plus integration/CitationEngineCorpus.test.ts, the one node full-corpus scene.
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "all original HTML reference criteria",
  (it) => {
    for (const kind of ["bun"] as const) {
      for (const family of ["references", "filtering"] as const) {
        it.effect(
          `replays every original ${family} assertion on ${kind}`,
          () => replayCitationCanonicalReferenceMarkup(kind, family),
          { timeout: 600000 }
        );
      }
    }
  }
);

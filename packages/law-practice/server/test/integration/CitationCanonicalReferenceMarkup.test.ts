import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalReferenceMarkup } from "../CitationCanonicalReferenceMarkup.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun only since 2026-11-09 (deletion addendum G7). Node coverage of the engine now comes from
// integration/CitationEngineCorpus.test.ts and integration/CitationCanonicalTokenizer.test.ts (both
// runtimes), the U2 node slices (CitationExtractionLoop, CitationCanonicalFullSpan, PageCorrection,
// PinSpan, ParsedEquality) and the kept worker scenes (CitationDiffWorker, CitationXmlWorker,
// CitationHtmlGeometryPreparation); the unit twins of this corpus run on bun only.
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

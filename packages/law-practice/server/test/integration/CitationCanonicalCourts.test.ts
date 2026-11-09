import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Layer from "effect/Layer";
import { replayCitationCanonicalCourtExtraction } from "../CitationCanonicalParserOperations.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun only since 2026-11-09 (deletion addendum G7). Node coverage of the engine now comes from
// integration/CitationEngineCorpus.test.ts and integration/CitationCanonicalTokenizer.test.ts (both
// runtimes), the U2 node slices (CitationExtractionLoop, CitationCanonicalFullSpan, PageCorrection,
// PinSpan, ParsedEquality) and the kept worker scenes (CitationDiffWorker, CitationXmlWorker,
// CitationHtmlGeometryPreparation); the unit twins of this corpus run on bun only.
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "all original parenthetical court assertions",
  (it) => {
    for (const kind of ["bun"] as const) {
      for (let shard = 0; shard < 3; shard++) {
        it.effect(
          `replays original court assertion group ${shard} on ${kind}`,
          () => replayCitationCanonicalCourtExtraction(kind, shard, 10),
          { timeout: 600000 }
        );
      }
    }
  }
);

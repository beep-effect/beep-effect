import { it } from "@beep/test-runner";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";
import { replayCitationVerifiedExtraction } from "../CitationVerifiedExtraction.fixtures.ts";

// Bun only since 2026-11-09 (deletion addendum G7). Node coverage of the engine now comes from
// integration/CitationEngineCorpus.test.ts and integration/CitationCanonicalTokenizer.test.ts (both
// runtimes), the U2 node slices (CitationExtractionLoop, CitationCanonicalFullSpan, PageCorrection,
// PinSpan, ParsedEquality) and the kept worker scenes (CitationDiffWorker, CitationXmlWorker,
// CitationHtmlGeometryPreparation); the unit twins of this corpus run on bun only.
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete authenticated source extraction",
  (it) => {
    it.effect("replays all 22 retained source documents on Bun", () => replayCitationVerifiedExtraction("bun", true), {
      timeout: 600000,
    });
  }
);

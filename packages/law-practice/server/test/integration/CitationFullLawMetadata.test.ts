import { it } from "@beep/test-runner";
import { replayCitationFullLawMetadata } from "../CitationFullLawMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun only since 2026-11-09 (deletion addendum G7). Node coverage of the engine now comes from
// integration/CitationEngineCorpus.test.ts and integration/CitationCanonicalTokenizer.test.ts (both
// runtimes), the U2 node slices (CitationExtractionLoop, CitationCanonicalFullSpan, PageCorrection,
// PinSpan, ParsedEquality) and the kept worker scenes (CitationDiffWorker, CitationXmlWorker,
// CitationHtmlGeometryPreparation); the unit twins of this corpus run on bun only.
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source full-law metadata", (it) => {
  for (const kind of ["bun"] as const) {
    it.effect(
      `replays all 768 full-method observations through ${kind}`,
      () => replayCitationFullLawMetadata(kind, true),
      { timeout: 1200000 }
    );
  }
});

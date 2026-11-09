import { it } from "@beep/test-runner";
import { replayCitationRegexCaseFlags } from "../CitationRegexCaseFlags.fixtures.ts";
import { citationRegexReplayBatches } from "../CitationRegexVerbose.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun only since 2026-11-09 (deletion addendum G7). Node coverage of the engine now comes from
// integration/CitationEngineCorpus.test.ts and integration/CitationCanonicalTokenizer.test.ts (both
// runtimes), the U2 node slices (CitationExtractionLoop, CitationCanonicalFullSpan, PageCorrection,
// PinSpan, ParsedEquality) and the kept worker scenes (CitationDiffWorker, CitationXmlWorker,
// CitationHtmlGeometryPreparation); the unit twins of this corpus run on bun only.
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source regex case flags", (it) => {
  for (const kind of ["bun"] as const)
    for (const batch of citationRegexReplayBatches)
      it.effect(
        `replays all original case-flag captures through ${kind}, batch ${batch + 1}/16`,
        () => replayCitationRegexCaseFlags(kind, true, batch),
        { timeout: 600000 }
      );
});

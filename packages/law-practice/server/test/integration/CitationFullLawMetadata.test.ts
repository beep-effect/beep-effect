import { it } from "@beep/test-runner";
import { replayCitationFullLawMetadata } from "../CitationFullLawMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun only since 2026-11-09 (deletion addendum G7): node parity for this corpus is the unit twin's smoke
// loop plus integration/CitationEngineCorpus.test.ts, the one node full-corpus scene.
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source full-law metadata", (it) => {
  for (const kind of ["bun"] as const) {
    it.effect(
      `replays all 768 full-method observations through ${kind}`,
      () => replayCitationFullLawMetadata(kind, true),
      { timeout: 1200000 }
    );
  }
});

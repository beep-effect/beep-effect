import { it } from "@beep/test-runner";
import { replayCitationJournalMetadata } from "../CitationJournalMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// Bun only since 2026-11-09 (deletion addendum G7): node parity for this corpus is the unit twin's smoke
// loop plus integration/CitationEngineCorpus.test.ts, the one node full-corpus scene.
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source journal metadata", (it) => {
  for (const kind of ["bun"] as const) {
    it.effect(
      `replays all full journal source observations through ${kind}`,
      () => replayCitationJournalMetadata(kind, true),
      { timeout: 1200000 }
    );
  }
});

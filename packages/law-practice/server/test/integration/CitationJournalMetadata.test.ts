import { it } from "@beep/test-runner";
import { replayCitationJournalMetadata } from "../CitationJournalMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// decision: citation-integration-replay-files
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source journal metadata", (it) => {
  for (const kind of ["bun"] as const) {
    it.effect(
      `replays all full journal source observations through ${kind}`,
      () => replayCitationJournalMetadata(kind, true),
      { timeout: 1200000 }
    );
  }
});

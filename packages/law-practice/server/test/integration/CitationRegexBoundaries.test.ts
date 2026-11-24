import { it } from "@beep/test-runner";
import { replayCitationRegexBoundaries } from "../CitationRegexBoundaries.fixtures.ts";
import { citationRegexReplayBatches } from "../CitationRegexVerbose.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

// decision: citation-integration-replay-files
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source regex word boundaries", (it) => {
  for (const kind of ["bun"] as const)
    for (const batch of citationRegexReplayBatches)
      it.effect(
        `replays all original boundary captures through ${kind}, batch ${batch + 1}/16`,
        () => replayCitationRegexBoundaries(kind, true, batch),
        { timeout: 600000 }
      );
});

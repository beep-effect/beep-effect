import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationRegexCaseFlags } from "../CitationRegexCaseFlags.fixtures.ts";
import { citationRegexReplayBatches } from "../CitationRegexVerbose.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source regex case flags", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals)
    for (const batch of citationRegexReplayBatches)
      it.effect(
        `replays all original case-flag captures through ${kind}, batch ${batch + 1}/16`,
        () => replayCitationRegexCaseFlags(kind, true, batch),
        { timeout: 600000 }
      );
});

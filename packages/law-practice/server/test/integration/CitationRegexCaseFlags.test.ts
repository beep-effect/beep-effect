import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationRegexCaseFlags } from "../CitationRegexCaseFlags.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source regex case flags", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(
      `replays all original case-flag captures through ${kind}`,
      () => replayCitationRegexCaseFlags(kind, true),
      { timeout: 600000 }
    );
});

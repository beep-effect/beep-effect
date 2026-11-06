import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationRegexBoundaries } from "../CitationRegexBoundaries.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source regex word boundaries", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(
      `replays all original boundary captures through ${kind}`,
      () => replayCitationRegexBoundaries(kind, true),
      { timeout: 600000 }
    );
});

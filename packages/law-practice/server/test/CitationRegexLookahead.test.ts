import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { assertCitationLookaheadProfiles, replayCitationRegexLookahead } from "./CitationRegexLookahead.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source positive lookahead", (it) => {
  it.effect("preserves independent source capture and width profiles", assertCitationLookaheadProfiles);
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches source assertions and journal captures through ${kind}`,
      () => replayCitationRegexLookahead(kind, false),
      { timeout: 120000 }
    );
  }
});

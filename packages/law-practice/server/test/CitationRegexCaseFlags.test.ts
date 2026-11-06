import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { assertCitationCaseFlagProfiles, replayCitationRegexCaseFlags } from "./CitationRegexCaseFlags.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source regex case flags", (it) => {
  it.effect("matches every original grammar/profile outcome", assertCitationCaseFlagProfiles);
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`preserves source case-flag captures through ${kind}`, () => replayCitationRegexCaseFlags(kind, false), {
      timeout: 120000,
    });
});

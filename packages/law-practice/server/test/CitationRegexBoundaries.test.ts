import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { assertCitationBoundaryProfiles, replayCitationRegexBoundaries } from "./CitationRegexBoundaries.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source regex word boundaries", (it) => {
  it.effect("matches every original grammar/profile outcome", assertCitationBoundaryProfiles);
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`preserves source boundary captures through ${kind}`, () => replayCitationRegexBoundaries(kind, false), {
      timeout: 120000,
    });
});

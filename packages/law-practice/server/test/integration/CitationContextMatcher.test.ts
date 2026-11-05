import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationContextMatches } from "../CitationContextMatcher.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source context matching", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `replays every original helper observation through ${kind}`,
      () => replayCitationContextMatches(kind, true),
      { timeout: 600000 }
    );
  }
});

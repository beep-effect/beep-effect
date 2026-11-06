import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationRegexLookahead } from "../CitationRegexLookahead.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source positive lookahead", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `replays original assertion and journal observations through ${kind}`,
      () => replayCitationRegexLookahead(kind, true),
      { timeout: 600000 }
    );
  }
});

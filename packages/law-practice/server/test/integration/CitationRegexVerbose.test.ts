import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationRegexVerbose } from "../CitationRegexVerbose.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source verbose matching", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches every admitted source verbose case through actual ${kind} children`,
      () => replayCitationRegexVerbose(kind, true),
      { timeout: 600000 }
    );
  }
});

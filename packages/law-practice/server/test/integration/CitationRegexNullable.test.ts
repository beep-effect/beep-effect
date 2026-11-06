import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationRegexNullable } from "../CitationRegexNullable.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete nullable single native regex", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches every nullable source control under actual ${kind}`,
      () => replayCitationRegexNullable(kind, true),
      { timeout: 180000 }
    );
  }
});

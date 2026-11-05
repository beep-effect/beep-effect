import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationRegexNullable } from "./CitationRegexNullable.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("nullable single native regex", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches nullable empty/nonempty captures and quotas under actual ${kind}`,
      () => replayCitationRegexNullable(kind, false),
      { timeout: 60000 }
    );
  }
});

import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationMetadataStrings } from "../CitationMetadataStrings.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete native metadata strings", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(`matches every original helper result through ${kind}`, () => replayCitationMetadataStrings(kind, true), {
      timeout: 1200000,
    });
  }
});

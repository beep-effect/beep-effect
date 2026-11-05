import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationLawMetadata } from "../CitationLawMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source law metadata", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(`matches every original helper mutation through ${kind}`, () => replayCitationLawMetadata(kind, true), {
      timeout: 600000,
    });
  }
});

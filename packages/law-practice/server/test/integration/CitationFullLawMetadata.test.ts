import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationFullLawMetadata } from "../CitationFullLawMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source full-law metadata", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `replays all 768 full-method observations through ${kind}`,
      () => replayCitationFullLawMetadata(kind, true),
      { timeout: 1200000 }
    );
  }
});

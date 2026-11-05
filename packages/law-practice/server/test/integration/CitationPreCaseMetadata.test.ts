import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationPreCaseMetadata } from "../CitationPreCaseMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source pre-case metadata", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(
      `replays all original backward metadata through ${kind}`,
      () => replayCitationPreCaseMetadata(kind, true),
      { timeout: 600000 }
    );
});

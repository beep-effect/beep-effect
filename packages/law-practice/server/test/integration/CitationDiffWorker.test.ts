import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationDiffWorker } from "../CitationDiffWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete original default-diff corpus", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(
      `compares all 1005 source maps through ${kind} with independent exit acknowledgement`,
      () => replayCitationDiffWorker(kind, true),
      { timeout: 600000 }
    );
});

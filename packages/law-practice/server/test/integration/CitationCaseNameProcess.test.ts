import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationCaseNameProcess } from "../CitationCaseNameProcess.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete source candidate-name processing",
  (it) => {
    for (const kind of CitationNativeRuntimeKind.literals)
      it.effect(
        `replays all original assignment snapshots through ${kind}`,
        () => replayCitationCaseNameProcess(kind, true),
        { timeout: 900000 }
      );
  }
);

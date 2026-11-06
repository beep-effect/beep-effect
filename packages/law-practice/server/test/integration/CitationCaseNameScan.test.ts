import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationCaseNameScan } from "../CitationCaseNameScan.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete initialized source case-name scan",
  (it) => {
    for (const kind of CitationNativeRuntimeKind.literals)
      it.effect(`replays every original scan state through ${kind}`, () => replayCitationCaseNameScan(kind, true), {
        timeout: 600000,
      });
  }
);

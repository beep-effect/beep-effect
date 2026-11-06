import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationPinExtraction } from "../CitationPinExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source pin extraction", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`replays all source pin tuples through ${kind}`, () => replayCitationPinExtraction(kind, true), {
      timeout: 600000,
    });
});

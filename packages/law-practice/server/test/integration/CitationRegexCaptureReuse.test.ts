import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationCaptureReuse } from "../CitationRegexCaptureReuse.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source capture reuse", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(
      `replays all logical capture observations through ${kind}`,
      () => replayCitationCaptureReuse(kind, true),
      { timeout: 600000 }
    );
});

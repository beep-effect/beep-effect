import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationPostCaseMetadata } from "../CitationPostCaseMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source post-case metadata", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(
      `replays every original post-case field through ${kind}`,
      () => replayCitationPostCaseMetadata(kind, true),
      { timeout: 600000 }
    );
});

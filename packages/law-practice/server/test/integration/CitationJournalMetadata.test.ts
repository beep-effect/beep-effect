import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationJournalMetadata } from "../CitationJournalMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete source journal metadata", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `replays all full journal source observations through ${kind}`,
      () => replayCitationJournalMetadata(kind, true),
      { timeout: 1200000 }
    );
  }
});

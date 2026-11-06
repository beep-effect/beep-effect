import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import {
  assertCitationJournalMetadataBudget,
  assertCitationJournalMetadataLifetime,
  replayCitationJournalMetadata,
} from "./CitationJournalMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source full journal metadata", (it) => {
  it.effect("preserves exact invocation budget and fresh repeated calls", assertCitationJournalMetadataBudget, {
    timeout: 120000,
  });
  it.effect("rejects closed lifetime and owns its deadline", assertCitationJournalMetadataLifetime, {
    timeout: 120000,
  });
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches source journal changes and selection through ${kind}`,
      () => replayCitationJournalMetadata(kind, false),
      { timeout: 120000 }
    );
  }
});

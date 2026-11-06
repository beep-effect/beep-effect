import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import {
  assertCitationLawMetadataBudget,
  assertCitationLawMetadataLifetime,
  replayCitationLawMetadata,
} from "./CitationLawMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source law metadata composition", (it) => {
  it.effect("refuses partial patches, retains budgets and owns configuration", assertCitationLawMetadataBudget, {
    timeout: 120000,
  });
  it.effect("closes lifetime and captured deadline failures without metadata", assertCitationLawMetadataLifetime, {
    timeout: 120000,
  });
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches source field updates and span changes through ${kind}`,
      () => replayCitationLawMetadata(kind, false),
      { timeout: 120000 }
    );
  }
});

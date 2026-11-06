import { it } from "@beep/test-runner";
import { assertCitationCaseMetadataBudget, replayCitationCaseMetadata } from "./CitationCaseMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original full-case metadata composition", (it) => {
  it.effect("retains one budget through final court production", assertCitationCaseMetadataBudget, { timeout: 180000 });
  it.effect("preserves final model state and metadata order on Bun", () => replayCitationCaseMetadata("bun", false), {
    timeout: 180000,
  });
  it.effect(
    "preserves the same final model and physical retirement on Node",
    () => replayCitationCaseMetadata("node", false),
    { timeout: 180000 }
  );
});

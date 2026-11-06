import { it } from "@beep/test-runner";
import { replayCitationDocumentExtraction } from "./CitationDocumentExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("live Document extraction composition", (it) => {
  it.effect(
    "connects source Document inputs and real extraction on Bun",
    () => replayCitationDocumentExtraction("bun", false),
    { timeout: 180000 }
  );
  it.effect("preserves the same owned composition on Node", () => replayCitationDocumentExtraction("node", false), {
    timeout: 180000,
  });
});

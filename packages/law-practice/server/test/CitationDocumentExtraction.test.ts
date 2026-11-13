import { it } from "@beep/test-runner";
import { replayCitationDocumentExtraction } from "./CitationDocumentExtraction.fixtures.ts";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("live Document extraction composition", (it) => {
  it.effect(
    "connects source Document inputs and real extraction on Bun",
    () => withCitationTestInvocation(replayCitationDocumentExtraction("bun", false)),
    { timeout: 180000 }
  );
});

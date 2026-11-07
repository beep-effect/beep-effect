import { it } from "@beep/test-runner";
import { replayCitationDocumentExtraction } from "../CitationDocumentExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete live Document extraction", (it) => {
  it.effect("connects every source document on Bun", () => replayCitationDocumentExtraction("bun", true), {
    timeout: 600000,
  });
  it.effect("connects every source document on Node", () => replayCitationDocumentExtraction("node", true), {
    timeout: 600000,
  });
});

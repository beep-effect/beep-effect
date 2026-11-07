import { it } from "@beep/test-runner";
import { replayCitationExtractionLoop } from "./CitationExtractionLoop.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original connected extraction loop", (it) => {
  it.effect("preserves original pre-filter and returned state on Bun", () => replayCitationExtractionLoop("bun"), {
    timeout: 180000,
  });
  it.effect("preserves original identities and state on Node", () => replayCitationExtractionLoop("node"), {
    timeout: 180000,
  });
});

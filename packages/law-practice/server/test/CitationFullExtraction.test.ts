import { it } from "@beep/test-runner";
import { replayCitationFullExtraction } from "./CitationFullExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original full-citation construction", (it) => {
  it.effect("constructs all case/law/journal source models on Bun", () => replayCitationFullExtraction("bun"), {
    timeout: 180000,
  });
  it.effect(
    "constructs the same complete models and retires children on Node",
    () => replayCitationFullExtraction("node"),
    { timeout: 180000 }
  );
});

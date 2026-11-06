import { it } from "@beep/test-runner";
import { replayCitationReferenceToken } from "./CitationReferenceToken.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original reference-token construction", (it) => {
  it.effect("constructs all short/Id./supra/unknown models on Bun", () => replayCitationReferenceToken("bun"), {
    timeout: 180000,
  });
  it.effect(
    "preserves the same source spans, fields and retirement on Node",
    () => replayCitationReferenceToken("node"),
    { timeout: 180000 }
  );
});

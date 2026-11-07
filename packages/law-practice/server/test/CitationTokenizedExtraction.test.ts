import { it } from "@beep/test-runner";
import { replayCitationTokenizedExtraction } from "./CitationTokenizedExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("native text extraction composition", (it) => {
  it.effect(
    "connects complete catalog and representative loop documents on Bun",
    () => replayCitationTokenizedExtraction("bun", false),
    { timeout: 180000 }
  );
  it.effect("preserves the same composition on Node", () => replayCitationTokenizedExtraction("node", false), {
    timeout: 180000,
  });
});

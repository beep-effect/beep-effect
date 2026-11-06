import { it } from "@beep/test-runner";
import { replayCitationSemanticExtraction } from "../CitationSemanticExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete raw semantic extraction", (it) => {
  it.effect("replays all 36 source documents on Bun", () => replayCitationSemanticExtraction("bun", true), {
    timeout: 600000,
  });
  it.effect("replays all 36 source documents on Node", () => replayCitationSemanticExtraction("node", true), {
    timeout: 600000,
  });
});

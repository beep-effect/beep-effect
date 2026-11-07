import { it } from "@beep/test-runner";
import { replayCitationSemanticExtraction } from "./CitationSemanticExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("raw semantic extraction", (it) => {
  it.effect(
    "composes all eight families under one budget on Bun",
    () => replayCitationSemanticExtraction("bun", false),
    { timeout: 180000 }
  );
  it.effect(
    "retains the same source behavior and budget on Node",
    () => replayCitationSemanticExtraction("node", false),
    { timeout: 180000 }
  );
});

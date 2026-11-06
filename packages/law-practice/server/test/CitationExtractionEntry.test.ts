import { it } from "@beep/test-runner";
import { replayCitationExtractionEntry } from "./CitationExtractionEntry.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("primitive extraction request entry", (it) => {
  it.effect("preserves original bypass and normal input on Bun", () => replayCitationExtractionEntry("bun", false), {
    timeout: 180000,
  });
  it.effect(
    "preserves the same input ownership and singleton on Node",
    () => replayCitationExtractionEntry("node", false),
    { timeout: 180000 }
  );
});

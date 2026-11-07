import { it } from "@beep/test-runner";
import { replayCitationExtractionEntry } from "../CitationExtractionEntry.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete primitive extraction request entry",
  (it) => {
    it.effect("matches every original raw document on Bun", () => replayCitationExtractionEntry("bun", true), {
      timeout: 600000,
    });
    it.effect("matches every original raw document on Node", () => replayCitationExtractionEntry("node", true), {
      timeout: 600000,
    });
  }
);

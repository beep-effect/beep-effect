import { it } from "@beep/test-runner";
import { replayCitationTokenizedExtraction } from "../CitationTokenizedExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete native text extraction composition",
  (it) => {
    it.effect("connects every source document on Bun", () => replayCitationTokenizedExtraction("bun", true), {
      timeout: 600000,
    });
    it.effect("connects every source document on Node", () => replayCitationTokenizedExtraction("node", true), {
      timeout: 600000,
    });
  }
);

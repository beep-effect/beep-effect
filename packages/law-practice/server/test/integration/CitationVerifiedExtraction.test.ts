import { it } from "@beep/test-runner";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";
import { replayCitationVerifiedExtraction } from "../CitationVerifiedExtraction.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete authenticated source extraction",
  (it) => {
    it.effect("replays all 36 source documents on Bun", () => replayCitationVerifiedExtraction("bun", true), {
      timeout: 600000,
    });
    it.effect("replays all 36 source documents on Node", () => replayCitationVerifiedExtraction("node", true), {
      timeout: 600000,
    });
  }
);

import { it } from "@beep/test-runner";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";
import { replayCitationVerifiedExtraction } from "../CitationVerifiedExtraction.fixtures.ts";

// decision: citation-integration-replay-files
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete authenticated source extraction",
  (it) => {
    it.effect("replays all 22 retained source documents on Bun", () => replayCitationVerifiedExtraction("bun", true), {
      timeout: 600000,
    });
  }
);

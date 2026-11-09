import { it } from "@beep/test-runner";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";
import { replayCitationVerifiedExtraction } from "../CitationVerifiedExtraction.fixtures.ts";

// Bun only since 2026-11-09 (deletion addendum G7): node parity for this corpus is the unit twin's smoke
// loop plus integration/CitationEngineCorpus.test.ts, the one node full-corpus scene.
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete authenticated source extraction",
  (it) => {
    it.effect("replays all 22 retained source documents on Bun", () => replayCitationVerifiedExtraction("bun", true), {
      timeout: 600000,
    });
  }
);

import { it } from "@beep/test-runner";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { replayCitationVerifiedExtraction } from "./CitationVerifiedExtraction.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("authenticated source extraction", (it) => {
  it.effect(
    "derives actual output evidence from plain, Unicode and HTML input on Bun",
    () => replayCitationVerifiedExtraction("bun", false),
    { timeout: 180000 }
  );
  it.effect(
    "preserves the same source lineage and one-budget ownership on Node",
    () => replayCitationVerifiedExtraction("node", false),
    { timeout: 180000 }
  );
});

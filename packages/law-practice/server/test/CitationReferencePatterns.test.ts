import { it } from "@beep/test-runner";
import { replayCitationReferencePatterns } from "./CitationReferencePatterns.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original reference literal templates", (it) => {
  it.effect(
    "renders every captured pattern and preserves its independently observed compiler profile",
    replayCitationReferencePatterns,
    { timeout: 60000 }
  );
});

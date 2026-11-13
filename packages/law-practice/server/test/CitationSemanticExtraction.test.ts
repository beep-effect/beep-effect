import { it } from "@beep/test-runner";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { replayCitationSemanticExtraction } from "./CitationSemanticExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("raw semantic extraction", (it) => {
  it.effect(
    "composes all eight families under one budget on Bun",
    () => withCitationTestInvocation(replayCitationSemanticExtraction("bun", false)),
    { timeout: 180000 }
  );
});

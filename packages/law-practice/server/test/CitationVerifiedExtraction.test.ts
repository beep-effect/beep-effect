import { it } from "@beep/test-runner";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { replayCitationVerifiedExtraction } from "./CitationVerifiedExtraction.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("authenticated source extraction", (it) => {
  it.effect(
    "derives actual output evidence from plain, Unicode and HTML input on Bun",
    () => withCitationTestInvocation(replayCitationVerifiedExtraction("bun", false)),
    { timeout: 180000 }
  );
});

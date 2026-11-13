import { it } from "@beep/test-runner";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { replayCitationReferenceNames } from "./CitationReferenceNames.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original generated-reference names", (it) => {
  it.effect("retains all pinned validity observations and the original four-name order", () =>
    withCitationTestInvocation(replayCitationReferenceNames())
  );
});

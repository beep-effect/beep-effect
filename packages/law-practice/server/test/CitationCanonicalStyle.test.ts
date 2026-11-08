import { it } from "@beep/test-runner";
import { replayCitationCanonicalStyle } from "./CitationCanonicalStyle.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original tag-balancing assertions", (it) => {
  it.effect("recomputes all six original style proximity predicates and equalities", () =>
    replayCitationCanonicalStyle()
  );
});

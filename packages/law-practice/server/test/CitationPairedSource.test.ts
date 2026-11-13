import { it } from "@beep/test-runner";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { replayCitationPairedSource } from "./CitationPairedSource.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("paired verified sources", (it) => {
  it.effect(
    "preserves both input identities and original Both-branch behavior on Bun",
    () => withCitationTestInvocation(replayCitationPairedSource("bun")),
    {
      timeout: 180000,
    }
  );
  it.effect(
    "preserves the same evidence and refusal behavior on Node",
    () => withCitationTestInvocation(replayCitationPairedSource("node")),
    {
      timeout: 180000,
    }
  );
});

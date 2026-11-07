import { it } from "@beep/test-runner";
import { assertCitationCaseNameSharedBudget, replayCitationCaseName } from "./CitationCaseName.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original plain case name", (it) => {
  it.effect("carries the same text authority from scanning into processing", assertCitationCaseNameSharedBudget, {
    timeout: 180000,
  });
  it.effect("shares scan/conditional processing authority on Bun", () => replayCitationCaseName("bun", false), {
    timeout: 180000,
  });
  it.effect(
    "shares the same original guard and physical retirement on Node",
    () => replayCitationCaseName("node", false),
    { timeout: 180000 }
  );
});

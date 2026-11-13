import { it } from "@beep/test-runner";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import {
  assertCitationPinExtractionBudget,
  assertCitationPinExtractionConfiguration,
  assertCitationPinExtractionLifetime,
  replayCitationPinExtraction,
} from "./CitationPinExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source pin extraction", (it) => {
  it.effect("rejects malformed installation", () =>
    withCitationTestInvocation(assertCitationPinExtractionConfiguration())
  );
  it.effect(
    "owns exact budgets and immutable source configuration",
    () => withCitationTestInvocation(assertCitationPinExtractionBudget()),
    {
      timeout: 120000,
    }
  );
  it.effect(
    "retains captured lifetime and deadline",
    () => withCitationTestInvocation(assertCitationPinExtractionLifetime()),
    { timeout: 120000 }
  );
  for (const kind of ["bun"] as const)
    it.effect(
      `matches source pin tuples through ${kind}`,
      () => withCitationTestInvocation(replayCitationPinExtraction(kind, false)),
      {
        timeout: 120000,
      }
    );
});

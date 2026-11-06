import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import {
  assertCitationPinExtractionBudget,
  assertCitationPinExtractionLifetime,
  replayCitationPinExtraction,
} from "./CitationPinExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source pin extraction", (it) => {
  it.effect("owns exact budgets and immutable source configuration", assertCitationPinExtractionBudget, {
    timeout: 120000,
  });
  it.effect("retains captured lifetime and deadline", assertCitationPinExtractionLifetime, { timeout: 120000 });
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`matches source pin tuples through ${kind}`, () => replayCitationPinExtraction(kind, false), {
      timeout: 120000,
    });
});

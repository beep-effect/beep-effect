import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { assertCitationContextBudget, replayCitationContextMatches } from "./CitationContextMatcher.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source context matcher", (it) => {
  it.effect(
    "accounts for the worker copy before admission and recovers with owned results",
    assertCitationContextBudget,
    { timeout: 60000 }
  );
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches source captures through actual ${kind} children`,
      () => replayCitationContextMatches(kind, false),
      { timeout: 120000 }
    );
  }
});

import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import {
  assertCitationStopWordsBudget,
  assertCitationStopWordsLifetime,
  replayCitationStopWords,
} from "./CitationStopWords.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source stop-word cleanup", (it) => {
  it.effect("bounds cumulative allocations and owns installed patterns", assertCitationStopWordsBudget, {
    timeout: 120000,
  });
  it.effect("keeps captured lifetime and timing", assertCitationStopWordsLifetime, { timeout: 120000 });
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`preserves original cleanup through ${kind}`, () => replayCitationStopWords(kind, false), {
      timeout: 120000,
    });
});

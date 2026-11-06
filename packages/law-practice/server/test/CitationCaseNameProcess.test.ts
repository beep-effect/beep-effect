import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import {
  assertCitationCaseNameProcessBudget,
  assertCitationCaseNameProcessLifetime,
  assertCitationMetadataStageDeadline,
  assertCitationPythonIntegers,
  replayCitationCaseNameProcess,
} from "./CitationCaseNameProcess.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source candidate-name processing", (it) => {
  it.effect("preserves direct Python int values and failures", assertCitationPythonIntegers);
  it.effect("shares exact cumulative budget and owns installed configuration", assertCitationCaseNameProcessBudget, {
    timeout: 120000,
  });
  it.effect("keeps enclosing lifetime and captured timer", assertCitationCaseNameProcessLifetime, { timeout: 120000 });
  it.effect("enforces the stage deadline without nested timers", assertCitationMetadataStageDeadline, {
    timeout: 15000,
  });
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`preserves source assignments through ${kind}`, () => replayCitationCaseNameProcess(kind, false), {
      timeout: 180000,
    });
});

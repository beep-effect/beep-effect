import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import {
  assertCitationPreCaseBudget,
  assertCitationPreCaseLifetime,
  replayCitationPreCaseMetadata,
} from "./CitationPreCaseMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source pre-case metadata", (it) => {
  it.effect("owns budgets and preserves early source guards", assertCitationPreCaseBudget, { timeout: 120000 });
  it.effect("retains closed lifetime and captured timing", assertCitationPreCaseLifetime, { timeout: 120000 });
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`matches source backward metadata through ${kind}`, () => replayCitationPreCaseMetadata(kind, false), {
      timeout: 120000,
    });
});

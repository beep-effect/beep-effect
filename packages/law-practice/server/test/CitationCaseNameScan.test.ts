import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import {
  assertCitationCaseNameScanBudget,
  assertCitationCaseNameScanDefaultPolicy,
  assertCitationCaseNameScanLifetime,
  replayCitationCaseNameScan,
} from "./CitationCaseNameScan.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("initialized source case-name scan", (it) => {
  it.effect("reserves exact cumulative output and captures pattern bytes", assertCitationCaseNameScanBudget, {
    timeout: 120000,
  });
  it.effect("keeps closed lifetime and captured deadline", assertCitationCaseNameScanLifetime, { timeout: 120000 });
  it.effect("retains the existing default pattern refusal", assertCitationCaseNameScanDefaultPolicy, {
    timeout: 120000,
  });
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`matches original scan states through ${kind}`, () => replayCitationCaseNameScan(kind, false), {
      timeout: 120000,
    });
});

import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import {
  assertCitationPostCaseBudget,
  assertCitationPostCaseLifetime,
  assertCitationPostCaseMetadataConfiguration,
  assertCitationPostCaseWhitespace,
  replayCitationPostCaseMetadata,
} from "./CitationPostCaseMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source post-case metadata", (it) => {
  it.effect(
    "rejects malformed installation and oversized enclosing budgets",
    assertCitationPostCaseMetadataConfiguration
  );
  it.effect("reserves exact output and captures configuration", assertCitationPostCaseBudget, { timeout: 120000 });
  it.effect("retains lifetime and captured deadline", assertCitationPostCaseLifetime, { timeout: 120000 });
  it.effect("retains all frozen whitespace and native words", assertCitationPostCaseWhitespace);
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`matches native post-case fields through ${kind}`, () => replayCitationPostCaseMetadata(kind, false), {
      timeout: 120000,
    });
});

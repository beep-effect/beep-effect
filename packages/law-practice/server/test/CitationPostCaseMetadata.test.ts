import { it } from "@beep/test-runner";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import {
  assertCitationPostCaseBudget,
  assertCitationPostCaseLifetime,
  assertCitationPostCaseMetadataConfiguration,
  assertCitationPostCaseWhitespace,
  replayCitationPostCaseMetadata,
} from "./CitationPostCaseMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source post-case metadata", (it) => {
  it.effect("rejects malformed installation", () =>
    withCitationTestInvocation(assertCitationPostCaseMetadataConfiguration())
  );
  it.effect(
    "reserves exact output and captures configuration",
    () => withCitationTestInvocation(assertCitationPostCaseBudget()),
    { timeout: 120000 }
  );
  it.effect(
    "retains lifetime and captured deadline",
    () => withCitationTestInvocation(assertCitationPostCaseLifetime()),
    { timeout: 120000 }
  );
  it.effect("retains all frozen whitespace and native words", () =>
    withCitationTestInvocation(assertCitationPostCaseWhitespace())
  );
  for (const kind of ["bun"] as const)
    it.effect(
      `matches native post-case fields through ${kind}`,
      () => withCitationTestInvocation(replayCitationPostCaseMetadata(kind, false)),
      {
        timeout: 120000,
      }
    );
});

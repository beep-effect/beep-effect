import { it } from "@beep/test-runner";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import {
  assertCitationFullLawMetadataInput,
  assertCitationLawMetadataBudget,
  assertCitationLawMetadataConfiguration,
  assertCitationLawMetadataDigest,
  assertCitationLawMetadataLifetime,
  replayCitationLawMetadata,
} from "./CitationLawMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source law metadata composition", (it) => {
  it.effect("sanitizes fixed-pattern digest defects before native work and permits clean reinstallation", () =>
    withCitationTestInvocation(assertCitationLawMetadataDigest())
  );
  it.effect("validates full-law input after edition preflight without partial publication", () =>
    withCitationTestInvocation(assertCitationFullLawMetadataInput())
  );
  it.effect("rejects malformed installation", () =>
    withCitationTestInvocation(assertCitationLawMetadataConfiguration())
  );
  it.effect(
    "refuses partial patches, retains budgets and owns configuration",
    () => withCitationTestInvocation(assertCitationLawMetadataBudget()),
    {
      timeout: 120000,
    }
  );
  it.effect(
    "closes lifetime and captured deadline failures without metadata",
    () => withCitationTestInvocation(assertCitationLawMetadataLifetime()),
    {
      timeout: 120000,
    }
  );
  for (const kind of ["bun"] as const) {
    it.effect(
      `matches source field updates and span changes through ${kind}`,
      () => withCitationTestInvocation(replayCitationLawMetadata(kind, false)),
      { timeout: 120000 }
    );
  }
});

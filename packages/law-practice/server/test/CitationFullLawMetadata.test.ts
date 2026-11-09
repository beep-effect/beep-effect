import { it } from "@beep/test-runner";
import {
  assertCitationFullLawMetadataFailure,
  replayCitationFullLawMetadata,
} from "./CitationFullLawMetadata.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source full-law metadata", (it) => {
  it.effect("refuses before workers and discards late failures", assertCitationFullLawMetadataFailure, {
    timeout: 120000,
  });
  for (const kind of ["bun"] as const) {
    it.effect(
      `composes source metadata and edition choice through ${kind}`,
      () => replayCitationFullLawMetadata(kind, false),
      { timeout: 120000 }
    );
  }
});

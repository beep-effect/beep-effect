import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import {
  assertCitationCaptureReuseProfiles,
  replayCitationCaptureReuse,
} from "./CitationRegexCaptureReuse.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source logical capture reuse", (it) => {
  it.effect("preserves independent source profiles and capture closing order", assertCitationCaptureReuseProfiles, {
    timeout: 120000,
  });
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(
      `matches logical captures and retains unqualified-profile refusal through ${kind}`,
      () => replayCitationCaptureReuse(kind, false),
      { timeout: 180000 }
    );
});

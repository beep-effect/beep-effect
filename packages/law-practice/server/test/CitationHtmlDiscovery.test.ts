import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { assertCitationHtmlDiscoveryOwnership, replayCitationHtmlDiscovery } from "./CitationHtmlDiscovery.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original HTML discovery", (it) => {
  it.effect(
    "owns fixed programs and refuses effective over-allocation before spawn",
    assertCitationHtmlDiscoveryOwnership,
    { timeout: 120000 }
  );
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`preserves source discovery through ${kind}`, () => replayCitationHtmlDiscovery(kind, false), {
      timeout: 120000,
    });
});

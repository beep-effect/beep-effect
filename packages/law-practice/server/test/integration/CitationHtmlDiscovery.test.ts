import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { replayCitationHtmlDiscovery } from "../CitationHtmlDiscovery.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete original HTML discovery", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(`replays every original observation through ${kind}`, () => replayCitationHtmlDiscovery(kind, true), {
      timeout: 600000,
    });
});

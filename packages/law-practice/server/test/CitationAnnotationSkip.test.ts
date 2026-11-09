import { it } from "@beep/test-runner";
import { replayCitationSkipAnnotations } from "./CitationAnnotationSkip.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original skip annotation composition", (it) => {
  it.effect(
    "preserves XML/style decisions, output and skip warnings on Bun",
    () => replayCitationSkipAnnotations("bun", false),
    { timeout: 120000 }
  );
});

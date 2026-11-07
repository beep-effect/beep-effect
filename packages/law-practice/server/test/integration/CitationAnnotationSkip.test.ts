import { it } from "@beep/test-runner";
import { replayCitationSkipAnnotations } from "../CitationAnnotationSkip.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete original skip annotation corpus",
  (it) => {
    it.effect("replays every skip output and XML check through Bun", () => replayCitationSkipAnnotations("bun", true), {
      timeout: 180000,
    });
    it.effect(
      "replays every skip output and XML check through Node",
      () => replayCitationSkipAnnotations("node", true),
      { timeout: 180000 }
    );
  }
);

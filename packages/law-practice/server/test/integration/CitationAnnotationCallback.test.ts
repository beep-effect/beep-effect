import { it } from "@beep/test-runner";
import { replayCitationAnnotationCallbacks } from "../CitationAnnotationCallback.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete original annotation callback corpus",
  (it) => {
    it.effect(
      "replays every original callback output and failure through Bun",
      () => replayCitationAnnotationCallbacks("bun", true),
      { timeout: 300000 }
    );
    it.effect(
      "replays every original callback output and failure through Node",
      () => replayCitationAnnotationCallbacks("node", true),
      { timeout: 300000 }
    );
  }
);

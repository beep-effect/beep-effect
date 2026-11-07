import { it } from "@beep/test-runner";
import { replayCitationAnnotationCallbacks } from "./CitationAnnotationCallback.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true, concurrent: false, timeout: "5 seconds" })(
  "original annotation callback composition",
  (it) => {
    it.effect(
      "preserves all unchecked callback traces and deferred join failures",
      () => replayCitationAnnotationCallbacks("bun", false, true),
      { timeout: 120000 }
    );
    it.effect(
      "preserves markup preparation and callback failure precedence on Bun",
      () => replayCitationAnnotationCallbacks("bun", false),
      { timeout: 120000 }
    );
    it.effect(
      "preserves the same native callback inputs and outcomes on Node",
      () => replayCitationAnnotationCallbacks("node", false),
      { timeout: 120000 }
    );
  }
);

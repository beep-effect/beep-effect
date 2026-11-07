import { it } from "@beep/test-runner";
import { replayCitationNativeWrap, replayCitationWrapComposition } from "../CitationAnnotationWrap.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "complete original wrap annotation corpora",
  (it) => {
    it.effect("replays every original helper case through Bun", () => replayCitationNativeWrap("bun", true), {
      timeout: 600000,
    });
    it.effect("replays every original helper case through Node", () => replayCitationNativeWrap("node", true), {
      timeout: 600000,
    });
    it.effect("replays every original wrap dispatch through Bun", () => replayCitationWrapComposition("bun", true), {
      timeout: 300000,
    });
    it.effect("replays every original wrap dispatch through Node", () => replayCitationWrapComposition("node", true), {
      timeout: 300000,
    });
  }
);

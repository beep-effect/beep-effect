import { it } from "@beep/test-runner";
import { replayCitationNativeWrap, replayCitationWrapComposition } from "./CitationAnnotationWrap.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "original wrap annotation with native workers",
  (it) => {
    it.effect("matches original helper output/refusal through Bun", () => replayCitationNativeWrap("bun", false), {
      timeout: 120000,
    });
    it.effect(
      "composes original XML decisions, template failures and overlap state on Bun",
      () => replayCitationWrapComposition("bun", false),
      { timeout: 120000 }
    );
  }
);

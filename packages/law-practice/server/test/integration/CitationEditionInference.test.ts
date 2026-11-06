import { it } from "@beep/test-runner";
import * as TestClock from "effect/testing/TestClock";
import { replayCitationEditionYears } from "../CitationEditionInference.fixtures.ts";
import { citationTokenizerTestLayer } from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer)("all canonical edition boundaries", (it) => {
  it.layer(TestClock.layer())("owned calendar", (it) => {
    it.effect("matches all 25718 original date checks over 2533 editions", () => replayCitationEditionYears(true), {
      timeout: 600000,
    });
  });
});

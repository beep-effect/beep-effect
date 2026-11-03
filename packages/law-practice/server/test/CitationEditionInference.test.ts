import { it } from "@beep/test-runner";
import * as TestClock from "effect/testing/TestClock";
import {
  assertCitationEditionInferenceDeadline,
  replayCitationEditionGuesses,
  replayCitationEditionYears,
} from "./CitationEditionInference.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer)("source edition inference", (it) => {
  it.layer(TestClock.layer())("candidate selection", (it) => {
    it.effect("matches all 2480 source choices and live calendar changes", replayCitationEditionGuesses, {
      timeout: 60000,
    });
  });
  it.layer(TestClock.layer())("deadline ownership", (it) => {
    it.effect("retains captured timing under a disabled caller Clock", assertCitationEditionInferenceDeadline);
  });
  it.layer(TestClock.layer())("canonical boundaries", (it) => {
    it.effect(
      "matches source date boundaries through the authenticated edition owner",
      () => replayCitationEditionYears(false),
      { timeout: 60000 }
    );
  });
});

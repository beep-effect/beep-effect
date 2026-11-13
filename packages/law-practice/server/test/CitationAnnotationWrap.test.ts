import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import {
  refuseCitationWrapInOriginalOrder,
  replayCitationNativeWrap,
  replayCitationWrapComposition,
} from "./CitationAnnotationWrap.fixtures.ts";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "original wrap annotation with native workers",
  (it) => {
    it.effect(
      "matches original helper output/refusal through Bun",
      () => withCitationTestInvocation(replayCitationNativeWrap("bun", false)),
      {
        timeout: 120000,
      }
    );
    it.effect(
      "composes original XML decisions, template failures and overlap state on Bun",
      () => withCitationTestInvocation(replayCitationWrapComposition("bun", false)),
      { timeout: 120000 }
    );
    it.effect("reports the template refusal before the installed wrap worker's", () =>
      Effect.gen(function* () {
        const { refused, templates } = yield* refuseCitationWrapInOriginalOrder("bun");
        expect(refused).toEqual(templates);
      })
    );
  }
);

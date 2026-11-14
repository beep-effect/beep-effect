import { it } from "@beep/test-runner";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { installCitationTokenizedExtractionFixture } from "./CitationTokenizedExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const refusal = (failure: { readonly _tag: string }) => ({
  _tag: failure._tag,
  detail: "limit" in failure ? failure.limit : "reason" in failure ? failure.reason : undefined,
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("extraction stage installation", (it) => {
  it.effect(
    "refuses an extraction request outside the owned Document input schema",
    () =>
      Effect.gen(function* () {
        const { stage } = yield* installCitationTokenizedExtractionFixture("bun");
        const failure = yield* stage.extract({ plain: "not native storage" }).pipe(Effect.flip);
        deepStrictEqual(refusal(failure), { _tag: "CitationTokenizedExtractionFailure", detail: "invalid-input" });
      }),
    { timeout: 60_000 }
  );
});

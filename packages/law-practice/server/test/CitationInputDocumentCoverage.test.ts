import { makeCitationInputDocument } from "@beep/law-practice-server/internal/Citation/InputDocument";
import { it } from "@beep/test-runner";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { installCitationDocumentExtractionFixture } from "./CitationDocumentExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("input Document request boundary", (it) => {
  it.effect(
    "refuses initialization requests outside the live Document input schema before any truth test",
    () =>
      Effect.gen(function* () {
        const { setup, provided, configuration, values } = yield* installCitationDocumentExtractionFixture("bun");
        const initializer = yield* makeCitationInputDocument(setup.limits, setup.runtime, configuration.document).pipe(
          Effect.provideContext(provided)
        );
        const plain = yield* values.sourceText("1 U.S. 1");
        for (const raw of [null, { plain }, { plain, markup: plain, steps: "list" }]) {
          const failure = yield* initializer.initialize(raw).pipe(Effect.flip);
          deepStrictEqual(
            { _tag: failure._tag, reason: "reason" in failure ? failure.reason : undefined },
            { _tag: "CitationDocumentInputFailure", reason: "invalid-input" }
          );
        }
      }),
    { timeout: 10_000 }
  );
});

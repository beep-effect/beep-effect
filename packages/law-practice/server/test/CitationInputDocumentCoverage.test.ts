import { makeCitationInputDocument } from "@beep/law-practice-server/internal/Citation/InputDocument";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { installCitationDocumentExtractionFixture } from "./CitationDocumentExtraction.fixtures.ts";
import { makeCitationTestScaffoldBinding, withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("input Document request boundary", (it) => {
  it.effect(
    "refuses initialization requests outside the live Document input schema before any truth test",
    () =>
      withCitationTestInvocation(
        Effect.gen(function* () {
          const { setup, provided, configuration, values } = yield* installCitationDocumentExtractionFixture("bun");
          const initializer = yield* makeCitationInputDocument(
            setup.limits,
            setup.runtime,
            configuration.document
          ).pipe(
            Effect.flatMap((stage) =>
              makeCitationTestScaffoldBinding(setup.limits).pipe(
                Effect.map((bind) => ({ ...stage, initialize: bind(stage.initialize) }))
              )
            ),
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
        })
      ),
    { timeout: 60_000 }
  );

  it.effect(
    "surfaces a refusing HTML geometry install only where markup initialization builds the geometry",
    () =>
      Effect.gen(function* () {
        const { setup, provided, configuration, values, adapter } =
          yield* installCitationDocumentExtractionFixture("bun");
        // One pattern is too few for the two discovery descriptors: the discovery evaluator
        // install refuses, while every check that runs when the stage is installed passes.
        const limits = { ...setup.limits, patterns: 1 };
        const initializer = yield* makeCitationInputDocument(limits, setup.runtime, configuration.document).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(limits).pipe(
              Effect.map((bind) => ({ ...stage, initialize: bind(stage.initialize) }))
            )
          ),
          Effect.provideContext(provided)
        );
        const plain = yield* values.sourceText("1 U.S. 1");
        const none = yield* values.retainHost(null);
        const noSteps = yield* adapter.create({ kind: "list", names: [] });
        const initialized = yield* initializer.initialize({ plain, markup: none, steps: noSteps });
        expect(initialized.plain).toBe(plain);
        expect(initialized.geometry._tag).toBe("None");
        const empty = yield* values.sourceText("");
        const markup = yield* values.sourceText("<i>A</i> 1 U.S. 1");
        const htmlSteps = yield* adapter.create({ kind: "list", names: ["html"] });
        const refused = yield* initializer.initialize({ plain: empty, markup, steps: htmlSteps }).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patterns" });
      }),
    { timeout: 60_000 }
  );
});

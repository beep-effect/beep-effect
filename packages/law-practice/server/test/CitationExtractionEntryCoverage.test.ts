import { CitationDocumentStepContainers } from "@beep/law-practice-server/internal/Citation/DocumentCleanerProtocols";
import { makeCitationExtractionEntry } from "@beep/law-practice-server/internal/Citation/ExtractionEntry";
import { CitationEngineCleanerPlan } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { installCitationDocumentExtractionFixture } from "./CitationDocumentExtraction.fixtures.ts";
import { makeCitationTestInvocationBinding } from "./CitationInvocation.fixtures.ts";
import { assertCitationWorkerCompositionReleased } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const install = Effect.fnUntraced(function* (narrow: Partial<CitationEngineLimits> = {}) {
  const installed = yield* installCitationDocumentExtractionFixture("bun");
  const provided = Context.add(installed.provided, CitationDocumentStepContainers, {
    create: installed.adapter.create,
  });
  const entry = yield* makeCitationExtractionEntry(
    { ...installed.setup.limits, ...narrow },
    installed.setup.runtime,
    installed.configuration
  ).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestInvocationBinding({ ...installed.setup.limits, ...narrow }).pipe(
        Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
      )
    ),
    Effect.provideContext(provided),
    DateTime.withCurrentZoneOffset(0)
  );
  return { entry, provided, setup: installed.setup };
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("primitive extraction entry refusals", (it) => {
  it.effect("refuses invalid installation configuration before capturing workers", () =>
    Effect.gen(function* () {
      const { setup, provided } = yield* install();
      const before = yield* setup.observed.snapshot;
      const failure = yield* makeCitationExtractionEntry(setup.limits, setup.runtime, {}).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestInvocationBinding(setup.limits).pipe(
            Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
          )
        ),
        Effect.provideContext(provided),
        DateTime.withCurrentZoneOffset(0),
        Effect.flip
      );
      deepStrictEqual(
        { _tag: failure._tag, reason: "reason" in failure ? failure.reason : undefined },
        { _tag: "CitationExtractionEntryFailure", reason: "invalid-configuration" }
      );
      yield* assertCitationWorkerCompositionReleased(
        setup.operation,
        setup.admission,
        setup.observed.snapshot,
        before.spawned
      );
    })
  );

  it.effect("rejects ordinary oversized source text before launching native extraction", () =>
    Effect.gen(function* () {
      const { entry, setup } = yield* install({ sourceUtf16: 3 });
      const before = yield* setup.observed.snapshot;
      const failure = yield* entry.extract({ plain: "abcd", markup: null, cleanSteps: [] }).pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "extract",
        limit: "sourceUtf16",
      });
      yield* assertCitationWorkerCompositionReleased(
        setup.operation,
        setup.admission,
        setup.observed.snapshot,
        before.spawned
      );
    })
  );

  it.effect("refuses a named cleaner plan when no resolver was captured", () =>
    Effect.gen(function* () {
      const { entry, setup } = yield* install();
      const before = yield* setup.observed.snapshot;
      const failure = yield* entry
        .extract({
          plain: "abc",
          markup: null,
          cleanSteps: CitationEngineCleanerPlan.make({ plan: "missing/v1" }),
        })
        .pipe(Effect.flip);
      deepStrictEqual(
        { _tag: failure._tag, reason: "reason" in failure ? failure.reason : undefined },
        { _tag: "CitationExtractionEntryFailure", reason: "invalid-input" }
      );
      yield* assertCitationWorkerCompositionReleased(
        setup.operation,
        setup.admission,
        setup.observed.snapshot,
        before.spawned
      );
    })
  );
});

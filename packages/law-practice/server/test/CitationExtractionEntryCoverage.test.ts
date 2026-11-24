import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationDocumentStepContainers } from "@beep/law-practice-server/internal/Citation/DocumentCleanerProtocols";
import { makeCitationExtractionEntry } from "@beep/law-practice-server/internal/Citation/ExtractionEntry";
import { CitationEngineCleanerPlan } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { installCitationDocumentExtractionFixture } from "./CitationDocumentExtraction.fixtures.ts";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import { assertCitationWorkerCompositionReleased } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("test/CitationExtractionEntryCoverage");

class InstalledDocumentExtraction extends Context.Service<
  InstalledDocumentExtraction,
  Effect.Success<ReturnType<typeof installCitationDocumentExtractionFixture>>
>()($I`InstalledDocumentExtraction`) {}

const completeCatalogInstalledOncePerBlockLayer = Layer.effect(
  InstalledDocumentExtraction,
  installCitationDocumentExtractionFixture("bun")
);

const installEntryFromAlreadyOwnedConfiguration = Effect.fnUntraced(function* (
  narrow: Partial<CitationEngineLimits> = {}
) {
  const installed = yield* InstalledDocumentExtraction;
  const limits = { ...installed.setup.limits, ...narrow };
  const provided = Context.add(installed.provided, CitationDocumentStepContainers, {
    create: installed.adapter.create,
  });
  const entry = yield* makeCitationExtractionEntry(limits, installed.setup.runtime, installed.configuration).pipe(
    Effect.zipWith(makeCitationTestScaffoldBinding(limits), (stage, bind) => ({
      ...stage,
      extract: bind(stage.extract),
    })),
    Effect.provideContext(provided),
    DateTime.withCurrentZoneOffset(0)
  );
  return { entry, setup: installed.setup };
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true, timeout: "30 seconds" })(
  "primitive extraction entry refusals",
  (it) => {
    it.layer(completeCatalogInstalledOncePerBlockLayer, { concurrent: false, timeout: "120 seconds" })(
      "over one complete-catalog installation, installed once because owning the catalog costs seconds and the refusal stays inside the contended Turbo watchdog; sequential because both tests read its spawn and admission counters",
      (it) => {
        it.effect("rejects ordinary oversized source text before launching native extraction", () =>
          Effect.gen(function* () {
            const { entry, setup } = yield* installEntryFromAlreadyOwnedConfiguration({ sourceUtf16: 3 });
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
            const { entry, setup } = yield* installEntryFromAlreadyOwnedConfiguration();
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
      }
    );
  }
);

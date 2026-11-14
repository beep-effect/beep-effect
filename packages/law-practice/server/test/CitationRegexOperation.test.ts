import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAdmissionSnapshot,
  CitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { makeCitationMetadataStage } from "@beep/law-practice-server/internal/Citation/MetadataComposition";
import {
  citationUnaccountedText,
  makeCitationRegexInput,
} from "@beep/law-practice-server/internal/Citation/RegexInput";
import {
  CitationRegexOperation,
  makeCitationRegexTiming,
} from "@beep/law-practice-server/internal/Citation/RegexPolicy";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { ownCitationTestConfiguration } from "./CitationConfigurationOwnership.fixtures.ts";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationOwned } from "@beep/law-practice-server/internal/Citation/ConfigurationOwnership";
import type { CitationEngineOperation } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("test/CitationRegexOperation");
const OperationProbe = S.Struct({}).pipe(
  $I.annoteSchema("OperationProbe", {
    description: "No configuration is needed to observe captured operation routing.",
  })
);
it.effect("captures annotation regex preparation timing despite later operation replacement", () =>
  withCitationTestInvocation(
    Effect.gen(function* () {
      const defaults = (yield* defaultCitationEnginePolicy).limits;
      const limits = {
        ...defaults,
        cleanDeadline: Duration.millis(1),
        extractDeadline: Duration.millis(1),
        annotateDeadline: Duration.millis(50),
      };
      const input = yield* makeCitationRegexInput(limits, citationUnaccountedText).pipe(
        Effect.provideService(CitationRegexOperation, "annotate")
      );
      const entered = yield* Deferred.make<void>();
      const completed = yield* Ref.make(false);
      const pending = yield* input
        .prepareUnicode(
          { width: 1, bytes: new Uint8Array() },
          Effect.fn("RegexOperationTest.blockPreparation")(() =>
            Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never))
          )
        )
        .pipe(
          Effect.provideService(CitationRegexOperation, "extract"),
          Effect.flip,
          Effect.ensuring(Ref.set(completed, true)),
          Effect.forkChild
        );
      yield* Deferred.await(entered);
      yield* TestClock.adjust(Duration.millis(1));
      const early = yield* Ref.get(completed);
      expect(early).toBe(false);
      yield* TestClock.adjust(Duration.millis(49));
      const error = yield* Fiber.join(pending);
      expect(error).toEqual(CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "annotateDeadline" }));
    })
  )
);
it.effect("keeps extraction as the default and honors the enclosing operation deadline", () =>
  withCitationTestInvocation(
    Effect.gen(function* () {
      const defaults = (yield* defaultCitationEnginePolicy).limits;
      const limits = { ...defaults, extractDeadline: Duration.millis(20), operationDeadline: Duration.millis(5) };
      const timing = yield* makeCitationRegexTiming(limits, false);
      expect(timing.operation).toBe("extract");
      expect(timing.deadlineLimit).toBe("operationDeadline");
      const pending = yield* timing.timed(Effect.never).pipe(Effect.flip, Effect.forkChild);
      yield* TestClock.adjust(Duration.millis(5));
      const error = yield* Fiber.join(pending);
      expect(error).toEqual(CitationSafetyLimitExceeded.make({ operation: "extract", limit: "operationDeadline" }));
    })
  )
);

it.layer(citationTokenizerTestLayer)("captured operation in the shared stage owner", (it) => {
  it.effect("retains child operation labels without reacquiring admission", () =>
    withCitationTestInvocation(
      Effect.gen(function* () {
        const setup = yield* setupCitationMetadataRuntime("bun");
        const calls = yield* Ref.make<ReadonlyArray<CitationEngineOperation>>([]);
        const admission = CitationOperationAdmission.of({
          run: Effect.fn("RegexOperationTest.admit")(
            <A, E, R>(operation: CitationEngineOperation, body: Effect.Effect<A, E, R>) =>
              Ref.update(calls, A.append(operation)).pipe(Effect.andThen(body))
          ),
          snapshot: Effect.succeed(CitationAdmissionSnapshot.make({ active: 0, queued: 0, closed: false })),
        });
        const factory = makeCitationMetadataStage({
          method: "probe",
          own: Effect.fn("RegexOperationTest.own")(
            (_limits, _configuration: CitationOwned<typeof OperationProbe.Type>) => Effect.void
          ),
          prepare: Effect.fn("RegexOperationTest.childOperation")(function* () {
            return yield* CitationRegexOperation;
          }),
          project: (operation: CitationEngineOperation) => operation,
        });
        const configuration = yield* ownCitationTestConfiguration(OperationProbe, {});
        const stage = yield* factory(setup.limits, setup.runtime, configuration).pipe(
          Effect.provideContext(Context.add(setup.provided, CitationOperationAdmission, admission)),
          Effect.provideService(CitationRegexOperation, "annotate")
        );
        const result = yield* stage.probe({}).pipe(Effect.provideService(CitationRegexOperation, "extract"));
        expect(result).toBe("annotate");
        const seen = yield* Ref.get(calls);
        expect(seen).toEqual([]);
        const native = yield* setup.observed.snapshot;
        expect(native).toEqual({ spawned: 0, confirmed: 0 });
      })
    )
  );
});

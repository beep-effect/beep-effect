import { makeCitationRegexInput } from "@beep/law-practice-server/internal/Citation/RegexInput";
import {
  CitationRegexOperation,
  makeCitationRegexTiming,
} from "@beep/law-practice-server/internal/Citation/RegexPolicy";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Ref from "effect/Ref";
import * as TestClock from "effect/testing/TestClock";

it.effect("captures annotation regex preparation timing despite later operation replacement", () =>
  Effect.gen(function* () {
    const defaults = (yield* defaultCitationEnginePolicy).limits;
    const limits = {
      ...defaults,
      cleanDeadline: Duration.millis(1),
      extractDeadline: Duration.millis(1),
      annotateDeadline: Duration.millis(50),
    };
    const input = yield* makeCitationRegexInput(limits).pipe(Effect.provideService(CitationRegexOperation, "annotate"));
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
);
it.effect("keeps extraction as the default and honors the enclosing operation deadline", () =>
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
);

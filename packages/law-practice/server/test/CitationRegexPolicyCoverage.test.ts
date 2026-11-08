import {
  CitationRegexOperation,
  makeCitationRegexTiming,
} from "@beep/law-practice-server/internal/Citation/RegexPolicy";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { assertUndefined, deepStrictEqual } from "@effect/vitest/utils";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";

it.effect("bounds operation-timed bodies by the enclosing deadline alone, attributed to the captured operation", () =>
  Effect.gen(function* () {
    const defaults = (yield* defaultCitationEnginePolicy).limits;
    const limits = { ...defaults, annotateDeadline: Duration.millis(1), operationDeadline: Duration.millis(5) };
    const timing = yield* makeCitationRegexTiming(limits, false).pipe(
      Effect.provideService(CitationRegexOperation, "annotate")
    );
    const quick = yield* timing.operationTimed(Effect.succeed("done"));
    deepStrictEqual(quick, "done");
    const pending = yield* timing.operationTimed(Effect.never).pipe(Effect.flip, Effect.forkChild);
    yield* TestClock.adjust(Duration.millis(4));
    assertUndefined(pending.pollUnsafe());
    yield* TestClock.adjust(Duration.millis(1));
    const error = yield* Fiber.join(pending);
    deepStrictEqual(error, CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "operationDeadline" }));
  })
);

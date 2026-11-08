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

it.effect("attributes nested safety failures to the installed operation without changing other outcomes", () =>
  Effect.gen(function* () {
    const { limits } = yield* defaultCitationEnginePolicy;
    for (const operation of ["clean", "extract", "resolve", "annotate"] as const) {
      const timing = yield* makeCitationRegexTiming(limits, true).pipe(
        Effect.provideService(CitationRegexOperation, operation)
      );
      for (const method of ["timed", "operationTimed"] as const) {
        const nested = CitationSafetyLimitExceeded.make({ operation: "extract", limit: "producedTextUtf16" });
        const failure = yield* timing[method](Effect.fail(nested)).pipe(
          Effect.provideService(CitationRegexOperation, "extract"),
          Effect.flip
        );
        deepStrictEqual(failure, CitationSafetyLimitExceeded.make({ operation, limit: "producedTextUtf16" }));
        const original = new Error("unrelated synthetic failure");
        const unrelated = yield* timing[method](Effect.fail(original)).pipe(Effect.flip);
        deepStrictEqual(unrelated === original, true);
        const success = yield* timing[method](Effect.succeed("complete"));
        deepStrictEqual(success, "complete");
      }
    }
  })
);

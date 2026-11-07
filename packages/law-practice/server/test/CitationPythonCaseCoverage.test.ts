import { makeCitationPythonLower } from "@beep/law-practice-server/internal/Citation/PythonCase";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";

/** Time out one lowercase run on the captured shorter deadline and report its name. */
const timedOutLimit = Effect.fn("PythonCaseCoverage.timedOutLimit")(function* (
  cleanDeadline: Duration.Duration,
  operationDeadline: Duration.Duration
) {
  const timer = yield* makeCitationNativeManualClock(Duration.min(cleanDeadline, operationDeadline));
  const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
  const { limits } = yield* defaultCitationEnginePolicy;
  const { lower } = yield* makeCitationPythonLower({ ...limits, cleanDeadline, operationDeadline }).pipe(
    Effect.provideService(Clock.Clock, timer.clock)
  );
  const pending = yield* lower({ width: 1, bytes: new Uint8Array(65_536).fill(65) }).pipe(
    Effect.provideService(Clock.Clock, disabled),
    Effect.forkChild
  );
  yield* timer.trigger;
  return yield* Fiber.join(pending).pipe(Effect.flip);
});

it.effect("names the operation deadline when it is not longer than the clean deadline", () =>
  Effect.gen(function* () {
    const shorter = yield* timedOutLimit(Duration.seconds(10), Duration.millis(997));
    expect(shorter).toMatchObject({ reason: "deadline-exceeded", limit: "operationDeadline" });
    const equal = yield* timedOutLimit(Duration.millis(997), Duration.millis(997));
    expect(equal).toMatchObject({ reason: "deadline-exceeded", limit: "operationDeadline" });
  })
);

it.effect("names the clean deadline when the operation deadline is longer", () =>
  Effect.gen(function* () {
    const failure = yield* timedOutLimit(Duration.millis(997), Duration.seconds(30));
    expect(failure).toMatchObject({ reason: "deadline-exceeded", limit: "cleanDeadline" });
  })
);

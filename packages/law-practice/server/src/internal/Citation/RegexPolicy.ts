/** Captured policy and timing shared by the private regex preparation stages.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const Limits = S.toType(CitationEngineLimits);
/** Decode the schema-owned policy with the caller's closed boundary failure.
 * @internal @category operations @since 0.0.0
 */
export const decodeCitationRegexPolicy = Effect.fn("Citation.decodeRegexPolicy")(function* <E>(
  policy: unknown,
  invalid: () => E
) {
  return yield* S.decodeUnknownEffect(Limits)(policy).pipe(Effect.mapError(invalid));
});

/** Capture Clock once and retain the existing choice of deadline precision.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexTiming = Effect.fn("Citation.makeRegexTiming")(function* (
  limits: typeof Limits.Type,
  millisecondPrecision: boolean
) {
  const clock = yield* Clock.Clock;
  const exact = Duration.min(limits.extractDeadline, limits.operationDeadline);
  const deadline = millisecondPrecision ? exact.pipe(Duration.toMillis, Duration.millis) : exact;
  const deadlineLimit = Duration.isLessThanOrEqualTo(limits.operationDeadline, limits.extractDeadline)
    ? ("operationDeadline" as const)
    : ("extractDeadline" as const);
  const timed = <A, E>(body: Effect.Effect<A, E>) =>
    body.pipe(
      Effect.timeoutOrElse({
        duration: deadline,
        orElse: () => Effect.fail(CitationSafetyLimitExceeded.make({ operation: "extract", limit: deadlineLimit })),
      }),
      Effect.provideService(Clock.Clock, clock)
    );
  const operationTimed = <A, E>(body: Effect.Effect<A, E>) =>
    body.pipe(
      Effect.timeoutOrElse({
        duration: limits.operationDeadline,
        orElse: () =>
          Effect.fail(CitationSafetyLimitExceeded.make({ operation: "extract", limit: "operationDeadline" })),
      }),
      Effect.provideService(Clock.Clock, clock)
    );
  return { deadline, deadlineLimit, timed, operationTimed };
});

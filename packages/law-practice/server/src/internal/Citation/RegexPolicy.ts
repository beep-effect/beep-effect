/** Captured policy and timing shared by the private regex preparation stages.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { CitationEngineOperation } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/RegexPolicy");
/** Trusted operation selected while installing regex capabilities; never read
 * from a later caller Context. Existing consumers default to extraction.
 * @internal @category services @since 0.0.0
 */
export const CitationRegexOperation = Context.Reference<CitationEngineOperation>($I`CitationRegexOperation`, {
  defaultValue: () => "extract",
});
const deadlineName = <Op extends CitationEngineOperation>(operation: Op): `${Op}Deadline` => `${operation}Deadline`;
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
  const operation = yield* CitationRegexOperation;
  const stageLimit = deadlineName(operation);
  const stageDeadline = limits[stageLimit];
  const exact = Duration.min(stageDeadline, limits.operationDeadline);
  const deadline = millisecondPrecision ? exact.pipe(Duration.toMillis, Duration.millis) : exact;
  const deadlineLimit = Duration.isLessThanOrEqualTo(limits.operationDeadline, stageDeadline)
    ? ("operationDeadline" as const)
    : stageLimit;
  const timed = <A, E>(body: Effect.Effect<A, E>) =>
    body.pipe(
      Effect.timeoutOrElse({
        duration: deadline,
        orElse: () => Effect.fail(CitationSafetyLimitExceeded.make({ operation, limit: deadlineLimit })),
      }),
      Effect.provideService(Clock.Clock, clock)
    );
  const operationTimed = <A, E>(body: Effect.Effect<A, E>) =>
    body.pipe(
      Effect.timeoutOrElse({
        duration: limits.operationDeadline,
        orElse: () => Effect.fail(CitationSafetyLimitExceeded.make({ operation, limit: "operationDeadline" })),
      }),
      Effect.provideService(Clock.Clock, clock)
    );
  const failSafety = (error: CitationSafetyLimitExceeded) =>
    Effect.fail(CitationSafetyLimitExceeded.make({ operation, limit: error.limit }));
  return { operation, deadline, deadlineLimit, timed, operationTimed, failSafety };
});

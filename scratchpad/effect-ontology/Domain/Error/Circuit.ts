/**
 * Schema-backed circuit-breaker and rate-limit failures.
 *
 * @remarks
 * Retry timing is normalized to `Option`, and message getters are pure views
 * over schema-owned fields. A zero-millisecond retry delay remains meaningful.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import type { TaggedErrorClassFromFields } from "@beep/schema";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Milliseconds, OptionalMilliseconds } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Circuit");

const CircuitOpenErrorFields = {
  resetTimeoutMs: Milliseconds.annotateKey({
    description: "Configured circuit reset delay in milliseconds.",
  }),
  lastFailureTime: OptionalMilliseconds.annotateKey({
    description: "Optional Unix epoch time of the last failure, normalized to Option.",
  }),
  retryAfterMs: OptionalMilliseconds.annotateKey({
    description: "Optional server-directed retry delay, normalized to Option.",
  }),
} satisfies S.Struct.Fields;

const makeCircuitOpenError = (
  input: S.Schema.Type<S.TaggedStruct<"CircuitOpenError", typeof CircuitOpenErrorFields>>
): CircuitOpenError => CircuitOpenError.make(input as never);

const CircuitOpenErrorBase: TaggedErrorClassFromFields<
  CircuitOpenError,
  "CircuitOpenError",
  typeof CircuitOpenErrorFields
> = TaggedErrorClass<CircuitOpenError>($I`CircuitOpenError`)("CircuitOpenError", CircuitOpenErrorFields, {
  ...$I.annote("CircuitOpenError", {
    description: "Failure raised when a circuit breaker rejects work while open.",
  }),
  toArbitrary:
    ([from]) =>
    () => ({
      arbitrary: from.arbitrary.map(makeCircuitOpenError),
      terminal: from.terminal?.map(makeCircuitOpenError),
    }),
});

/**
 * Failure raised when a circuit breaker rejects work while open.
 *
 * @remarks
 * `message` prefers a server-directed retry delay and otherwise reports the
 * configured reset timeout.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CircuitOpenError } from "@effect-ontology/Error/Circuit.ts"
 *
 * const error = S.decodeUnknownSync(CircuitOpenError)({ resetTimeoutMs: 5_000 })
 * console.log(error.message)
 * ```
 *
 * @invariant All timing fields are finite non-negative millisecond counts.
 * @category errors
 * @since 0.0.0
 */
export class CircuitOpenError extends CircuitOpenErrorBase {
  /**
   * Human-readable circuit state and retry delay.
   *
   * @example
   * ```ts
   * import { CircuitOpenError } from "@effect-ontology/Error/Circuit.ts"
   *
   * console.log(CircuitOpenError.make({ resetTimeoutMs: 250 }).message)
   * ```
   *
   * @returns A stable retry diagnostic derived from schema-owned timing fields.
   * @category errors
   * @since 0.0.0
   */
  override get message(): string {
    const retryMs = O.getOrElse(this.retryAfterMs, () => this.resetTimeoutMs);
    return `Circuit breaker is open. Will retry in ${retryMs}ms`;
  }
}

/**
 * Closed resource dimensions used by rate-limit policy.
 *
 * @example
 * ```ts
 * import { RateLimitReason } from "@effect-ontology/Error/Circuit.ts"
 *
 * console.log(RateLimitReason.is.tokens("tokens")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const RateLimitReason = LiteralKit(["tokens", "requests", "concurrent"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("tokens", "requests", "concurrent"),
  })
  .pipe(
    $I.annoteSchema("RateLimitReason", {
      description: "Closed resource dimension whose quota was exhausted.",
    })
  );

/**
 * Runtime value accepted by {@link RateLimitReason}.
 *
 * @example
 * ```ts
 * import type { RateLimitReason } from "@effect-ontology/Error/Circuit.ts"
 *
 * const reason: RateLimitReason = "requests"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RateLimitReason = typeof RateLimitReason.Type;

const RateLimitErrorFields = {
  reason: RateLimitReason.annotateKey({
    description: "Resource dimension whose quota was exhausted.",
  }),
  retryAfterMs: OptionalMilliseconds.annotateKey({
    description: "Optional server-directed retry delay, normalized to Option.",
  }),
} satisfies S.Struct.Fields;

const makeRateLimitError = (
  input: S.Schema.Type<S.TaggedStruct<"RateLimitError", typeof RateLimitErrorFields>>
): RateLimitError => RateLimitError.make(input as never);

const RateLimitErrorBase: TaggedErrorClassFromFields<RateLimitError, "RateLimitError", typeof RateLimitErrorFields> =
  TaggedErrorClass<RateLimitError>($I`RateLimitError`)("RateLimitError", RateLimitErrorFields, {
    ...$I.annote("RateLimitError", {
      description: "Failure raised when a token, request, or concurrency quota is exhausted.",
    }),
    toArbitrary:
      ([from]) =>
      () => ({
        arbitrary: from.arbitrary.map(makeRateLimitError),
        terminal: from.terminal?.map(makeRateLimitError),
      }),
  });

/**
 * Failure raised when a token, request, or concurrency quota is exhausted.
 *
 * @example
 * ```ts
 * import { RateLimitError } from "@effect-ontology/Error/Circuit.ts"
 *
 * const error = RateLimitError.make({ reason: "requests" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RateLimitError extends RateLimitErrorBase {
  /**
   * Human-readable exhausted quota and optional retry delay.
   *
   * @example
   * ```ts
   * import * as O from "effect/Option"
   * import { RateLimitError } from "@effect-ontology/Error/Circuit.ts"
   *
   * const error = RateLimitError.make({ reason: "tokens", retryAfterMs: O.some(0) })
   * console.log(error.message)
   * ```
   *
   * @returns A stable rate-limit diagnostic that preserves a zero delay.
   * @category errors
   * @since 0.0.0
   */
  override get message(): string {
    const base = `Rate limit exceeded: ${this.reason}`;
    return O.match(this.retryAfterMs, {
      onNone: () => base,
      onSome: (retryAfterMs) => `${base}, retry after ${retryAfterMs}ms`,
    });
  }
}

const CircuitErrorDefinition = S.Union([CircuitOpenError, RateLimitError]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of circuit-breaker policy failures.
 *
 * @example
 * ```ts
 * import { CircuitError, RateLimitError } from "@effect-ontology/Error/Circuit.ts"
 *
 * const error = RateLimitError.make({ reason: "concurrent" })
 * console.log(CircuitError.guards.RateLimitError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const CircuitError = CircuitErrorDefinition.pipe(
  $I.annoteSchema("CircuitError", {
    description: "Exhaustive tagged union of circuit-open and rate-limit failures.",
    toArbitrary: () => () => S.toArbitrary(CircuitErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link CircuitError}.
 *
 * @example
 * ```ts
 * import { RateLimitError, type CircuitError } from "@effect-ontology/Error/Circuit.ts"
 *
 * const error: CircuitError = RateLimitError.make({ reason: "tokens" })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CircuitError = typeof CircuitError.Type;

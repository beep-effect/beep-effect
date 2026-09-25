/**
 * Claim-local proof at the daily summary agent's provider boundary.
 *
 * **Details**
 *
 * Only the instrumented agent can certify a preparation failure. Mutable QA
 * evidence and exception type alone are never proof; the exact issued exception
 * must belong to the current claim and its irreversible dispatch latch be clear.
 * The Python context variable is the `active` argument. There is no service
 * and no driver.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { boolDefault, Model, optionalNull, pg } from "./Port.ts";

const $I = $ScratchpadId.create("beep/DailySweepDispatch");

/**
 * Closed reason a pre-dispatch failure may carry.
 *
 * **Details**
 *
 * Anything else is coerced to `daily_sweep_summary_agent`.
 *
 * **Example** (Decode the budget reason)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PreDispatchReason } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(PreDispatchReason)("daily_sweep_summary_input_budget"))
 * console.log(decoded) // "daily_sweep_summary_input_budget"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PreDispatchReason = LiteralKit([
  "daily_sweep_summary_input_budget",
  "daily_sweep_summary_agent",
  "source_locked_before_dispatch",
  "source_lock_check_unavailable",
]).pipe(
  $I.annoteSchema("PreDispatchReason", {
    description: "Closed reason a certified daily-sweep preparation failure may carry.",
  }),
);

/**
 * Decoded pre-dispatch reason.
 *
 * @see {@link PreDispatchReason} for the runtime literal set.
 * @category type-level
 * @since 0.0.0
 */
export type PreDispatchReason = typeof PreDispatchReason.Type;

const decodeUnknownOptionPreDispatchReason = S.decodeUnknownOption(PreDispatchReason);

/**
 * Extraction failure that can name its extractor.
 *
 * **Details**
 *
 * A strict memory extraction failed before producing a valid batch. This is
 * the extraction boundary's own contract. Callers catch it without importing
 * an LLM client. Only `extractor` is read by certification.
 *
 * **Example** (Name an extractor)
 *
 * ```ts
 * import { MemoryExtractionFailure } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const error = new MemoryExtractionFailure({
 *   extractor: "daily_sweep_summary_input_budget",
 *   message: "daily_sweep_summary_input_budget failed before producing a valid extraction result",
 * })
 * console.log(error.extractor) // "daily_sweep_summary_input_budget"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MemoryExtractionFailure extends S.TaggedError<MemoryExtractionFailure>()(
  "MemoryExtractionError",
  {
    extractor: S.String,
    message: S.String,
  },
  $I.annoteError<MemoryExtractionFailure>("MemoryExtractionError", {
    description: "A strict memory extraction failed before producing a valid batch.",
  }),
) {}

/**
 * Encoded form of {@link MemoryExtractionFailure}.
 *
 * @see {@link MemoryExtractionFailure} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryExtractionFailure {
  export type Encoded = S.Codec.Encoded<typeof MemoryExtractionFailure>;
}

const isMemoryExtractionFailure = S.is(MemoryExtractionFailure);

/**
 * Typed signal accepted only with its issuing claim's live proof.
 *
 * **Details**
 *
 * A typed signal, accepted only with its issuing claim's live proof. `extractor`
 * is one of the closed reasons. The message defaults to the Python
 * `MemoryExtractionError` text.
 *
 * **Example** (Issue a certified error)
 *
 * ```ts
 * import { makeSweepPreDispatchError } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const error = makeSweepPreDispatchError("daily_sweep_summary_agent")
 * console.log(error.extractor) // "daily_sweep_summary_agent"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SweepPreDispatchError extends S.TaggedError<SweepPreDispatchError>()(
  "SweepPreDispatchError",
  {
    extractor: PreDispatchReason,
    message: S.String,
  },
  $I.annoteError<SweepPreDispatchError>("SweepPreDispatchError", {
    description: "A typed signal, accepted only with its issuing claim's live proof.",
  }),
) {}

/**
 * Encoded form of {@link SweepPreDispatchError}.
 *
 * @see {@link SweepPreDispatchError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SweepPreDispatchError {
  export type Encoded = S.Codec.Encoded<typeof SweepPreDispatchError>;
}

const isSweepPreDispatchError = S.is(SweepPreDispatchError);

/**
 * Builds the certified error for a closed reason.
 *
 * **Example** (Use the default message)
 *
 * ```ts
 * import { makeSweepPreDispatchError } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const error = makeSweepPreDispatchError("source_locked_before_dispatch")
 * console.log(error.message) // "source_locked_before_dispatch failed before producing a valid extraction result"
 * ```
 *
 * @see {@link SweepPreDispatchError} for the error schema.
 * @category constructors
 * @since 0.0.0
 */
export const makeSweepPreDispatchError = (reason: PreDispatchReason): SweepPreDispatchError =>
  SweepPreDispatchError.make({
    extractor: reason,
    message: `${reason} failed before producing a valid extraction result`,
  });

/**
 * The scope was reset before it was entered.
 *
 * **Example** (Build the token error)
 *
 * ```ts
 * import { SweepDispatchTokenError } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const error = new SweepDispatchTokenError({ message: "sweep dispatch scope has no token" })
 * console.log(error._tag) // "SweepDispatchTokenError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SweepDispatchTokenError extends S.TaggedError<SweepDispatchTokenError>()(
  "SweepDispatchTokenError",
  { message: S.String },
  $I.annoteError<SweepDispatchTokenError>("SweepDispatchTokenError", {
    description: "A sweep dispatch scope was exited before it was entered.",
  }),
) {}

/**
 * Encoded form of {@link SweepDispatchTokenError}.
 *
 * @see {@link SweepDispatchTokenError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SweepDispatchTokenError {
  export type Encoded = S.Codec.Encoded<typeof SweepDispatchTokenError>;
}

/**
 * One claim's dispatch latch and issued proof.
 *
 * **Details**
 *
 * `dispatched` is the irreversible latch. `issued` is the exact error object
 * this claim certified. `reason` is that error's closed reason. `tokenHeld`
 * records that the scope was entered. The pre-dispatch callback is not a
 * column; pass it to {@link markProviderDispatch}.
 *
 * **Gotchas**
 *
 * Proof is reference equality with `issued`. Decoding a copy of the error
 * does not prove the claim.
 *
 * **Example** (Construct a clear latch)
 *
 * ```ts
 * import { SweepDispatchScope } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const scope = SweepDispatchScope.make({})
 * console.log(scope.dispatched) // false
 * console.log(scope.tokenHeld) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SweepDispatchScope extends Model<SweepDispatchScope>("SweepDispatchScope")(
  {
    dispatched: boolDefault("dispatched", false),
    issued: SweepPreDispatchError.pipe(optionalNull, pg.jsonb(), pg.columnName("issued")),
    reason: PreDispatchReason.pipe(optionalNull, pg.text(), pg.columnName("reason")),
    tokenHeld: boolDefault("token_held", false),
  },
  $I.annote("SweepDispatchScope", {
    description: "Claim-local dispatch latch and the exact pre-dispatch error it issued.",
  }),
) {}

/**
 * Encoded form of {@link SweepDispatchScope}.
 *
 * @see {@link SweepDispatchScopeWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SweepDispatchScope {
  export type Encoded = S.Codec.Encoded<typeof SweepDispatchScope>;
}

/**
 * Snake_case codec for {@link SweepDispatchScope}.
 *
 * **Example** (Decode a clear scope)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SweepDispatchScopeWire } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(SweepDispatchScopeWire)({
 *     dispatched: false,
 *     issued: null,
 *     reason: null,
 *     token_held: false,
 *   }),
 * )
 * console.log(O.isNone(decoded.issued)) // true
 * ```
 *
 * @see {@link SweepDispatchScope} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const SweepDispatchScopeWire = SweepDispatchScope.pipe(S.encodeKeys({ tokenHeld: "token_held" }));

const copyScope = (patch: {
  readonly dispatched: boolean;
  readonly issued: O.Option<SweepPreDispatchError>;
  readonly reason: O.Option<PreDispatchReason>;
  readonly tokenHeld: boolean;
}): SweepDispatchScope => SweepDispatchScope.make(patch);

const withPatch = (
  scope: SweepDispatchScope,
  patch: {
    readonly dispatched?: boolean;
    readonly issued?: O.Option<SweepPreDispatchError>;
    readonly reason?: O.Option<PreDispatchReason>;
    readonly tokenHeld?: boolean;
  },
): SweepDispatchScope =>
  copyScope({
    dispatched: patch.dispatched === undefined ? scope.dispatched : patch.dispatched,
    issued: patch.issued === undefined ? scope.issued : patch.issued,
    reason: patch.reason === undefined ? scope.reason : patch.reason,
    tokenHeld: patch.tokenHeld === undefined ? scope.tokenHeld : patch.tokenHeld,
  });

/**
 * Enters the claim, recording that a token is held.
 *
 * **Example** (Enter a scope)
 *
 * ```ts
 * import { SweepDispatchScope, enterSweepDispatch } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * console.log(enterSweepDispatch(SweepDispatchScope.make({})).tokenHeld) // true
 * ```
 *
 * @see {@link exitSweepDispatch} for the matching reset.
 * @category constructors
 * @since 0.0.0
 */
export const enterSweepDispatch = (scope: SweepDispatchScope): SweepDispatchScope =>
  withPatch(scope, { tokenHeld: true });

/**
 * Leaves the claim. Fails when enter was not called.
 *
 * **Details**
 *
 * Python asserts a token exists and resets the context variable. The exit
 * does not swallow the caller's exception.
 *
 * **Example** (Reject an exit without a token)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { SweepDispatchScope, exitSweepDispatch } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const failed = Effect.runSyncExit(exitSweepDispatch(SweepDispatchScope.make({})))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @see {@link enterSweepDispatch} for the matching enter.
 * @category constructors
 * @since 0.0.0
 */
export const exitSweepDispatch = Effect.fn("SweepDispatchScope.exit")(function* (scope: SweepDispatchScope) {
  if (!scope.tokenHeld) {
    return yield* SweepDispatchTokenError.make({ message: "sweep dispatch scope has no token" });
  }
  return withPatch(scope, { tokenHeld: false });
});

/**
 * True only when `error` is the exact object this claim issued and the latch is clear.
 *
 * **Example** (Reject a lookalike error)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import {
 *   SweepDispatchScope,
 *   makeSweepPreDispatchError,
 *   provesPreDispatch,
 * } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const issued = makeSweepPreDispatchError("daily_sweep_summary_agent")
 * const scope = SweepDispatchScope.make({ issued: O.some(issued), reason: O.some(issued.extractor) })
 * console.log(provesPreDispatch(scope, issued)) // true
 * console.log(provesPreDispatch(scope, makeSweepPreDispatchError("daily_sweep_summary_agent"))) // false
 * ```
 *
 * **Example** (Check the proof in a pipeline)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import {
 *   SweepDispatchScope,
 *   makeSweepPreDispatchError,
 *   provesPreDispatch,
 * } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const issued = makeSweepPreDispatchError("daily_sweep_summary_agent")
 * const scope = SweepDispatchScope.make({ issued: O.some(issued), reason: O.some(issued.extractor) })
 * console.log(pipe(scope, provesPreDispatch(issued))) // true
 * ```
 *
 * @see {@link preDispatchReason} for the reason that proof unlocks.
 * @category predicates
 * @since 0.0.0
 */
export const provesPreDispatch: {
  (error: unknown): (scope: SweepDispatchScope) => boolean;
  (scope: SweepDispatchScope, error: unknown): boolean;
} = dual(
  2,
  (scope: SweepDispatchScope, error: unknown): boolean =>
    !scope.dispatched && O.isSome(scope.issued) && scope.issued.value === error,
);

/**
 * Returns the stored reason when {@link provesPreDispatch} is true.
 *
 * **Example** (Hide the reason after dispatch)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import {
 *   SweepDispatchScope,
 *   makeSweepPreDispatchError,
 *   preDispatchReason,
 * } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const issued = makeSweepPreDispatchError("source_lock_check_unavailable")
 * const scope = SweepDispatchScope.make({
 *   dispatched: true,
 *   issued: O.some(issued),
 *   reason: O.some("source_lock_check_unavailable"),
 * })
 * console.log(O.isNone(preDispatchReason(scope, issued))) // true
 * ```
 *
 * @see {@link provesPreDispatch} for the identity check.
 * @category getters
 * @since 0.0.0
 */
export const preDispatchReason: {
  (error: unknown): (scope: SweepDispatchScope) => O.Option<PreDispatchReason>;
  (scope: SweepDispatchScope, error: unknown): O.Option<PreDispatchReason>;
} = dual(
  2,
  (scope: SweepDispatchScope, error: unknown): O.Option<PreDispatchReason> =>
    provesPreDispatch(scope, error) ? scope.reason : O.none(),
);

/**
 * Latches provider dispatch on the active scope.
 *
 * **Details**
 *
 * Latch before recording request evidence or entering any provider call. When
 * a scope is active, the callback runs first and then the latch is set. No
 * active scope is a no-op and does not call the callback.
 *
 * **Example** (Run the callback then latch)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { SweepDispatchScope, markProviderDispatch } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * let ran = false
 * const next = markProviderDispatch(O.some(SweepDispatchScope.make({})), O.some(() => {
 *   ran = true
 * }))
 * console.log(ran) // true
 * console.log(O.getOrElse(next, () => SweepDispatchScope.make({})).dispatched) // true
 * ```
 *
 * **Example** (Latch in a pipeline without a callback)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import { SweepDispatchScope, markProviderDispatch } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const next = pipe(O.some(SweepDispatchScope.make({})), markProviderDispatch(O.none()))
 * console.log(O.getOrElse(next, () => SweepDispatchScope.make({})).dispatched) // true
 * ```
 *
 * @see {@link certifyPreDispatch} for the failure path this latch blocks.
 * @category constructors
 * @since 0.0.0
 */
export const markProviderDispatch: {
  (before: O.Option<() => void>): (active: O.Option<SweepDispatchScope>) => O.Option<SweepDispatchScope>;
  (active: O.Option<SweepDispatchScope>, before: O.Option<() => void>): O.Option<SweepDispatchScope>;
} = dual(
  2,
  (active: O.Option<SweepDispatchScope>, before: O.Option<() => void>): O.Option<SweepDispatchScope> =>
    O.map(active, (scope) => {
      if (O.isSome(before)) before.value();
      return withPatch(scope, { dispatched: true });
    }),
);

const coerceReason = (error: unknown): PreDispatchReason => {
  const candidate =
    isMemoryExtractionFailure(error) || isSweepPreDispatchError(error)
      ? error.extractor
      : "daily_sweep_summary_agent";
  const decoded = decodeUnknownOptionPreDispatchReason(candidate);
  return O.getOrElse(decoded, () => "daily_sweep_summary_agent");
};

/**
 * Certified failure, including the updated scope.
 *
 * **Details**
 *
 * The issued error and `scope.issued` are the same object. `causeMessage`
 * keeps the original failure text without logging provider payloads.
 *
 * **Example** (Read the certified reason)
 *
 * ```ts
 * import { CertifiedSweepFailure, makeSweepPreDispatchError, SweepDispatchScope } from "@beep/scratchpad/beep/DailySweepDispatch"
 * import * as O from "effect/Option"
 *
 * const issued = makeSweepPreDispatchError("daily_sweep_summary_agent")
 * const error = new CertifiedSweepFailure({
 *   reason: issued.extractor,
 *   issued,
 *   scope: SweepDispatchScope.make({ issued: O.some(issued), reason: O.some(issued.extractor) }),
 *   causeMessage: "budget",
 * })
 * console.log(error.reason) // "daily_sweep_summary_agent"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CertifiedSweepFailure extends S.TaggedError<CertifiedSweepFailure>()(
  "CertifiedSweepFailure",
  {
    reason: PreDispatchReason,
    issued: SweepPreDispatchError,
    scope: SweepDispatchScope,
    causeMessage: S.String,
  },
  $I.annoteError<CertifiedSweepFailure>("CertifiedSweepFailure", {
    description: "A preparation failure certified by the active sweep claim.",
  }),
) {}

/**
 * Encoded form of {@link CertifiedSweepFailure}.
 *
 * @see {@link CertifiedSweepFailure} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CertifiedSweepFailure {
  export type Encoded = S.Codec.Encoded<typeof CertifiedSweepFailure>;
}

/**
 * Wraps the instrumented summary agent.
 *
 * **Details**
 *
 * Wrap only the instrumented summary agent, never an arbitrary builder. On
 * success the active scope is unchanged. When no scope is active, or the latch
 * is already set, the original failure is re-raised. Otherwise a new
 * {@link SweepPreDispatchError} is stored on the scope and raised inside
 * {@link CertifiedSweepFailure}. An extraction error contributes its
 * `extractor` when that string is one of the closed reasons.
 *
 * **Example** (Certify a preparation failure)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { SweepDispatchScope, certifyPreDispatch } from "@beep/scratchpad/beep/DailySweepDispatch"
 *
 * const failed = Effect.runSyncExit(
 *   certifyPreDispatch(O.some(SweepDispatchScope.make({})), Effect.fail("budget")),
 * )
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @see {@link markProviderDispatch} for the latch that blocks certification.
 * @category error-handling
 * @since 0.0.0
 */
export const certifyPreDispatch = Effect.fn("SweepDispatchScope.certifyPreDispatch")(function* (
  active: O.Option<SweepDispatchScope>,
  run: Effect.Effect<unknown, MemoryExtractionFailure | SweepPreDispatchError>,
) {
  const exit = yield* Effect.exit(run);
  if (Exit.isSuccess(exit)) return { scope: active, value: exit.value };
  const failed = Cause.findErrorOption(exit.cause);
  if (O.isNone(failed)) return yield* Effect.failCause(exit.cause);
  const error = failed.value;
  const scope = O.getOrUndefined(active);
  if (scope === undefined || scope.dispatched) return yield* error;
  const reason = coerceReason(error);
  const issued = makeSweepPreDispatchError(reason);
  const next = withPatch(scope, { issued: O.some(issued), reason: O.some(reason) });
  const causeMessage = isMemoryExtractionFailure(error) ? error.message : "preparation failed";
  return yield* CertifiedSweepFailure.make({ reason, issued, scope: next, causeMessage });
});

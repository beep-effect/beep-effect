/**
 * Transport-safe schemas for serializing Effect errors, defects, causes, and exits.
 *
 * These schemas annotate the core `S.Error`, `S.Defect`, `S.Cause`, and `S.Exit`
 * schemas with identity metadata for the observability package.
 *
 * @example
 * ```typescript
 * import { Cause } from "effect"
 * import * as S from "effect/Schema"
 * import { ObservedCause } from "@beep/observability"
 *
 * const decodeCause = S.decodeUnknownSync(ObservedCause)
 * const observed = decodeCause(Cause.fail(new Error("boom")))
 * console.log(Cause.pretty(observed).includes("boom")) // true
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ObservabilityId.create("Observed");

/**
 * A transport-safe schema for expected errors (message only, no stack).
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { ObservedError } from "@beep/observability"
 *
 * const decode = S.decodeUnknownSync(ObservedError)
 * const err = decode({ message: "boom" })
 * console.log(err.message) // "boom"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const ObservedError = S.instanceOf(Error).pipe(
  $I.annoteSchema("ObservedError", {
    description: "A transport-safe schema for expected errors.",
  })
);

/**
 * Runtime type for {@link ObservedError}.
 *
 * @example
 * ```typescript
 * import type { ObservedError } from "@beep/observability"
 *
 * const readMessage = (error: ObservedError) => error.message
 * console.log(readMessage)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservedError = typeof ObservedError.Type;

/**
 * A transport-safe schema for expected errors that preserves stacks.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { ObservedErrorWithStack } from "@beep/observability"
 *
 * const decode = S.decodeUnknownSync(ObservedErrorWithStack)
 * const err = decode(new Error("boom"))
 * console.log(err.message) // "boom"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const ObservedErrorWithStack = S.instanceOf(Error).pipe(
  $I.annoteSchema("ObservedErrorWithStack", {
    description: "A transport-safe schema for expected errors that preserves stacks.",
  })
);

/**
 * Runtime type for {@link ObservedErrorWithStack}.
 *
 * @example
 * ```typescript
 * import type { ObservedErrorWithStack } from "@beep/observability"
 *
 * const readStack = (error: ObservedErrorWithStack) => error.stack
 * console.log(readStack)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservedErrorWithStack = typeof ObservedErrorWithStack.Type;

/**
 * A transport-safe schema for defects.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { ObservedDefect } from "@beep/observability"
 *
 * const decode = S.decodeUnknownSync(ObservedDefect)
 * const defect = decode("unexpected crash")
 * console.log(defect)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const ObservedDefect = S.Defect().pipe(
  $I.annoteSchema("ObservedDefect", {
    description: "A transport-safe schema for defects.",
  })
);

/**
 * Runtime type for {@link ObservedDefect}.
 *
 * @example
 * ```typescript
 * import type { ObservedDefect } from "@beep/observability"
 *
 * const keepDefect = (defect: ObservedDefect) => defect
 * console.log(keepDefect)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservedDefect = typeof ObservedDefect.Type;

/**
 * A transport-safe schema for defects that preserves stacks when possible.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { ObservedDefectWithStack } from "@beep/observability"
 *
 * const decode = S.decodeUnknownSync(ObservedDefectWithStack)
 * const defect = decode(new Error("unexpected crash"))
 * console.log(defect)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const ObservedDefectWithStack = S.Defect({ includeStack: true }).pipe(
  $I.annoteSchema("ObservedDefectWithStack", {
    description: "A transport-safe schema for defects that preserves stacks when possible.",
  })
);

/**
 * Runtime type for {@link ObservedDefectWithStack}.
 *
 * @example
 * ```typescript
 * import type { ObservedDefectWithStack } from "@beep/observability"
 *
 * const keepDefect = (defect: ObservedDefectWithStack) => defect
 * console.log(keepDefect)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservedDefectWithStack = typeof ObservedDefectWithStack.Type;

/**
 * One serialized failure reason from a Cause.
 *
 * @example
 * ```typescript
 * import { Cause } from "effect"
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { ObservedCauseReason } from "@beep/observability"
 *
 * const decodeReason = S.decodeUnknownSync(ObservedCauseReason)
 * const decoded = A.map(Cause.fail(new Error("boom")).reasons, (reason) => decodeReason(reason))
 * console.log(decoded.length) // 1
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const ObservedCauseReason = S.CauseReason(ObservedErrorWithStack, ObservedDefectWithStack).pipe(
  $I.annoteSchema("ObservedCauseReason", {
    description: "One serialized failure reason from a Cause.",
  })
);

/**
 * Runtime type for {@link ObservedCauseReason}.
 *
 * @example
 * ```typescript
 * import type { ObservedCauseReason } from "@beep/observability"
 *
 * const keepReason = (reason: ObservedCauseReason) => reason
 * console.log(keepReason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservedCauseReason = typeof ObservedCauseReason.Type;

/**
 * A transport-safe schema for full Effect causes.
 *
 * @example
 * ```typescript
 * import { Cause } from "effect"
 * import * as S from "effect/Schema"
 * import { ObservedCause } from "@beep/observability"
 *
 * const observed = S.decodeUnknownSync(ObservedCause)(Cause.fail(new Error("boom")))
 * console.log(Cause.pretty(observed).includes("boom")) // true
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const ObservedCause = S.Cause(ObservedErrorWithStack, ObservedDefectWithStack).pipe(
  $I.annoteSchema("ObservedCause", {
    description: "A transport-safe schema for full Effect causes.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ObservedCause}.
 *
 * @example
 * ```typescript
 * import type { ObservedCause } from "@beep/observability"
 *
 * const keepCause = (cause: ObservedCause) => cause
 * console.log(keepCause)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservedCause = typeof ObservedCause.Type;

/**
 * A transport-safe schema for exits carrying unknown success values.
 *
 * @example
 * ```typescript
 * import { Exit } from "effect"
 * import * as S from "effect/Schema"
 * import { ObservedExit } from "@beep/observability"
 *
 * const observed = S.decodeUnknownSync(ObservedExit)(Exit.fail(new Error("boom")))
 * console.log(observed._tag) // "Failure"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const ObservedExit = S.Exit(S.Unknown, ObservedErrorWithStack, ObservedDefectWithStack).pipe(
  $I.annoteSchema("ObservedExit", {
    description: "A transport-safe schema for exits carrying unknown success values.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ObservedExit}.
 *
 * @example
 * ```typescript
 * import type { ObservedExit } from "@beep/observability"
 *
 * const keepExit = (exit: ObservedExit) => exit
 * console.log(keepExit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservedExit = typeof ObservedExit.Type;

/**
 * Transport-safe schemas for serializing Effect errors, defects, causes, and exits.
 *
 * **Details**
 *
 * These schemas annotate the core `S.Error`, `S.Defect`, `S.Cause`, and `S.Exit`
 * schemas with identity metadata for the observability package.
 *
 * **Example** (Decode ObservedCause from fail)
 *
 * ```ts import.meta.vitest name="Decode ObservedCause from fail"
 * import { Cause } from "effect"
 * import * as S from "effect/Schema"
 * import { ObservedCause } from "@beep/observability"
 *
 * const decodeCause = S.decodeUnknownSync(ObservedCause)
 * const observed = decodeCause(Cause.fail(new Error("boom")))
 * Cause.pretty(observed).includes("boom") // => true
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
 * **Example** (Decode message-only error)
 *
 * ```ts import.meta.vitest name="Decode message-only error"
 * import * as S from "effect/Schema"
 * import { ObservedError } from "@beep/observability"
 *
 * const decode = S.decodeUnknownSync(ObservedError)
 * const err = decode(new Error("boom"))
 * err.message // => "boom"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservedError = S.ErrorInstance().pipe(
  $I.annoteSchema("ObservedError", {
    description: "A transport-safe schema for expected errors.",
  })
);

/**
 * Runtime type for {@link ObservedError}.
 *
 * **Example** (Access ObservedError message)
 *
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
 * **Example** (Decode error preserving stack)
 *
 * ```ts import.meta.vitest name="Decode error preserving stack"
 * import * as S from "effect/Schema"
 * import { ObservedErrorWithStack } from "@beep/observability"
 *
 * const decode = S.decodeUnknownSync(ObservedErrorWithStack)
 * const err = decode(new Error("boom"))
 * err.message // => "boom"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservedErrorWithStack = S.ErrorInstance({ includeStack: true }).pipe(
  $I.annoteSchema("ObservedErrorWithStack", {
    description: "A transport-safe schema for expected errors that preserves stacks.",
  })
);

/**
 * Runtime type for {@link ObservedErrorWithStack}.
 *
 * **Example** (Access error stack property)
 *
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
 * **Example** (Decode string defect value)
 *
 * ```typescript
 * import * as S from "effect/Schema"
 * import { ObservedDefect } from "@beep/observability"
 *
 * const decode = S.decodeUnknownSync(ObservedDefect)
 * const defect = decode("unexpected crash")
 * console.log(defect)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservedDefect = S.Defect().pipe(
  $I.annoteSchema("ObservedDefect", {
    description: "A transport-safe schema for defects.",
  })
);

/**
 * Runtime type for {@link ObservedDefect}.
 *
 * **Example** (Pass through ObservedDefect)
 *
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
 * **Example** (Decode Error as defect)
 *
 * ```typescript
 * import * as S from "effect/Schema"
 * import { ObservedDefectWithStack } from "@beep/observability"
 *
 * const decode = S.decodeUnknownSync(ObservedDefectWithStack)
 * const defect = decode(new Error("unexpected crash"))
 * console.log(defect)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservedDefectWithStack = S.Defect({ includeStack: true }).pipe(
  $I.annoteSchema("ObservedDefectWithStack", {
    description: "A transport-safe schema for defects that preserves stacks when possible.",
  })
);

/**
 * Runtime type for {@link ObservedDefectWithStack}.
 *
 * **Example** (Pass through stacked defect)
 *
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
 * **Example** (Decode Cause failure reasons)
 *
 * ```ts import.meta.vitest name="Decode Cause failure reasons"
 * import { Cause } from "effect"
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { ObservedCauseReason } from "@beep/observability"
 *
 * const decodeReason = S.decodeUnknownSync(ObservedCauseReason)
 * const decoded = A.map(Cause.fail(new Error("boom")).reasons, (reason) => decodeReason(reason))
 * decoded.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservedCauseReason = S.CauseReason(ObservedErrorWithStack, ObservedDefectWithStack).pipe(
  $I.annoteSchema("ObservedCauseReason", {
    description: "One serialized failure reason from a Cause.",
  })
);

/**
 * Runtime type for {@link ObservedCauseReason}.
 *
 * **Example** (Pass through cause reason)
 *
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
 * **Example** (Decode full Effect cause)
 *
 * ```ts import.meta.vitest name="Decode full Effect cause"
 * import { Cause } from "effect"
 * import * as S from "effect/Schema"
 * import { ObservedCause } from "@beep/observability"
 *
 * const observed = S.decodeUnknownSync(ObservedCause)(Cause.fail(new Error("boom")))
 * Cause.pretty(observed).includes("boom") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Pass through ObservedCause)
 *
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
 * **Example** (Decode failed Exit value)
 *
 * ```ts import.meta.vitest name="Decode failed Exit value"
 * import { Exit } from "effect"
 * import * as S from "effect/Schema"
 * import { ObservedExit } from "@beep/observability"
 *
 * const observed = S.decodeUnknownSync(ObservedExit)(Exit.fail(new Error("boom")))
 * observed._tag // => "Failure"
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Pass through ObservedExit)
 *
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

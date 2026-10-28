/**
 * Read-only retention ports.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicUseCasesId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import type { RetentionCalibration, RetentionQuery, RetentionSnapshot } from "@beep/epistemic-domain/values/Retention";
import type * as O from "effect/Option";

const $I = $EpistemicUseCasesId.create("Retention/Retention.ports");

/**
 * Sanitized failure of a retention read or disposable artifact operation.
 *
 * **Example** (Construct a boundary failure)
 * ```ts
 * import { RetentionUnavailable } from "@beep/epistemic-use-cases/Retention"
 * console.log(RetentionUnavailable.make({ operation: "read", message: "Authority unavailable" })._tag)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class RetentionUnavailable extends S.TaggedError<RetentionUnavailable, { readonly brand: unique symbol }>()(
  "RetentionUnavailable",
  { operation: S.NonEmptyString, message: S.NonEmptyString },
  $I.annote("RetentionUnavailable", { description: "Sanitized retention boundary failure." })
) {}

/**
 * Scoped snapshot reader; exposes no authority mutation methods.
 *
 * **Example** (Inspect the reader tag)
 * ```ts
 * import { RetentionAuthorityReader } from "@beep/epistemic-use-cases/Retention"
 * console.log(RetentionAuthorityReader.key)
 * ```
 * @category ports
 * @since 0.0.0
 */
export class RetentionAuthorityReader extends Context.Service<
  RetentionAuthorityReader,
  {
    readonly read: (query: RetentionQuery) => Effect.Effect<RetentionSnapshot, RetentionUnavailable>;
  }
>()($I`RetentionAuthorityReader`) {}

/**
 * Trusted deployment registry for approved calibration receipts; never populate from report request JSON.
 *
 * **Details**
 * Registry owners verify evidence quality, approval authenticity, dataset accounting and receipt revocation.
 * A matching schema is necessary but cannot establish those facts. The shipped layer admits no policy.
 *
 * **Example** (Use the inert registry)
 * ```ts
 * import { RetentionCalibrationRegistry } from "@beep/epistemic-use-cases/Retention"
 * console.log(RetentionCalibrationRegistry.inert)
 * ```
 * @category ports
 * @since 0.0.0
 */
export class RetentionCalibrationRegistry extends Context.Service<
  RetentionCalibrationRegistry,
  {
    readonly find: (
      policyDigest: string,
      query: RetentionQuery
    ) => Effect.Effect<O.Option<RetentionCalibration>, RetentionUnavailable>;
  }
>()($I`RetentionCalibrationRegistry`) {
  static readonly inert = Layer.succeed(RetentionCalibrationRegistry, {
    find: Effect.fn("RetentionCalibrationRegistry.find")(() => Effect.succeedNone),
  });
}

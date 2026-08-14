/**
 * Typed errors for the graph-3d render driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $Graph3dId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { P } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $Graph3dId.create("Graph3D.errors");

/**
 * Graph-3d driver failure reason.
 *
 * **Example** (Assign webglUnavailable reason)
 *
 * ```ts
 * import { Graph3DDriverErrorReason } from "@beep/graph-3d"
 *
 * const reason: Graph3DDriverErrorReason = "webglUnavailable"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const Graph3DDriverErrorReason = LiteralKit([
  "importFailed",
  "webglUnavailable",
  "adapterInvariant",
  "renderFailed",
]).annotate(
  $I.annote("Graph3DDriverErrorReason", {
    description: "Failure reason emitted by the graph-3d render driver.",
  })
);

/**
 * Type for {@link Graph3DDriverErrorReason}.
 *
 * **Example** (Assign renderFailed reason)
 *
 * ```ts
 * import { Graph3DDriverErrorReason } from "@beep/graph-3d"
 *
 * const reason: Graph3DDriverErrorReason = "renderFailed"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type Graph3DDriverErrorReason = typeof Graph3DDriverErrorReason.Type;

/**
 * Typed graph-3d driver error.
 *
 * **Example** (Make Graph3DDriverError instance)
 *
 * ```ts
 * import { Graph3DDriverError } from "@beep/graph-3d"
 *
 * const error = Graph3DDriverError.make({
 *   reason: "renderFailed",
 *   message: "Unable to mount the 3D graph renderer."
 * })
 *
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class Graph3DDriverError extends S.TaggedError<Graph3DDriverError>($I`Graph3DDriverError`)(
  "Graph3DDriverError",
  {
    reason: Graph3DDriverErrorReason,
    message: S.String,
  },
  $I.annote("Graph3DDriverError", {
    description: "Typed error raised by the instanced three.js graph render adapter.",
  })
) {
  /** Creates an adapter-invariant failure for an invalid runtime state. */
  static readonly adapterInvariant = (message: string): Graph3DDriverError =>
    Graph3DDriverError.make({
      reason: "adapterInvariant",
      message,
    });

  /** Maps an unknown runtime failure into the driver's typed error channel. */
  static readonly fromUnknown =
    (reason: Graph3DDriverErrorReason) =>
    (fallback: string) =>
    (cause: unknown): Graph3DDriverError =>
      Graph3DDriverError.make({
        reason,
        message: P.hasProperty(cause, "message") && P.isString(cause.message) ? cause.message : fallback,
      });
}

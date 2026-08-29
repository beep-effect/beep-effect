/**
 * N3 driver typed errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $N3Id } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $N3Id.create("N3.errors");

/**
 * N3 Turtle codec failure reason.
 *
 * **Example** (Decode serializeFailed reason)
 *
 * ```ts
 * import { N3TurtleCodecErrorReason } from "@beep/n3"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeUnknownSync(N3TurtleCodecErrorReason)("serializeFailed")
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const N3TurtleCodecErrorReason = LiteralKit(["parseFailed", "serializeFailed", "unsupportedGraph"]).pipe(
  $I.annoteSchema("N3TurtleCodecErrorReason", {
    description: "N3 Turtle codec failure reason.",
  })
);

/**
 * Type for {@link N3TurtleCodecErrorReason}.
 *
 * **Example** (Annotate unsupportedGraph reason)
 *
 * ```ts
 * import { N3TurtleCodecErrorReason } from "@beep/n3"
 *
 * const reason: N3TurtleCodecErrorReason = "unsupportedGraph"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type N3TurtleCodecErrorReason = typeof N3TurtleCodecErrorReason.Type;

/**
 * Typed N3 Turtle codec error.
 *
 * **Example** (Create parseFailed codec error)
 *
 * ```ts
 * import { N3TurtleCodecError } from "@beep/n3"
 *
 * const error = N3TurtleCodecError.make({
 *   reason: "parseFailed",
 *   message: "N3 rejected the Turtle source."
 * })
 *
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class N3TurtleCodecError extends S.TaggedError<N3TurtleCodecError>($I`N3TurtleCodecError`)(
  "N3TurtleCodecError",
  {
    reason: N3TurtleCodecErrorReason,
    message: S.String,
  },
  $I.annoteError<N3TurtleCodecError>("N3TurtleCodecError", {
    description: "Typed N3 Turtle codec error.",
  })
) {}

/**
 * N3 driver typed errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import * as S from "effect/Schema";

const { $N3Id } = makeIdentity("n3");
const $I = $N3Id.create("N3.errors");

/**
 * N3 Turtle codec failure reason.
 *
 * @since 0.0.0
 * @category errors
 */
export const N3TurtleCodecErrorReason = LiteralKit(["parseFailed", "serializeFailed", "unsupportedGraph"]).pipe(
  $I.annoteSchema("N3TurtleCodecErrorReason", {
    description: "N3 Turtle codec failure reason.",
  })
);

/**
 * Type for {@link N3TurtleCodecErrorReason}.
 *
 * @since 0.0.0
 * @category errors
 */
export type N3TurtleCodecErrorReason = typeof N3TurtleCodecErrorReason.Type;

/**
 * Typed N3 Turtle codec error.
 *
 * @since 0.0.0
 * @category errors
 */
export class N3TurtleCodecError extends TaggedErrorClass<N3TurtleCodecError>($I`N3TurtleCodecError`)(
  "N3TurtleCodecError",
  {
    reason: N3TurtleCodecErrorReason,
    message: S.String,
  },
  $I.annote("N3TurtleCodecError", {
    description: "Typed N3 Turtle codec error.",
  })
) {}

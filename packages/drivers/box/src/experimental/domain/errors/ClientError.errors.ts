/**
 * Experimental Box client-domain typed errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("errors/ClientError.errors");

/**
 * Experimental placeholder typed error for Box client-domain failures that have not yet been split into concrete classes.
 *
 * **Details**
 *
 * The current error shape has no payload fields; generated technical driver errors remain the field-level source for Box SDK and API failure details.
 *
 * **Example** (Catch PLACEHOLDER with Effect)
 *
 * ```ts
 * import { PLACEHOLDER } from "@beep/box/experimental/domain/errors/ClientError.errors";
 * import { Effect } from "effect";
 *
 * const handled = Effect.fail(PLACEHOLDER.make({})).pipe(
 *   Effect.catchTag("PLACEHOLDER", () => Effect.succeed("handled"))
 * );
 *
 * console.log(Effect.runSync(handled));
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PLACEHOLDER extends S.TaggedError<PLACEHOLDER>($I`PLACEHOLDER`)(
  "PLACEHOLDER",
  {},
  $I.annote("PLACEHOLDER", {
    description:
      "Experimental placeholder typed error for Box client-domain failures that have not yet been split into concrete classes.",
  })
) {}

/**
 * Type-level companion namespace for {@link PLACEHOLDER} encoded error payloads.
 *
 * **Example** (Encode PLACEHOLDER payload)
 *
 * ```ts
 * import { PLACEHOLDER } from "@beep/box/experimental/domain/errors/ClientError.errors";
 * import * as S from "effect/Schema";
 *
 * const encoded: PLACEHOLDER.Encoded = S.encodeSync(PLACEHOLDER)(PLACEHOLDER.make({}));
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PLACEHOLDER {
  /**
   * Encoded payload accepted by the {@link PLACEHOLDER} error schema.
   *
   * **Example** (Encode PLACEHOLDER schema)
   *
   * ```ts
   * import { PLACEHOLDER } from "@beep/box/experimental/domain/errors/ClientError.errors";
   * import * as S from "effect/Schema";
   *
   * const encoded: PLACEHOLDER.Encoded = S.encodeSync(PLACEHOLDER)(PLACEHOLDER.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PLACEHOLDER.Encoded;
}

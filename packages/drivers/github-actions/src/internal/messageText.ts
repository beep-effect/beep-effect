// Message fragments for the package's tagged errors: an optional field reads
// as nothing when it is absent and as `<prefix><value><closing>` when it is
// present, spelled once so every `message` getter composes the same way.

import { $GithubActionsId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $GithubActionsId.create("internal/messageText");

/**
 * How a present value is framed: the text before it and, optionally, after it.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class Frame extends S.Opaque<Frame, { readonly brand: unique symbol }>()(
  S.Struct({
    prefix: S.String.pipe($I.annoteKey("Frame.prefix", { description: "The text before a present value." })),
    closing: S.optionalKey(S.String).pipe(
      $I.annoteKey("Frame.closing", { description: "The text after a present value; omitted means none." })
    ),
  }).pipe($I.annoteSchema("Frame", { description: "How a present message fragment is framed." }))
) {}

/**
 * Companion types for {@link Frame}.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Frame {
  /**
   * The plain object a {@link Frame} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Frame.Encoded;
}

/**
 * The renderer for one optional field: a present value framed by `prefix`
 * and `closing`, an absent one as `""`.
 *
 * **Example** (Render an optional status)
 *
 * ```ts
 * import { framed } from "@beep/github-actions/internal/messageText";
 *
 * const status = framed({ prefix: " with status " });
 * console.log(`refused${status(403)}`) // refused with status 403
 * console.log(`refused${status(undefined)}`) // refused
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const framed =
  ({ prefix, closing = "" }: Frame.Encoded) =>
  (value: string | number | undefined): string =>
    value === undefined ? "" : `${prefix}${value}${closing}`;

/**
 * A `: <detail>` suffix, the shape every error message gives its detail, stderr
 * or subject.
 *
 * **Example** (Render an optional detail)
 *
 * ```ts
 * import { detailText } from "@beep/github-actions/internal/messageText";
 *
 * console.log(`failed${detailText("disk full")}`) // failed: disk full
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const detailText = framed({ prefix: ": " });

/**
 * A ` with status <status>` suffix for an HTTP refusal.
 *
 * **Example** (Render an optional status)
 *
 * ```ts
 * import { statusText } from "@beep/github-actions/internal/messageText";
 *
 * console.log(`refused${statusText(403)}`) // refused with status 403
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const statusText = framed({ prefix: " with status " });

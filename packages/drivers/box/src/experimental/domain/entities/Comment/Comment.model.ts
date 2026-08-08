/**
 * Experimental Box comment entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/Comment/Comment.model");

/**
 * Experimental schema anchor for comments attached to Box items.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty Comment)
 *
 * ```ts
 * import { Comment } from "@beep/box/experimental/domain/entities/Comment/Comment.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Comment)({});
 * const encoded: Comment.Encoded = S.encodeSync(Comment)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Comment extends S.Class<Comment>($I`Comment`)(
  {},
  $I.annote("Comment", {
    description: "Experimental schema anchor for comments attached to Box items.",
  })
) {}

/**
 * Type-level companion namespace for {@link Comment} encoded payloads.
 *
 * **Example** (Make and encode Comment)
 *
 * ```ts
 * import { Comment } from "@beep/box/experimental/domain/entities/Comment/Comment.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Comment.make({});
 * const encoded: Comment.Encoded = S.encodeSync(Comment)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Comment {
  /**
   * Encoded payload accepted by the {@link Comment} entity schema.
   *
   * **Example** (Encode Comment to Encoded)
   *
   * ```ts
   * import { Comment } from "@beep/box/experimental/domain/entities/Comment/Comment.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Comment.Encoded = S.encodeSync(Comment)(Comment.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Comment.Encoded;
}

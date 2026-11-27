/**
 * JSDoc metadata models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $RepoUtilsId.create("JSDoc/models/TagKind.model");

/**
 * Classifies a tag by its syntactic placement in documentation text.
 *
 * **Details**
 *
 * A `block` tag starts at the top level and owns its content up to the next
 * block or modifier tag. An `inline` tag sits in braces, embedded within other
 * content. A `modifier` tag takes no content and marks a quality or flag.
 *
 * **Example** (Check block TagKind)
 *
 * ```ts
 * import { TagKind } from "@beep/repo-utils/JSDoc/models/TagKind.model"
 *
 * const kind = TagKind.Enum.block
 * console.log(TagKind.is.block(kind))
 * ```
 *
 * @description The syntactic form of the tag
 * @category models
 * @since 0.0.0
 */
export const TagKind = LiteralKit(["block", "inline", "modifier"]).pipe(
  $I.annoteSchema("TagKind", {
    description: "The kind of tag",
  })
);

/**
 * Union of supported documentation tag placement kinds.
 *
 * **Example** (Use TagKind as type)
 *
 * ```ts
 * import type { TagKind } from "@beep/repo-utils/JSDoc/models/TagKind.model"
 * type Example = TagKind
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @description The syntactic form of the tag
 * @category models
 * @since 0.0.0
 */
export type TagKind = typeof TagKind.Type;
